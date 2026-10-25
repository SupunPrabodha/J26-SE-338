from datetime import timedelta
from uuid import uuid4

import pytest
from orchestrator import auth
from research_common.config import settings
from research_common.database import AuthSession, engine
from sqlalchemy import select
from sqlalchemy.orm import Session
from test_session_continuity import expire_access


def sign_in(client, accounts, role="RESEARCHER", remember=True):
    _, username, password = accounts[role]
    response = client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": password, "remember_me": remember},
    )
    assert response.status_code == 200
    return response


@pytest.mark.parametrize("role", ["ADMIN", "COUNSELLOR", "RESEARCHER"])
@pytest.mark.parametrize("remember", [False, True])
def test_staff_persistence_is_opt_in_bounded_and_profile_is_minimal(
    platform, accounts, role, remember
):
    client = platform[0]
    response = sign_in(client, accounts, role, remember)
    cookies = response.headers.get_list("set-cookie")
    assert "Max-Age=300" in cookies[0]
    expected = settings().remembered_session_seconds if remember else settings().refresh_seconds
    assert f"Max-Age={expected}" in cookies[1]
    assert all("HttpOnly" in c and "SameSite=strict" in c and "Path=/api/v1" in c for c in cookies)
    profile = client.get("/api/v1/auth/profile")
    assert profile.status_code == 200
    assert set(profile.json()) == {
        "schema_version",
        "synthetic",
        "development_only",
        "account_id",
        "role",
        "enabled",
        "created_at",
        "account_expires_at",
        "session_expires_at",
        "remember_me",
    }
    assert profile.json()["remember_me"] is remember
    assert profile.json()["account_id"] == accounts[role][0]
    expire_access(client)
    assert client.get("/api/v1/auth/profile").status_code == 401
    assert client.post("/api/v1/auth/refresh").status_code == 200
    assert client.get("/api/v1/auth/profile").json()["remember_me"] is remember


def test_rotation_keeps_absolute_deadline_and_replay_revokes_family(
    platform, accounts, monkeypatch
):
    client = platform[0]
    sign_in(client, accounts)
    original = client.cookies.get("j26_refresh")
    with Session(engine()) as db:
        first = db.scalar(select(AuthSession))
        deadline, family = first.absolute_expires_at, first.family_id
    monkeypatch.setattr(auth, "now", lambda: deadline - timedelta(days=2))
    response = client.post("/api/v1/auth/refresh")
    assert response.status_code == 200
    assert "Max-Age=172800" in response.headers.get_list("set-cookie")[1]
    with Session(engine()) as db:
        live = db.scalar(select(AuthSession).where(AuthSession.revoked.is_(False)))
        assert live.absolute_expires_at == deadline == live.expires_at
        assert live.family_id == family
    client.cookies.clear()
    client.cookies.set("j26_refresh", original)
    assert client.post("/api/v1/auth/refresh").status_code == 401
    with Session(engine()) as db:
        assert all(row.revoked for row in db.scalars(select(AuthSession)))


@pytest.mark.parametrize("invalid", ["expired", "missing_deadline", "revoked"])
def test_remembered_session_fails_closed(platform, accounts, monkeypatch, invalid):
    client = platform[0]
    sign_in(client, accounts)
    with Session(engine()) as db, db.begin():
        row = db.scalar(select(AuthSession))
        if invalid == "expired":
            deadline = row.absolute_expires_at
        elif invalid == "missing_deadline":
            row.absolute_expires_at = None
        else:
            row.revoked = True
    if invalid == "expired":
        monkeypatch.setattr(auth, "now", lambda: deadline)
    assert client.get("/api/v1/auth/profile").status_code == 401
    assert client.post("/api/v1/auth/refresh").status_code == 401


def test_logout_clears_cookies_and_revokes_remembered_credential(platform, accounts):
    client = platform[0]
    sign_in(client, accounts)
    refresh = client.cookies.get("j26_refresh")
    response = client.post("/api/v1/auth/logout")
    assert response.status_code == 204
    assert all("Max-Age=0" in c for c in response.headers.get_list("set-cookie"))
    client.cookies.set("j26_refresh", refresh)
    assert client.post("/api/v1/auth/refresh").status_code == 401


@pytest.mark.parametrize("change", [{"enabled": False}, {"role": "COUNSELLOR"}])
def test_staff_administration_revokes_remembered_sessions(platform, accounts, change):
    client = platform[0]
    sign_in(client, accounts)
    saved = client.cookies.get("j26_refresh")
    identifier = accounts["RESEARCHER"][0]
    sign_in(client, accounts, "ADMIN", False)
    row = client.get("/api/v1/admin/staff", params={"q": identifier}).json()["items"][0]
    response = client.post(
        f"/api/v1/admin/staff/{identifier}",
        json={
            "role": "RESEARCHER",
            "enabled": True,
            "expected_updated_at": row["updated_at"],
            **change,
        },
    )
    assert response.status_code == 200
    client.cookies.clear()
    client.cookies.set("j26_refresh", saved)
    assert client.post("/api/v1/auth/refresh").status_code == 401


def test_researcher_permissions_and_student_profile_denial(student_client, accounts):
    client = student_client
    assert client.get("/api/v1/auth/profile").status_code == 403
    sign_in(client, accounts)
    assert client.get("/api/v1/component-routes").status_code == 200
    for path in [
        "/admin/overview",
        "/admin/staff",
        "/admin/audit-events",
        "/review-queue",
        "/demo/runs",
    ]:
        assert client.get("/api/v1" + path).status_code == 403
    assert client.get(f"/api/v1/review-tasks/{uuid4()}/record").status_code == 403


@pytest.mark.parametrize("value", ["true", "false", 1, None])
def test_remember_flag_is_strict_boolean(platform, accounts, value):
    _, name, password = accounts["RESEARCHER"]
    response = platform[0].post(
        "/api/v1/auth/login", json={"username": name, "password": password, "remember_me": value}
    )
    assert response.status_code == 422
    assert password not in response.text


@pytest.mark.parametrize("policy", ["withdrawn", "expired", "unassigned"])
def test_remembered_refresh_never_restores_case_permission(student_client, accounts, policy):
    from conftest import submit_fixture
    from fastapi.testclient import TestClient
    from orchestrator.main import app
    from orchestrator.workflow import claim_job, process_job
    from research_common.database import Assignment, Consent
    from research_contracts import now
    from sqlalchemy import delete

    from scripts.synthetic_runtime import synthetic_adapter

    owner = student_client
    case, body = submit_fixture(owner)
    process_job(*claim_job(), adapter=synthetic_adapter)
    with TestClient(app, headers=dict(owner.headers)) as reviewer:
        sign_in(reviewer, accounts, "COUNSELLOR")
        task = reviewer.get("/api/v1/review-tasks").json()[0]["task_id"]
        consent_before = owner.get(f"/api/v1/consents/{body['consent_id']}").json()
        if policy == "withdrawn":
            assert (
                owner.post(
                    f"/api/v1/cases/{case.json()['case_id']}/withdraw",
                    json={"idempotency_key": str(uuid4())},
                ).status_code
                == 200
            )
        else:
            with Session(engine()) as db, db.begin():
                if policy == "expired":
                    db.get(Consent, body["consent_id"]).expires_at = now()
                else:
                    db.execute(delete(Assignment))
        expire_access(reviewer)
        assert reviewer.post("/api/v1/auth/refresh").status_code == 200
        assert reviewer.get(f"/api/v1/review-tasks/{task}").status_code in {403, 404}
        if policy != "expired":
            assert (
                owner.get(f"/api/v1/consents/{body['consent_id']}").json()["expires_at"]
                == consent_before["expires_at"]
            )


def test_secure_cookie_configuration_is_retained(platform, accounts, monkeypatch):
    monkeypatch.setattr(settings(), "cookie_secure", True)
    response = sign_in(platform[0], accounts)
    assert all("Secure" in value for value in response.headers.get_list("set-cookie"))
