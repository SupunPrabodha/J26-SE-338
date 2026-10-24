import secrets
from datetime import timedelta
from uuid import uuid4

import pytest
from conftest import submit_fixture
from fastapi.testclient import TestClient
from orchestrator import auth
from orchestrator.main import app
from orchestrator.manage import provision
from orchestrator.workflow import claim_job, process_job
from research_common.config import settings
from research_common.database import Account, engine
from research_contracts import now
from sqlalchemy import select
from sqlalchemy.orm import Session
from test_operations import staff
from test_review_records import TEXT, action, payload

from scripts.synthetic_runtime import synthetic_adapter

pytest_plugins = ("test_review_records",)


def new_staff(owner, role="COUNSELLOR", expires=None):
    username, password = secrets.token_urlsafe(30), secrets.token_urlsafe(36)
    with Session(engine(), expire_on_commit=False) as db, db.begin():
        row = Account(
            role=role,
            username=username,
            password_hash=auth.passwords.hash(password),
            expires_at=expires,
        )
        db.add(row)
        db.flush()
        identifier = row.id
    client = TestClient(app, headers=owner.headers)
    if expires is None:
        assert (
            client.post(
                "/api/v1/auth/login", json={"username": username, "password": password}
            ).status_code
            == 200
        )
    return identifier, client, {"username": username, "password": password}


def case_row(admin, identifier):
    response = admin.get("/api/v1/admin/cases", params={"q": identifier})
    assert response.status_code == 200
    return response.json()["items"][0]


def assign(admin, case, target, version):
    return admin.post(
        f"/api/v1/admin/cases/{case}/assignment",
        json={"counsellor_id": target, "expected_version": version},
    )


def test_exclusive_reassignment_reopen_clear_and_safe_audit(ready, accounts, caplog):
    owner, first, task, case, consent = ready
    assert action(first, task, "START_REVIEW").status_code == 200
    saved = first.post(f"/api/v1/review-tasks/{task}/record", json=payload()).json()
    second_id, second, credentials = new_staff(owner)
    third_id, third, _ = new_staff(owner)
    try:
        assert second.get(f"/api/v1/review-tasks/{task}").status_code == 404
        with staff(owner, accounts) as administrator:
            initial = case_row(administrator, case)
            assert initial["assignment_state"] == "ASSIGNED" and initial["assignment_count"] == 1
            result = assign(administrator, case, second_id, initial["assignment_version"])
            assert result.status_code == 200 and result.json()["assignment_count"] == 1
            assert first.get(f"/api/v1/review-tasks/{task}/record").status_code == 404
            assert first.get("/api/v1/review-queue").json()["items"] == []
            assert action(first, task, "COMPLETE_REVIEW").status_code == 404
            assert second.get(f"/api/v1/review-tasks/{task}/record").json() == saved
            # Matching retries are no-ops, but a stale different assignment is a conflict.
            assert (
                assign(administrator, case, second_id, initial["assignment_version"]).status_code
                == 200
            )
            assert (
                assign(administrator, case, third_id, initial["assignment_version"]).status_code
                == 409
            )
            assert action(second, task, "COMPLETE_REVIEW").status_code == 200
            current = case_row(administrator, case)
            cleared = assign(administrator, case, None, current["assignment_version"])
            assert (
                cleared.status_code == 200
                and cleared.json()["assignment_state"] == "AWAITING_ASSIGNMENT"
            )
            assert second.get(f"/api/v1/review-tasks/{task}/record").status_code == 404
            summary = administrator.get("/api/v1/admin/overview").json()
            assert summary["eligible_cases"] == summary["awaiting_assignment"] == 1
            assert summary["assigned_cases"] == 0
            events = administrator.get(
                "/api/v1/admin/audit-events", params={"case_id": case, "event_type": "ASSIGNMENT"}
            ).json()
            assert {e["outcome"] for e in events["items"]} == {
                "AUTO_GRANTED",
                "REASSIGNED",
                "CLEARED",
            }
            assert sum(e["outcome"] == "REASSIGNED" for e in events["items"]) == 1
            for sensitive in (
                TEXT,
                consent,
                credentials["username"],
                credentials["password"],
                "DISCUSSION_OFFERED",
            ):
                assert (
                    sensitive not in str(current)
                    and sensitive not in str(events)
                    and sensitive not in caplog.text
                )
            owner.post(
                f"/api/v1/consents/{consent}/withdraw", json={"idempotency_key": str(uuid4())}
            )
            assert (
                assign(
                    administrator, case, second_id, cleared.json()["assignment_version"]
                ).status_code
                == 403
            )
            assert not case_row(administrator, case)["assignment_eligible"]
    finally:
        second.close()
        third.close()


@pytest.mark.parametrize("policy", ["MANUAL", "DESIGNATED_DEVELOPMENT"])
def test_assignment_policy_and_processing_eligibility(
    student_client, accounts, monkeypatch, policy
):
    monkeypatch.setenv("ASSIGNMENT_POLICY", policy)
    settings.cache_clear()
    response, _ = submit_fixture(student_client)
    case = response.json()["case_id"]
    with staff(student_client, accounts) as administrator:
        initial = case_row(administrator, case)
        assert not initial["assignment_eligible"]
        assert (
            assign(
                administrator, case, accounts["COUNSELLOR"][0], initial["assignment_version"]
            ).status_code
            == 409
        )
        assert (
            administrator.post(
                f"/api/v1/cases/{case}/assign", json={"counsellor_id": accounts["COUNSELLOR"][0]}
            ).status_code
            == 409
        )
        process_job(*claim_job(), adapter=synthetic_adapter)
        current = case_row(administrator, case)
        assert current["assignment_state"] == (
            "AWAITING_ASSIGNMENT" if policy == "MANUAL" else "ASSIGNED"
        )
        assert administrator.get("/api/v1/admin/overview").json()["assignment_policy"] == policy
        assigned = assign(
            administrator, case, accounts["COUNSELLOR"][0], current["assignment_version"]
        )
        assert assigned.status_code == 200 and assigned.json()["assignment_state"] == "ASSIGNED"


def test_expired_designated_counsellor_leaves_awaiting_assignment(student_client, accounts):
    with Session(engine()) as db, db.begin():
        db.get(Account, accounts["COUNSELLOR"][0]).expires_at = now() - timedelta(seconds=1)
    response, _ = submit_fixture(student_client)
    process_job(*claim_job(), adapter=synthetic_adapter)
    with staff(student_client, accounts) as administrator:
        current = case_row(administrator, response.json()["case_id"])
        assert current["assignment_state"] == "AWAITING_ASSIGNMENT"
        assert (
            assign(
                administrator,
                current["case_id"],
                accounts["COUNSELLOR"][0],
                current["assignment_version"],
            ).status_code
            == 403
        )
        assert (
            administrator.get("/api/v1/admin/overview").json()["designated_counsellor_available"]
            is False
        )


def test_staff_disable_role_change_and_reenable_revoke_sessions(ready, accounts):
    owner, _, _, _, _ = ready
    identifier, other, credentials = new_staff(owner)
    try:
        with staff(owner, accounts) as administrator:
            row = administrator.get("/api/v1/admin/staff", params={"q": identifier}).json()[
                "items"
            ][0]
            assert row["usable"] and "username" not in str(row) and "password" not in str(row)
            update = {
                "role": "COUNSELLOR",
                "enabled": False,
                "expected_updated_at": row["updated_at"],
            }
            disabled = administrator.post(f"/api/v1/admin/staff/{identifier}", json=update)
            assert disabled.status_code == 200 and not disabled.json()["enabled"]
            assert other.get("/api/v1/auth/me").status_code == 401
            assert other.post("/api/v1/auth/refresh").status_code == 401
            assert (
                administrator.post(f"/api/v1/admin/staff/{identifier}", json=update).status_code
                == 200
            )
            assert (
                administrator.post(
                    f"/api/v1/admin/staff/{identifier}", json={**update, "enabled": True}
                ).status_code
                == 409
            )
            enabled = administrator.post(
                f"/api/v1/admin/staff/{identifier}",
                json={
                    **update,
                    "enabled": True,
                    "expected_updated_at": disabled.json()["updated_at"],
                },
            )
            assert enabled.status_code == 200
            assert (
                other.get("/api/v1/auth/me").status_code == 401
            )  # Reenable never restores old tokens.
            assert other.post("/api/v1/auth/login", json=credentials).status_code == 200
            changed = administrator.post(
                f"/api/v1/admin/staff/{identifier}",
                json={
                    "role": "RESEARCHER",
                    "enabled": True,
                    "expected_updated_at": enabled.json()["updated_at"],
                },
            )
            assert changed.status_code == 200
            assert other.get("/api/v1/auth/me").status_code == 401
            assert other.post("/api/v1/auth/refresh").status_code == 401
            assert other.post("/api/v1/auth/login", json=credentials).status_code == 200
            assert other.get("/api/v1/component-routes").status_code == 200
            assert other.get("/api/v1/review-queue").status_code == 403
            assert other.get("/api/v1/admin/staff").status_code == 403
    finally:
        other.close()


def test_last_usable_admin_and_self_change_requires_new_login(ready, accounts):
    owner, _, _, _, _ = ready
    with staff(owner, accounts) as administrator:
        admin_id = accounts["ADMIN"][0]
        row = administrator.get("/api/v1/admin/staff", params={"q": admin_id}).json()["items"][0]
        for role, enabled in (("COUNSELLOR", True), ("ADMIN", False)):
            result = administrator.post(
                f"/api/v1/admin/staff/{admin_id}",
                json={"role": role, "enabled": enabled, "expected_updated_at": row["updated_at"]},
            )
            assert result.status_code == 409
        expired_id, expired, _ = new_staff(owner, "ADMIN", now() - timedelta(seconds=1))
        assert expired_id
        expired.close()
        assert (
            administrator.post(
                f"/api/v1/admin/staff/{admin_id}",
                json={"role": "ADMIN", "enabled": False, "expected_updated_at": row["updated_at"]},
            ).status_code
            == 409
        )
        _, second, _ = new_staff(owner, "ADMIN")
        try:
            assert (
                administrator.post(
                    f"/api/v1/admin/staff/{admin_id}",
                    json={
                        "role": "COUNSELLOR",
                        "enabled": True,
                        "expected_updated_at": row["updated_at"],
                    },
                ).status_code
                == 200
            )
            assert administrator.get("/api/v1/admin/overview").status_code == 401
            assert second.get("/api/v1/admin/overview").status_code == 200
        finally:
            second.close()


def test_new_admin_endpoints_role_boundaries(ready, accounts):
    owner, reviewer, _, case, _ = ready
    paths = ("/api/v1/admin/overview", "/api/v1/admin/staff", "/api/v1/admin/cases")

    def denied_staff_change(client):
        assert (
            client.post(
                f"/api/v1/admin/staff/{uuid4()}",
                json={
                    "role": "ADMIN",
                    "enabled": True,
                    "expected_updated_at": now().isoformat(),
                },
            ).status_code
            == 403
        )

    for client in (owner, reviewer):
        assert all(client.get(path).status_code == 403 for path in paths)
        assert assign(client, case, None, "0" * 64).status_code == 403
        denied_staff_change(client)
    with staff(owner, accounts, "RESEARCHER") as researcher:
        assert all(researcher.get(path).status_code == 403 for path in paths)
        denied_staff_change(researcher)
        routes = researcher.get("/api/v1/component-routes").json()
        assert len(routes["items"]) == 3 and all(
            item["web_path"] is None for item in routes["items"]
        )
    assert owner.get("/api/v1/component-routes").status_code == 403
    assert reviewer.get("/api/v1/component-routes").status_code == 200
    with TestClient(app) as anonymous:
        assert anonymous.get("/api/v1/component-routes").status_code == 401


@pytest.mark.parametrize(
    "path,params",
    [
        ("staff", {"role": "STUDENT"}),
        ("staff", {"q": "%' OR 1=1"}),
        ("staff", {"limit": 21}),
        ("cases", {"offset": 10001}),
        ("cases", {"state": "UNKNOWN"}),
        ("cases", {"assignment": "PUBLIC"}),
    ],
)
def test_admin_filters_are_bounded(ready, accounts, path, params):
    owner, _, _, _, _ = ready
    with staff(owner, accounts) as administrator:
        assert administrator.get("/api/v1/admin/" + path, params=params).status_code == 422


def test_staff_and_assignment_input_validation(ready, accounts):
    owner, _, _, case, _ = ready
    with staff(owner, accounts) as administrator:
        for body in (
            {"counsellor_id": str(uuid4()), "expected_version": "bad"},
            {"counsellor_id": "bad", "expected_version": "0" * 64},
        ):
            assert (
                administrator.post(f"/api/v1/admin/cases/{case}/assignment", json=body).status_code
                == 422
            )
        row = administrator.get("/api/v1/admin/staff").json()["items"][0]
        for body in ({"role": "STUDENT", "enabled": True}, {"role": "ADMIN", "enabled": "yes"}):
            assert (
                administrator.post(
                    f"/api/v1/admin/staff/{row['account_id']}",
                    json={**body, "expected_updated_at": row["updated_at"]},
                ).status_code
                == 422
            )


def test_local_provisioning_hides_credentials(platform, monkeypatch, capsys):
    username, password = secrets.token_urlsafe(30), secrets.token_urlsafe(36)
    monkeypatch.setenv("STAFF_USERNAME", username)
    monkeypatch.setenv("STAFF_PASSWORD", password)
    provision("COUNSELLOR")
    receipt = capsys.readouterr().out
    assert username not in receipt and password not in receipt
    with Session(engine()) as db:
        account = db.scalar(select(Account).where(Account.username == username))
        assert account and auth.passwords.verify(password, account.password_hash)
    with pytest.raises(SystemExit):
        provision("ADMIN")  # Same handle cannot silently change roles or credentials.
