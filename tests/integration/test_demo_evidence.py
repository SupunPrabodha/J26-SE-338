from datetime import timedelta
from uuid import NAMESPACE_URL, uuid4, uuid5

import pytest
from conftest import submit_fixture
from fastapi.testclient import TestClient
from orchestrator.main import app
from research_common.database import Audit, Case, Consent, engine
from research_contracts import FIXTURES, now
from sqlalchemy.orm import Session
from test_workflow import run_job


def get(client, consent_id):
    response = client.get(f"/api/v1/demo/runs/{consent_id}")
    assert response.status_code == 200
    return response.json()


@pytest.mark.parametrize("decision", ["ACTIVE", "REJECTED"])
def test_empty_and_pre_case_decisions(student_client, decision):
    client = student_client
    assert client.get("/api/v1/demo/runs").json()["runs"] == []
    consent = client.post("/api/v1/consents", json={"consent_status": decision}).json()
    data = get(client, consent["consent_id"])
    assert data["run"]["case_id"] is None
    assert data["consent_recorded"] and not data["blocking_observed"]
    assert data["receipt_only"] == (decision == "REJECTED")
    assert data["run"]["consent_status"] == decision


def test_pre_submission_withdrawal(student_client):
    client = student_client
    consent = client.post("/api/v1/consents", json={"consent_status": "ACTIVE"}).json()
    run_id = consent["consent_id"]
    assert (
        client.post(
            f"/api/v1/consents/{run_id}/withdraw", json={"idempotency_key": str(uuid4())}
        ).status_code
        == 200
    )
    data = get(client, run_id)
    assert data["withdrawn_at"] and data["receipt_only"]
    assert data["run"]["case_id"] is None and not data["disposal_confirmed"]


def test_real_review_receipts_withdrawal_privacy(student_client, accounts, caplog):
    client = student_client
    result, body = submit_fixture(client)
    assert result.status_code == 202
    run_id = body["consent_id"]
    assert not get(client, run_id)["replay_observed"]
    assert client.post("/api/v1/submissions", json=body).status_code == 202
    run_job()
    data = get(client, run_id)
    assert data["provenance_validated"] and data["review_task_authorized"]
    assert data["replay_observed"] and not data["failure_observed"]
    assert data["review_completed_at"] is None
    reviewer = TestClient(app, headers=client.headers)
    account_id, username, password = accounts["COUNSELLOR"]
    assert (
        reviewer.post(
            "/api/v1/auth/login", json={"username": username, "password": password}
        ).status_code
        == 200
    )
    assert reviewer.get("/api/v1/demo/runs").status_code == 403
    task = reviewer.get("/api/v1/review-tasks").json()[0]["task_id"]
    for action in ("START_REVIEW", "COMPLETE_REVIEW"):
        assert (
            reviewer.post(
                f"/api/v1/review-tasks/{task}/actions",
                json={"action": action, "idempotency_key": str(uuid4())},
            ).status_code
            == 200
        )
    data = get(client, run_id)
    assert data["review_started_at"] and data["review_completed_at"]
    assert (
        client.post(
            f"/api/v1/consents/{run_id}/withdraw", json={"idempotency_key": str(uuid4())}
        ).status_code
        == 200
    )
    data = get(client, run_id)
    assert data["withdrawn_at"] and data["disposal_confirmed"] and data["receipt_only"]
    assert not data["provenance_validated"] and not data["review_task_authorized"]
    assert data["review_completed_at"]  # Minimal action receipt survives, not derived evidence.
    assert reviewer.get(f"/api/v1/review-tasks/{task}").status_code == 404
    encoded = str(data)
    for forbidden in (
        FIXTURES["english"],
        password,
        username,
        account_id,
        "anonymized_text",
        "inference",
        "explanation",
        "actor_id",
        "trace_id",
        "request_hash",
        "access_jti",
    ):
        assert forbidden not in encoded
        assert forbidden not in caplog.text
    assert data["provider"] == "MOCK_SYNTHETIC_DEVELOPMENT_ONLY"
    assert all(e["event"] != "WORKFLOW_TRANSITION" for e in data["receipts"])


def test_owner_run_isolation_and_pagination(student_client):
    client = student_client
    _, body = submit_fixture(client)
    run_job()
    first = body["consent_id"]
    second = client.post("/api/v1/consents", json={"consent_status": "REJECTED"}).json()[
        "consent_id"
    ]
    page = client.get("/api/v1/demo/runs?limit=1").json()
    assert len(page["runs"]) == 1 and page["next_offset"] == 1
    assert client.get("/api/v1/demo/runs?offset=1&limit=1").json()["next_offset"] is None
    assert get(client, first)["provenance_validated"]
    assert not get(client, second)["provenance_validated"]
    assert client.get("/api/v1/demo/runs?limit=21").status_code == 422
    assert client.post("/api/v1/auth/student-session").status_code == 200
    assert client.get("/api/v1/demo/runs").json()["runs"] == []
    assert client.get(f"/api/v1/demo/runs/{first}").status_code == 404
    assert client.get(f"/api/v1/demo/runs/{uuid4()}").status_code == 404


@pytest.mark.parametrize(
    "change", ["expiry", "purpose", "version", "WITHDRAWN", "PENDING", "INVALID", "REJECTED"]
)
def test_inactive_policy_withholds_provenance(student_client, change):
    _, body = submit_fixture(student_client)
    run_job()
    with Session(engine()) as db, db.begin():
        consent = db.get(Consent, body["consent_id"])
        if change == "expiry":
            consent.expires_at = now() - timedelta(seconds=1)
        elif change in {"purpose", "version"}:
            setattr(consent, change, "synthetic-invalid")
        else:
            consent.status = change
    data = get(student_client, body["consent_id"])
    assert data["receipt_only"] and not data["provenance_validated"]
    assert not data["review_task_authorized"]
    assert not data["blocking_observed"]  # State alone is not a denial event.
    assert student_client.post("/api/v1/submissions", json=body).status_code == 403
    assert get(student_client, body["consent_id"])["blocking_observed"]


def test_bounded_allowlisted_events_and_no_status_based_review(student_client):
    result, body = submit_fixture(student_client)
    case_id = result.json()["case_id"]
    with Session(engine()) as db, db.begin():
        db.get(Case, case_id).status = "COMPLETED"  # A status must never fabricate a human action.
        trace = str(uuid5(NAMESPACE_URL, "j26-trace:" + body["consent_id"]))
        for _index in range(55):
            db.add(
                Audit(
                    id=str(uuid4()),
                    case_id=case_id,
                    correlation_id=str(uuid4()),
                    trace_id=trace,
                    event_type="WORKFLOW_TRANSITION",
                    status="RECEIVED",
                )
            )
        db.add(
            Audit(
                id=str(uuid4()),
                case_id=case_id,
                correlation_id=str(uuid4()),
                trace_id=trace,
                event_type="HUMAN_REVIEW",
                status="SYNTHETIC_PRIVATE_SENTINEL",
            )
        )
    data = get(student_client, body["consent_id"])
    assert data["receipts_truncated"] and len(data["receipts"]) == 50
    assert data["consent_recorded"]  # Not lost when its receipt is outside the window.
    assert data["review_completed_at"] is None
    assert "SYNTHETIC_PRIVATE_SENTINEL" not in str(data)


def test_no_session_and_revoked_session(platform, student_client):
    anonymous = TestClient(app)
    assert anonymous.get("/api/v1/demo/runs").status_code == 401
    assert student_client.post("/api/v1/auth/logout").status_code == 204
    assert student_client.get("/api/v1/demo/runs").status_code == 401
