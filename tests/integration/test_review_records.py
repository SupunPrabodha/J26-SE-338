from datetime import timedelta
from uuid import uuid4

import pytest
from conftest import submit_fixture
from fastapi.testclient import TestClient
from orchestrator.main import app
from orchestrator.workflow import claim_job, enforce_retention, process_job
from research_common.database import (
    Account,
    Assignment,
    Audit,
    Case,
    Consent,
    Job,
    ReviewRecord,
    engine,
)
from research_contracts import now
from sqlalchemy import select
from sqlalchemy.orm import Session

from scripts.synthetic_runtime import synthetic_adapter

TEXT = "SYNTHETIC: Fictional timetable context reviewed by a human."


def payload(**changes):
    return dict(
        interpretation=TEXT, follow_up="DISCUSSION_OFFERED", idempotency_key=str(uuid4()), **changes
    )


@pytest.fixture
def ready(student_client, accounts):
    case, body = submit_fixture(student_client)
    process_job(*claim_job(), adapter=synthetic_adapter)
    with TestClient(app, headers=student_client.headers) as reviewer:
        _, username, password = accounts["COUNSELLOR"]
        assert (
            reviewer.post(
                "/api/v1/auth/login", json=dict(username=username, password=password)
            ).status_code
            == 200
        )
        task = reviewer.get("/api/v1/review-tasks").json()[0]["task_id"]
        yield student_client, reviewer, task, case.json()["case_id"], body["consent_id"]


def action(reviewer, task, kind):
    return reviewer.post(
        f"/api/v1/review-tasks/{task}/actions", json=dict(action=kind, idempotency_key=str(uuid4()))
    )


def test_save_read_repeats_state_rules_and_privacy(ready, caplog):
    owner, reviewer, task, case, consent = ready
    caplog.set_level("INFO", logger="research.safe")
    path = f"/api/v1/review-tasks/{task}/record"
    body = payload()
    assert reviewer.get(path).json() is None
    assert reviewer.post(path, json=body).status_code == 409  # Must start review.
    assert action(reviewer, task, "START_REVIEW").status_code == 200
    saved = reviewer.post(path, json=body)
    assert saved.status_code == 200
    assert saved.json()["interpretation"] == TEXT
    assert saved.json()["follow_up"] == "DISCUSSION_OFFERED"
    assert reviewer.get(path).json() == saved.json()
    assert action(reviewer, task, "COMPLETE_REVIEW").status_code == 200
    for key in (body["idempotency_key"], str(uuid4())):
        assert reviewer.post(path, json={**body, "idempotency_key": key}).json() == saved.json()
    for change in (
        {"interpretation": "SYNTHETIC: Different observation."},
        {"follow_up": "FOLLOW_UP_REQUESTED"},
    ):
        result = reviewer.post(path, json={**body, **change})
        assert result.status_code == 409 and TEXT not in result.text
    with Session(engine()) as db:
        assert len(db.scalars(select(ReviewRecord)).all()) == 1
        events = db.scalars(select(Audit).where(Audit.case_id == case)).all()
        assert sum(e.status == "RECORD_SAVED" for e in events) == 1
        audit = str([vars(e) for e in events])
        assert TEXT not in audit and "DISCUSSION_OFFERED" not in audit
    demo = owner.get(f"/api/v1/demo/runs/{consent}")
    assert demo.json()["review_record_saved_at"]
    for value in (TEXT, "DISCUSSION_OFFERED", "interpretation", "actor_id", "idempotency_key"):
        assert value not in demo.text and value not in caplog.text
    # List/task APIs do not accidentally start carrying private review contents.
    assert TEXT not in reviewer.get("/api/v1/review-tasks").text
    assert TEXT not in reviewer.get(f"/api/v1/review-tasks/{task}").text


@pytest.mark.parametrize("role", ["STUDENT", "ADMIN", "RESEARCHER", "UNASSIGNED"])
def test_review_record_role_and_assignment_denial(ready, accounts, role):
    owner, reviewer, task, _, _ = ready
    path = f"/api/v1/review-tasks/{task}/record"
    assert action(reviewer, task, "START_REVIEW").status_code == 200
    assert reviewer.post(path, json=payload()).status_code == 200
    if role == "UNASSIGNED":
        with Session(engine()) as db, db.begin():
            db.query(Assignment).delete()
        denied = reviewer
    elif role == "STUDENT":
        denied = owner
    else:
        denied = TestClient(app, headers=owner.headers)
        _, username, password = accounts[role]
        assert (
            denied.post(
                "/api/v1/auth/login", json=dict(username=username, password=password)
            ).status_code
            == 200
        )
    try:
        for response in (denied.get(path), denied.post(path, json=payload())):
            assert response.status_code == (404 if role == "UNASSIGNED" else 403)
            assert TEXT not in response.text
    finally:
        if denied not in (owner, reviewer):
            denied.close()


@pytest.mark.parametrize(
    "changes",
    [
        {"interpretation": ""},
        {"interpretation": " "},
        {"interpretation": "SYNTHETIC: "},
        {"interpretation": "Real content not accepted"},
        {"interpretation": "SYNTHETIC: " + "x" * 2000},
        {"follow_up": "AUTOMATIC_DIAGNOSIS"},
        {"follow_up": None},
        {"idempotency_key": "invalid"},
        {"extra_notes": TEXT},
    ],
)
def test_invalid_input_is_safe(ready, changes, caplog):
    _, reviewer, task, _, _ = ready
    assert action(reviewer, task, "START_REVIEW").status_code == 200
    response = reviewer.post(f"/api/v1/review-tasks/{task}/record", json={**payload(), **changes})
    assert response.status_code == 422 and response.json()["error_code"] == "CONTRACT_INVALID"
    assert TEXT not in response.text and TEXT not in caplog.text
    with Session(engine()) as db:
        assert db.scalar(select(ReviewRecord)) is None


def test_completed_without_record_cannot_create_one(ready):
    _, reviewer, task, _, _ = ready
    for kind in ("START_REVIEW", "COMPLETE_REVIEW"):
        assert action(reviewer, task, kind).status_code == 200
    assert reviewer.post(f"/api/v1/review-tasks/{task}/record", json=payload()).status_code == 409


@pytest.mark.parametrize(
    "policy",
    [
        "WITHDRAWAL",
        "RETENTION",
        "EXPIRED",
        "BOUNDARY",
        "REJECTED",
        "PENDING",
        "INVALID",
        "PURPOSE",
        "VERSION",
    ],
)
def test_policy_rechecked_for_saved_record_and_replay(ready, policy, monkeypatch):
    owner, reviewer, task, case, consent = ready
    path = f"/api/v1/review-tasks/{task}/record"
    assert action(reviewer, task, "START_REVIEW").status_code == 200
    body = payload()
    assert reviewer.post(path, json=body).status_code == 200
    if policy == "WITHDRAWAL":
        assert action(reviewer, task, "COMPLETE_REVIEW").status_code == 200
        for _ in range(2):
            assert (
                owner.post(
                    f"/api/v1/consents/{consent}/withdraw", json=dict(idempotency_key=str(uuid4()))
                ).status_code
                == 200
            )
    else:
        with Session(engine()) as db, db.begin():
            row = db.get(Consent, consent)
            if policy == "RETENTION":
                db.get(Case, case).expires_at = now() - timedelta(seconds=1)
            elif policy in {"EXPIRED", "BOUNDARY"}:
                instant = now()
                row.expires_at = instant
                if policy == "BOUNDARY":
                    monkeypatch.setattr("orchestrator.workflow.now", lambda: instant)
            elif policy == "PURPOSE":
                row.purpose = "synthetic-other-purpose"
            elif policy == "VERSION":
                row.version = "synthetic-other-version"
            else:
                row.status = policy
        if policy == "RETENTION":
            # Expiry blocks access even before the sweep deletes the record.
            assert reviewer.get(path).status_code == 403
            enforce_retention()
    for response in (reviewer.get(path), reviewer.post(path, json=body)):
        assert response.status_code in (403, 404) and TEXT not in response.text
    if policy in {"WITHDRAWAL", "RETENTION"}:
        with Session(engine()) as db:
            assert db.scalar(select(ReviewRecord)) is None
            assert db.scalar(select(Assignment)) is None
            job = db.scalar(select(Job))
            assert job.status == "CANCELLED" and job.fixture_id is None
        data = owner.get(f"/api/v1/demo/runs/{consent}").json()
        assert data["disposal_confirmed"] and data["review_record_saved_at"]
        assert TEXT not in str(data)


def test_different_assigned_actor_cannot_replace_record(ready):
    _, reviewer, task, case, _ = ready
    assert action(reviewer, task, "START_REVIEW").status_code == 200
    path = f"/api/v1/review-tasks/{task}/record"
    body = payload()
    assert reviewer.post(path, json=body).status_code == 200
    # Exercise actor mismatch through the endpoint dependency, preserving authorization.
    from orchestrator import main

    with Session(engine(), expire_on_commit=False) as db, db.begin():
        second = Account(role="COUNSELLOR")
        db.add(second)
        db.flush()
        db.add(Assignment(case_id=case, counsellor_id=second.id))
    app.dependency_overrides[main.counsellor] = lambda: second
    try:
        assert reviewer.get(path).status_code == 200
        assert reviewer.post(path, json=body).status_code == 409
    finally:
        app.dependency_overrides.clear()
