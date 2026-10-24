from datetime import timedelta
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from orchestrator.main import app
from research_common.database import Assignment, Audit, Consent, engine
from research_contracts import now
from sqlalchemy import select
from sqlalchemy.orm import Session
from test_review_records import TEXT, action, payload

pytest_plugins = ("test_review_records",)


def staff(owner, accounts, role="ADMIN"):
    client = TestClient(app, headers=owner.headers)
    _, username, password = accounts[role]
    assert (
        client.post(
            "/api/v1/auth/login", json=dict(username=username, password=password)
        ).status_code
        == 200
    )
    return client


def test_admin_receipts_filters_pagination_and_privacy(ready, accounts, caplog):
    owner, reviewer, task, case, consent = ready
    assert action(reviewer, task, "START_REVIEW").status_code == 200
    assert reviewer.post(f"/api/v1/review-tasks/{task}/record", json=payload()).status_code == 200
    with staff(owner, accounts) as administrator:
        path = "/api/v1/admin/audit-events"
        response = administrator.get(path, params={"case_id": case, "limit": 2})
        assert response.status_code == 200
        page = response.json()
        assert len(page["items"]) == 2 and page["next_cursor"]
        assert page["observed_at"]
        assert page["case_operations"]["provenance"]["model_version"] == "mock-1"
        ids = []
        while True:
            ids.extend(item["event_id"] for item in page["items"])
            assert all(item["case_id"] == case for item in page["items"])
            if not page["next_cursor"]:
                break
            page = administrator.get(
                path, params={"case_id": case, "limit": 2, "cursor": page["next_cursor"]}
            ).json()
        assert len(ids) == len(set(ids)) and len(ids) > 2
        saved = administrator.get(
            path, params={"case_id": case, "event_type": "HUMAN_REVIEW"}
        ).json()
        assert {e["outcome"] for e in saved["items"]} == {"START_REVIEW", "RECORD_SAVED"}
        for event in saved["items"]:
            assert set(event) <= {
                "schema_version",
                "synthetic",
                "development_only",
                "event_id",
                "event_type",
                "outcome",
                "occurred_at",
                "policy_expires_at",
                "case_id",
                "correlation_id",
                "service_version",
            }
        empty = administrator.get(
            path, params={"since": (now() + timedelta(hours=1)).isoformat()}
        ).json()
        assert not empty["items"]
        for value in (
            TEXT,
            "DISCUSSION_OFFERED",
            consent,
            accounts["COUNSELLOR"][0],
            accounts["ADMIN"][0],
        ):
            assert value not in str(saved) and value not in caplog.text
        assert administrator.get(f"/api/v1/review-tasks/{task}/record").status_code == 403
        assert administrator.get(f"/api/v1/review-tasks/{task}").status_code == 403
        assert administrator.get("/api/v1/review-queue").status_code == 403
        with Session(engine()) as db:
            assert (
                len(
                    db.scalars(
                        select(Audit).where(Audit.event_type == "ADMIN_EVIDENCE_ACCESS")
                    ).all()
                )
                == 1
            )
        assert (
            owner.post(
                f"/api/v1/consents/{consent}/withdraw", json={"idempotency_key": str(uuid4())}
            ).status_code
            == 200
        )
        disposed = administrator.get(path, params={"case_id": case}).json()
        assert disposed["case_operations"]["provenance"] is None
        assert disposed["case_operations"]["processing_status"] == "WITHDRAWN"
        assert disposed["case_operations"]["retention_reason"] == "OWNER_WITHDRAWAL"
        assert TEXT not in str(disposed)


def test_unknown_event_and_outcome_are_not_exported(ready, accounts):
    owner, _, _, case, _ = ready
    with Session(engine()) as db, db.begin():
        for kind, status in (("UNREVIEWED_EVENT", "SUCCESS"), ("HUMAN_REVIEW", TEXT)):
            db.add(
                Audit(
                    id=str(uuid4()),
                    case_id=case,
                    correlation_id=str(uuid4()),
                    event_type=kind,
                    status=status,
                )
            )
    with staff(owner, accounts) as administrator:
        response = administrator.get("/api/v1/admin/audit-events")
        assert response.status_code == 200
        assert TEXT not in response.text and "UNREVIEWED_EVENT" not in response.text


@pytest.mark.parametrize(
    "params",
    [
        {"limit": 0},
        {"limit": 51},
        {"event_type": "UNKNOWN"},
        {"case_id": "invalid"},
        {"cursor": "invalid"},
        {"cursor": "x" * 161},
        {"since": "invalid"},
        {"since": "2026-10-24T00:00:00"},
        {"since": "2026-10-25T00:00:00Z", "until": "2026-10-24T00:00:00Z"},
    ],
)
def test_admin_filter_bounds(ready, accounts, params):
    owner, _, _, _, _ = ready
    with staff(owner, accounts) as administrator:
        response = administrator.get("/api/v1/admin/audit-events", params=params)
        assert response.status_code == 422


def test_admin_role_boundaries_and_session_revocation(ready, accounts):
    owner, reviewer, _, _, _ = ready
    for client in (owner, reviewer):
        assert client.get("/api/v1/admin/audit-events").status_code == 403
    with TestClient(app) as anonymous:
        assert anonymous.get("/api/v1/admin/audit-events").status_code == 401
    with staff(owner, accounts, "RESEARCHER") as researcher:
        assert researcher.get("/api/v1/admin/audit-events").status_code == 403
    with staff(owner, accounts) as administrator:
        assert administrator.get("/api/v1/admin/audit-events").status_code == 200
        assert administrator.post("/api/v1/auth/logout").status_code == 204
        assert administrator.get("/api/v1/admin/audit-events").status_code == 401


def test_queue_metadata_reopen_after_relogin_and_denials(ready, accounts):
    owner, reviewer, task, case, consent = ready
    path = "/api/v1/review-queue"
    page = reviewer.get(path).json()
    assert len(page["items"]) == 1
    item = page["items"][0]
    assert item["case"]["case_id"] == case and item["assignment"] == "ASSIGNED_TO_YOU"
    assert item["review_record_saved_at"] is None
    assert not reviewer.get(path, params={"state": "COMPLETED"}).json()["items"]
    assert action(reviewer, task, "START_REVIEW").status_code == 200
    saved = reviewer.post(f"/api/v1/review-tasks/{task}/record", json=payload()).json()
    assert action(reviewer, task, "COMPLETE_REVIEW").status_code == 200
    assert reviewer.post("/api/v1/auth/logout").status_code == 204
    with staff(owner, accounts, "COUNSELLOR") as relogged:
        page = relogged.get(path, params={"state": "COMPLETED"}).json()
        item = page["items"][0]
        assert item["review_started_at"] and item["review_completed_at"]
        assert item["review_record_saved_at"] == saved["saved_at"]
        assert TEXT not in str(page) and consent not in str(page)
        assert relogged.get(f"/api/v1/review-tasks/{task}/record").json() == saved
        with Session(engine()) as db, db.begin():
            db.query(Assignment).delete()
        assert not relogged.get(path).json()["items"]
        assert relogged.get(f"/api/v1/review-tasks/{task}/record").status_code == 404
    assert owner.get(path).status_code == 403


@pytest.mark.parametrize(
    "params", [{"limit": 21}, {"offset": -1}, {"offset": 10001}, {"state": "WITHDRAWN"}]
)
def test_queue_bounds(ready, params):
    _, reviewer, _, _, _ = ready
    assert reviewer.get("/api/v1/review-queue", params=params).status_code == 422


def test_queue_does_not_publish_expired_consent(ready):
    _, reviewer, _, _, consent = ready
    with Session(engine()) as db, db.begin():
        db.get(Consent, consent).expires_at = now()
    assert not reviewer.get("/api/v1/review-queue").json()["items"]


def test_queue_pagination_and_inclusive_audit_date_filters(ready, accounts):
    from conftest import submit_fixture
    from orchestrator.workflow import claim_job, process_job

    from scripts.synthetic_runtime import synthetic_adapter

    owner, reviewer, _, _, _ = ready
    for _ in range(2):
        submit_fixture(owner)
        process_job(*claim_job(), adapter=synthetic_adapter)
    seen, offset = [], 0
    while True:
        page = reviewer.get("/api/v1/review-queue", params={"limit": 1, "offset": offset}).json()
        assert len(page["items"]) == 1
        seen.append(page["items"][0]["task_id"])
        if page["next_offset"] is None:
            break
        offset = page["next_offset"]
    assert len(set(seen)) == 3
    with staff(owner, accounts) as administrator:
        path = "/api/v1/admin/audit-events"
        first = administrator.get(path).json()["items"][0]
        at_time = administrator.get(
            path, params={"since": first["occurred_at"], "until": first["occurred_at"]}
        ).json()
        assert first["event_id"] in {item["event_id"] for item in at_time["items"]}
