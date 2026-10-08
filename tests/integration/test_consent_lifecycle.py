from datetime import timedelta
from uuid import uuid4

import pytest
from conftest import submit_fixture
from fastapi.testclient import TestClient
from orchestrator.main import app
from orchestrator.workflow import claim_job, enforce_retention
from research_common.database import Audit, Case, Consent, ConsentWithdrawal, Job, engine
from research_contracts import FIXTURES, now
from sqlalchemy import func, select
from sqlalchemy.orm import Session


def test_withdraw_before_submission_is_durable_and_idempotent(student_client):
    client = student_client
    consent = client.post("/api/v1/consents", json={"consent_status": "ACTIVE"}).json()
    path = f"/api/v1/consents/{consent['consent_id']}"
    receipts = [
        client.post(path + "/withdraw", json={"idempotency_key": str(uuid4())}) for _ in range(3)
    ]
    assert all(r.status_code == 200 for r in receipts)
    assert receipts[0].json() == receipts[1].json() == receipts[2].json()
    lifecycle = client.get(path + "/lifecycle").json()
    assert lifecycle["consent"]["consent_status"] == "WITHDRAWN"
    assert lifecycle["explicitly_withdrawn_at"] and lifecycle["case"] is None
    assert lifecycle["disposal_reason"] is None
    result = client.post(
        "/api/v1/submissions",
        json={
            "consent_id": consent["consent_id"],
            "idempotency_key": str(uuid4()),
            "fixture_id": "english",
            "text": FIXTURES["english"],
        },
    )
    assert result.status_code == 403
    with Session(engine()) as db:
        assert db.scalar(select(func.count()).select_from(ConsentWithdrawal)) == 1
        assert db.scalar(select(func.count()).select_from(Job)) == 0
        assert len(db.scalars(select(Audit).where(Audit.event_type == "WITHDRAWAL")).all()) == 1


@pytest.mark.parametrize("retained", [False, True])
def test_consent_endpoint_withdraws_existing_case_and_distinguishes_retention(
    student_client, retained
):
    response, body = submit_fixture(student_client)
    case_id = response.json()["case_id"]
    path = f"/api/v1/consents/{body['consent_id']}"
    if retained:
        with Session(engine()) as db, db.begin():
            db.get(Case, case_id).expires_at = now() - timedelta(seconds=1)
        enforce_retention()
        before = student_client.get(path + "/lifecycle").json()
        assert before["explicitly_withdrawn_at"] is None
        assert before["disposal_reason"] == "RETENTION"
        assert before["consent"]["consent_status"] == "ACTIVE"
    first = student_client.post(path + "/withdraw", json={"idempotency_key": str(uuid4())})
    assert first.status_code == 200
    assert first.json()["disposal_reason"] == ("RETENTION" if retained else "OWNER_WITHDRAWAL")
    assert first.json()["explicitly_withdrawn_at"]
    assert (
        student_client.post(path + "/withdraw", json={"idempotency_key": str(uuid4())}).json()
        == first.json()
    )
    assert claim_job() is None


@pytest.mark.parametrize("state", ["PENDING", "REJECTED", "INVALID"])
def test_unaccepted_consent_cannot_be_withdrawn(student_client, state):
    consent = student_client.post("/api/v1/consents", json={"consent_status": "ACTIVE"}).json()
    with Session(engine()) as db, db.begin():
        db.get(Consent, consent["consent_id"]).status = state
    assert (
        student_client.post(
            f"/api/v1/consents/{consent['consent_id']}/withdraw",
            json={"idempotency_key": str(uuid4())},
        ).status_code
        == 409
    )


def test_expiry_is_not_explicit_withdrawal_and_owner_can_still_withdraw(
    student_client, monkeypatch
):
    consent = student_client.post("/api/v1/consents", json={"consent_status": "ACTIVE"}).json()
    boundary = now()
    with Session(engine()) as db, db.begin():
        db.get(Consent, consent["consent_id"]).expires_at = boundary
    monkeypatch.setattr("orchestrator.main.now", lambda: boundary)
    path = f"/api/v1/consents/{consent['consent_id']}"
    value = student_client.get(path + "/lifecycle").json()
    assert value["consent"]["consent_status"] == "EXPIRED"
    assert value["explicitly_withdrawn_at"] is None and value["disposal_reason"] is None
    assert (
        student_client.post(path + "/withdraw", json={"idempotency_key": str(uuid4())}).status_code
        == 200
    )


def test_foreign_and_missing_consent_withdrawal_are_hidden(student_client):
    consent = student_client.post("/api/v1/consents", json={"consent_status": "ACTIVE"}).json()
    with TestClient(app, headers=student_client.headers) as other:
        assert other.post("/api/v1/auth/student-session").status_code == 200
        for consent_id in (consent["consent_id"], str(uuid4())):
            path = f"/api/v1/consents/{consent_id}"
            assert other.get(path + "/lifecycle").status_code == 404
            assert (
                other.post(path + "/withdraw", json={"idempotency_key": str(uuid4())}).status_code
                == 404
            )


@pytest.mark.parametrize(
    "condition",
    [
        "PENDING",
        "REJECTED",
        "INVALID",
        "WITHDRAWN",
        "EXPIRED",
        "boundary",
        "purpose",
        "version",
        "missing",
    ],
)
def test_first_submission_uses_same_consent_gate(student_client, monkeypatch, condition):
    consent = student_client.post("/api/v1/consents", json={"consent_status": "ACTIVE"}).json()
    instant = now()
    monkeypatch.setattr("orchestrator.workflow.now", lambda: instant)
    consent_id = consent["consent_id"]
    with Session(engine()) as db, db.begin():
        record = db.get(Consent, consent_id)
        if condition in {"PENDING", "REJECTED", "INVALID", "WITHDRAWN", "EXPIRED"}:
            record.status = condition
        elif condition == "boundary":
            record.expires_at = instant
        elif condition == "purpose":
            record.purpose = "synthetic-wrong-purpose"
        elif condition == "version":
            record.version = "synthetic-wrong-version"
        else:
            consent_id = str(uuid4())
    response = student_client.post(
        "/api/v1/submissions",
        json={
            "consent_id": consent_id,
            "idempotency_key": str(uuid4()),
            "fixture_id": "english",
            "text": FIXTURES["english"],
        },
    )
    assert response.status_code == 403
    with Session(engine()) as db:
        assert db.scalar(select(func.count()).select_from(Job)) == 0
