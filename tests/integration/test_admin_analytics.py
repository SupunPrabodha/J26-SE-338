from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from conftest import submit_fixture
from orchestrator.workflow import claim_job, process_job
from research_common.config import settings
from research_common.database import Account, Assignment, Case, Job, Review, engine
from research_contracts import now
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from test_operations import staff
from test_review_records import action, payload
from test_staff_assignment import assign, case_row, new_staff

from scripts.synthetic_runtime import synthetic_adapter

pytest_plugins = ("test_review_records",)


def test_manual_connected_pipeline_and_assignment_receipts(student_client, accounts, monkeypatch):
    monkeypatch.setenv("ASSIGNMENT_POLICY", "MANUAL")
    settings.cache_clear()
    consent = student_client.post("/api/v1/consents", json={"consent_status": "ACTIVE"}).json()
    with Session(engine()) as db:
        for model in (Case, Job, Review):
            assert db.scalar(select(func.count()).select_from(model)) == 0
    assert not student_client.get(f"/api/v1/demo/runs/{consent['consent_id']}").json()[
        "review_task_authorized"
    ]
    response, body = submit_fixture(student_client)
    case = response.json()["case_id"]
    called = []

    def adapter(service, path, request, response_type):
        called.append(service)
        return synthetic_adapter(service, path, request, response_type)

    process_job(*claim_job(), adapter=adapter)
    assert called == ["preprocessing", "nlp", "xai"]
    reviewer_id, reviewer, _ = new_staff(student_client)
    try:
        with Session(engine()) as db:
            task = db.scalar(select(Review.id).where(Review.case_id == case))
        assert reviewer.get(f"/api/v1/review-tasks/{task}").status_code == 404
        evidence_path = f"/api/v1/demo/runs/{body['consent_id']}"
        assert not student_client.get(evidence_path).json()["review_task_authorized"]
        with staff(student_client, accounts) as admin:
            current = case_row(admin, case)
            assert current["assignment_state"] == "AWAITING_ASSIGNMENT"
            assert current["human_review_status"] == "AWAITING_REVIEW"
            assert current["last_assignment_at"] is None
            changed = assign(admin, case, reviewer_id, current["assignment_version"]).json()
            assert changed["last_assignment_at"] and changed["counsellors"][0]["display_name"]
            assert student_client.get(evidence_path).json()["review_task_authorized"]
            assert reviewer.get(f"/api/v1/review-tasks/{task}").status_code == 200
            assert action(reviewer, task, "START_REVIEW").status_code == 200
            saved = reviewer.post(f"/api/v1/review-tasks/{task}/record", json=payload()).json()
            assert reviewer.get(f"/api/v1/review-tasks/{task}/record").json() == saved
            assert admin.get(f"/api/v1/review-tasks/{task}/record").status_code == 403
            assert case_row(admin, case)["human_review_status"] == "IN_PROGRESS"
            assert action(reviewer, task, "COMPLETE_REVIEW").status_code == 200
            assert case_row(admin, case)["human_review_status"] == "COMPLETED"
    finally:
        reviewer.close()


def test_chart_totals_utc_boundaries_filter_parity_and_disposal(ready, accounts):
    owner, reviewer, task, case, consent = ready
    start = datetime(2026, 10, 19, tzinfo=UTC)  # Monday
    end = start + timedelta(days=7)
    with Session(engine()) as db, db.begin():
        db.get(Case, case).created_at = start
        for instant, state in (
            (start - timedelta(microseconds=1), "FAILED"),
            (start + timedelta(days=1), "FAILED"),
            (end - timedelta(microseconds=1), "WITHDRAWN"),
            (end, "RECEIVED"),
        ):
            db.add(
                Case(
                    correlation_id=str(uuid4()),
                    status=state,
                    created_at=instant,
                    expires_at=now() + timedelta(hours=1),
                )
            )
    params = {"since": start.isoformat(), "until": end.isoformat()}
    with staff(owner, accounts) as admin:
        data = admin.get("/api/v1/admin/analytics", params=params).json()
        table = admin.get("/api/v1/admin/cases", params=params).json()
        assert data["total_cases"] == len(table["items"]) == 3
        assert sum(row["cases"] for row in data["statuses"]) == 3
        assert sum(row["cases"] for row in data["submissions"]) == 3
        assert len(data["submissions"]) == 7 and data["submissions"][0]["cases"] == 1
        assert data["workload_assignment_pairs"] == 1
        assert data["workload"][0]["cases"] == 1
        weekly = admin.get("/api/v1/admin/analytics", params={**params, "interval": "week"}).json()
        assert len(weekly["submissions"]) == 1 and weekly["submissions"][0]["cases"] == 3
        offset = {"since": "2026-10-19T05:30:00+05:30", "until": "2026-10-26T05:30:00+05:30"}
        assert admin.get("/api/v1/admin/analytics", params=offset).json()["total_cases"] == 3
        for filters in (
            {"state": "FAILED"},
            {"q": case},
            {"assignment": "ASSIGNED"},
            {"assignment": "AWAITING_ASSIGNMENT"},
            {"disposed_only": True},
            {"eligible_only": True},
        ):
            actual = admin.get("/api/v1/admin/analytics", params={**params, **filters}).json()
            matching = admin.get("/api/v1/admin/cases", params={**params, **filters}).json()
            assert actual["total_cases"] == len(matching["items"])
        assert action(reviewer, task, "START_REVIEW").status_code == 200
        assert action(reviewer, task, "COMPLETE_REVIEW").status_code == 200
        assert admin.get("/api/v1/admin/analytics", params=params).json()["workload"] == []
        owner.post(f"/api/v1/consents/{consent}/withdraw", json={"idempotency_key": str(uuid4())})
        disposed = admin.get("/api/v1/admin/analytics", params=params).json()
        assert disposed["total_cases"] == 3 and disposed["workload"] == []
        assert reviewer.get(f"/api/v1/review-tasks/{task}").status_code == 404
        assert not owner.get(f"/api/v1/demo/runs/{consent}").json()["review_task_authorized"]
        for forbidden in (
            "interpretation",
            "follow_up",
            "inference",
            "explanation",
            "username",
            "password",
            "owner_id",
        ):
            assert forbidden not in str(disposed)


def test_workload_excludes_disabled_and_expired_staff_and_consent(ready, accounts):
    owner, _, _, case, consent = ready
    with staff(owner, accounts) as admin:
        assert admin.get("/api/v1/admin/analytics").json()["workload_assignment_pairs"] == 1
        with Session(engine()) as db, db.begin():
            db.get(Account, accounts["COUNSELLOR"][0]).enabled = False
        assert admin.get("/api/v1/admin/analytics").json()["workload_assignment_pairs"] == 0
        with Session(engine()) as db, db.begin():
            account = db.get(Account, accounts["COUNSELLOR"][0])
            account.enabled = True
            account.expires_at = now() - timedelta(seconds=1)
        assert admin.get("/api/v1/admin/analytics").json()["workload"] == []


def test_workload_is_bounded_and_counts_legacy_assignment_pairs(ready, accounts):
    owner, _, _, case, _ = ready
    with Session(engine()) as db, db.begin():
        template = db.get(Account, accounts["COUNSELLOR"][0])
        for _ in range(21):
            account = Account(
                role="COUNSELLOR", username=str(uuid4()), password_hash=template.password_hash
            )
            db.add(account)
            db.flush()
            db.add(Assignment(case_id=case, counsellor_id=account.id))
    with staff(owner, accounts) as admin:
        data = admin.get("/api/v1/admin/analytics").json()
        assert data["total_cases"] == 1 and data["workload_assignment_pairs"] == 22
        assert len(data["workload"]) == 21
        assert data["workload"][-1]["counsellor_id"] is None
        assert data["workload"][-1]["cases"] == 2
        assert sum(row["cases"] for row in data["workload"]) == 22


@pytest.mark.parametrize(
    "params",
    [
        {"since": "2026-01-01T00:00:00Z", "until": "2026-01-01T00:00:00Z"},
        {"since": "2026-01-01T00:00:00Z", "until": "2027-01-03T00:00:00Z"},
        {"since": "2026-01-01"},
        {"interval": "year"},
        {"q": "private text"},
    ],
)
def test_analytics_bounds_and_roles(ready, accounts, params):
    owner, reviewer, _, _, _ = ready
    with staff(owner, accounts) as admin:
        assert admin.get("/api/v1/admin/analytics", params=params).status_code == 422
    for client in (owner, reviewer):
        assert client.get("/api/v1/admin/analytics").status_code == 403
    with staff(owner, accounts, "RESEARCHER") as researcher:
        assert researcher.get("/api/v1/admin/analytics").status_code == 403
