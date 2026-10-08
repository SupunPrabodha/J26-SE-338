from datetime import timedelta
from uuid import uuid4

import pytest
from conftest import submit_fixture
from fastapi.testclient import TestClient
from orchestrator.main import app
from orchestrator.workflow import claim_job, enforce_retention, process_job
from research_common.database import Assignment, Audit, Case, Consent, Job, Review, engine
from research_common.mocks import mock_app
from research_common.service_auth import service_token
from research_common.web import SafeError
from research_contracts import FIXTURES, ErrorCode, now
from sqlalchemy import func, select
from sqlalchemy.orm import Session


def adapter(name, path, body, response_type):
    assert not ({"account_id", "student_id", "email", "username", "sub"} & set(body.model_dump()))
    client = TestClient(mock_app(name))
    response = client.post(
        path,
        json=body.model_dump(mode="json"),
        headers={"Authorization": "Bearer " + service_token(name)},
    )
    assert response.status_code == 200
    return response_type.model_validate(response.json())


def run_job():
    claimed = claim_job()
    assert claimed
    process_job(*claimed, adapter=adapter)


def test_full_workflow_assignment_review_withdrawal(student_client, accounts, caplog):
    caplog.set_level("INFO", logger="research.safe")
    client = student_client
    response, body = submit_fixture(client)
    assert response.status_code == 202
    case_id = response.json()["case_id"]
    assert client.post("/api/v1/submissions", json=body).json()["case_id"] == case_id
    run_job()
    assert (
        client.get(f"/api/v1/cases/{case_id}/status").json()["processing_status"]
        == "READY_FOR_REVIEW"
    )
    reviewer = TestClient(app, headers=client.headers)
    _, username, password = accounts["COUNSELLOR"]
    assert (
        reviewer.post(
            "/api/v1/auth/login", json={"username": username, "password": password}
        ).status_code
        == 200
    )
    tasks = reviewer.get("/api/v1/review-tasks").json()
    assert len(tasks) == 1
    task_id = tasks[0]["task_id"]
    for action, state in [("START_REVIEW", "UNDER_REVIEW"), ("COMPLETE_REVIEW", "COMPLETED")]:
        request = {"action": action, "idempotency_key": str(uuid4())}
        result = reviewer.post(f"/api/v1/review-tasks/{task_id}/actions", json=request)
        assert result.status_code == 200
        assert result.json()["case"]["processing_status"] == state
        assert (
            reviewer.post(f"/api/v1/review-tasks/{task_id}/actions", json=request).status_code
            == 200
        )
    assert (
        client.post(
            f"/api/v1/cases/{case_id}/withdraw", json={"idempotency_key": str(uuid4())}
        ).status_code
        == 200
    )
    assert reviewer.get(f"/api/v1/review-tasks/{task_id}").status_code == 404
    assert reviewer.get("/api/v1/review-tasks").json() == []
    with Session(engine()) as db:
        case = db.get(Case, case_id)
        assert case.inference is None and case.explanation is None
        assert db.scalar(select(func.count()).select_from(Job)) == 1
        evidence = str([(e.event_type, e.status) for e in db.scalars(select(Audit))])
        assert "HUMAN_REVIEW" in evidence and "WITHDRAWAL" in evidence
        assert FIXTURES["english"] not in evidence
    assert FIXTURES["english"] not in caplog.text
    assert password not in caplog.text
    assert client.cookies.get("j26_access") not in caplog.text


@pytest.mark.parametrize(
    "state",
    [
        "PENDING",
        "INVALID",
        "EXPIRED",
        "WITHDRAWN",
        "REJECTED",
        "TIME_EXPIRED",
        "PURPOSE",
        "MISSING",
    ],
)
def test_invalid_consent(student_client, state):
    response, body = submit_fixture(student_client)
    case_id = response.json()["case_id"]
    with Session(engine()) as db, db.begin():
        consent = db.get(Consent, body["consent_id"])
        if state == "TIME_EXPIRED":
            consent.expires_at = now() - timedelta(seconds=1)
        elif state == "PURPOSE":
            consent.purpose = "unapproved-purpose"
        elif state != "MISSING":
            consent.status = state
    if state == "MISSING":
        body["consent_id"] = str(uuid4())
        body["idempotency_key"] = str(uuid4())
    assert student_client.post("/api/v1/submissions", json=body).status_code == 403
    if state != "MISSING":
        run_job()
        with Session(engine()) as db:
            assert db.get(Case, case_id).status == "FAILED"
            assert db.scalar(select(func.count()).select_from(Review)) == 0


@pytest.mark.parametrize(
    "failure", ["preprocessing", "nlp", "xai", "timeout", "malformed", "incompatible"]
)
def test_failures_never_create_review(student_client, failure):
    submit_fixture(student_client)
    calls = []

    def failing(name, path, body, response_type):
        calls.append(name)
        if name == failure or failure in {"timeout", "malformed", "incompatible"}:
            if failure == "malformed":
                return response_type.model_validate({"unexpected": "no payload echo"})
            if failure == "incompatible":
                return response_type.model_validate(
                    {**body.model_dump(), "schema_version": "9.0.0"}
                )
            raise SafeError(
                ErrorCode.DOWNSTREAM_TIMEOUT
                if failure == "timeout"
                else ErrorCode.DOWNSTREAM_FAILED
            )
        return adapter(name, path, body, response_type)

    for _ in range(3):
        claimed = claim_job()
        if claimed:
            process_job(*claimed, adapter=failing)
    with Session(engine()) as db:
        assert db.scalar(select(Case)).status == "FAILED"
        assert db.scalar(select(Job)).status == "DEAD_LETTER"
        assert db.scalar(select(Job)).attempts <= 3
        assert db.scalar(select(func.count()).select_from(Review)) == 0


@pytest.mark.parametrize("claimed_first", [False, True])
def test_withdrawal_cancels_queued_work(student_client, claimed_first):
    response, _ = submit_fixture(student_client)
    job = claim_job() if claimed_first else None
    case_id = response.json()["case_id"]
    assert (
        student_client.post(
            f"/api/v1/cases/{case_id}/withdraw", json={"idempotency_key": str(uuid4())}
        ).status_code
        == 200
    )
    if job:
        process_job(
            *job, adapter=lambda *args: pytest.fail("Withdrawn work reached downstream service")
        )
    else:
        assert claim_job() is None
    with Session(engine()) as db:
        assert db.scalar(select(Job)).status == "CANCELLED"
        assert db.scalar(select(func.count()).select_from(Review)) == 0


def test_unassigned_admin_researcher_and_cross_case(student_client, accounts):
    response, _ = submit_fixture(student_client)
    run_job()
    case_id = response.json()["case_id"]
    with Session(engine()) as db:
        task = db.scalar(select(Review)).id
    outsider = TestClient(app, headers=student_client.headers)
    outsider.post("/api/v1/auth/student-session")
    assert outsider.get(f"/api/v1/cases/{case_id}/status").status_code == 404
    assert (
        outsider.post(
            f"/api/v1/cases/{case_id}/withdraw", json={"idempotency_key": str(uuid4())}
        ).status_code
        == 404
    )
    for role in ("ADMIN", "RESEARCHER"):
        _, username, password = accounts[role]
        outsider.post("/api/v1/auth/login", json={"username": username, "password": password})
        assert outsider.get(f"/api/v1/review-tasks/{task}").status_code == 403
    with Session(engine()) as db, db.begin():
        db.query(Assignment).delete()
    _, username, password = accounts["COUNSELLOR"]
    outsider.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert outsider.get(f"/api/v1/review-tasks/{task}").status_code == 404


def test_no_real_text_and_safe_validation_errors(student_client, caplog):
    sentinel = "PRIVATE-SENTINEL-" + str(uuid4())
    response, _ = submit_fixture(student_client, text=sentinel)
    assert response.status_code == 422
    assert sentinel not in response.text and sentinel not in caplog.text
    response, _ = submit_fixture(student_client, schema_version="2.0.0")
    assert response.status_code == 422


def test_retention_deletes_evidence(student_client, accounts):
    response, _ = submit_fixture(student_client)
    run_job()
    case_id = response.json()["case_id"]
    with Session(engine()) as db, db.begin():
        db.get(Case, case_id).expires_at = now() - timedelta(seconds=1)
    enforce_retention()
    with Session(engine()) as db:
        assert db.get(Case, case_id).status == "WITHDRAWN"
        assert db.get(Case, case_id).inference is None
