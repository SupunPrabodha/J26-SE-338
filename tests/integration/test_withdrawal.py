from datetime import timedelta
from uuid import uuid4

import pytest
from conftest import submit_fixture
from orchestrator.workflow import claim_job, enforce_retention
from research_common.database import (
    Audit,
    Case,
    Consent,
    Job,
    Retention,
    Withdrawal,
    engine,
)
from research_contracts import now
from sqlalchemy import select
from sqlalchemy.orm import Session


@pytest.mark.parametrize("retained_first", [False, True])
@pytest.mark.parametrize("consent_expired", [False, True])
def test_owner_withdrawal_records_once_even_after_retention(
    student_client, retained_first, consent_expired
):
    response, submission = submit_fixture(student_client)
    assert response.status_code == 202
    case_id = response.json()["case_id"]
    with Session(engine()) as db, db.begin():
        if retained_first:
            db.get(Case, case_id).expires_at = now() - timedelta(seconds=1)
        if consent_expired:
            db.get(Consent, submission["consent_id"]).expires_at = now() - timedelta(seconds=1)
    if retained_first:
        enforce_retention()
        with Session(engine()) as db:
            assert db.get(Case, case_id).status == "WITHDRAWN"
            assert db.scalar(select(Withdrawal)) is None

    first_key = str(uuid4())
    receipts = []
    for key in (first_key, first_key, str(uuid4())):
        result = student_client.post(
            f"/api/v1/cases/{case_id}/withdraw", json={"idempotency_key": key}
        )
        assert result.status_code == 200
        receipts.append(result.json())
        consent = student_client.get(f"/api/v1/consents/{submission['consent_id']}")
        assert consent.status_code == 200
        assert consent.json()["consent_status"] == "WITHDRAWN"

    assert receipts[0] == receipts[1] == receipts[2]
    assert receipts[0]["processing_status"] == "WITHDRAWN"
    assert student_client.post("/api/v1/submissions", json=submission).status_code == 403
    assert claim_job() is None
    with Session(engine()) as db:
        withdrawals = db.scalars(select(Withdrawal).where(Withdrawal.case_id == case_id)).all()
        assert len(withdrawals) == 1
        assert withdrawals[0].idempotency_key == first_key
        assert len(db.scalars(select(Retention).where(Retention.case_id == case_id)).all()) == 1
        events = db.scalars(select(Audit).where(Audit.case_id == case_id)).all()
        assert sum(event.event_type == "WITHDRAWAL" for event in events) == 1
        assert sum(event.event_type == "RETENTION" for event in events) == 1
        assert (
            sum(
                event.event_type == "WORKFLOW_TRANSITION" and event.status == "WITHDRAWN"
                for event in events
            )
            == 1
        )
        job = db.scalar(select(Job).where(Job.case_id == case_id))
        assert job.status == "CANCELLED" and job.fixture_id is None
        case = db.get(Case, case_id)
        assert case.inference is None and case.explanation is None
