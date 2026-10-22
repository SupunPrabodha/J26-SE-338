from datetime import timedelta
from uuid import uuid4

import jwt
import pytest
from conftest import submit_fixture
from orchestrator.auth import AUDIENCE
from orchestrator.workflow import claim_job, process_job
from research_common.config import settings
from research_common.database import AuthSession, Consent, engine
from research_contracts import now
from sqlalchemy import select
from sqlalchemy.orm import Session

from scripts.synthetic_runtime import synthetic_adapter


def expire_access(client):
    # Expire only the synthetic token, not server settings or refresh/consent lifetime.
    for cookie in client.cookies.jar:
        if cookie.name == "j26_access":
            claims = jwt.decode(
                cookie.value,
                settings().jwt_secret.get_secret_value(),
                algorithms=["HS256"],
                audience=AUDIENCE,
            )
            claims["exp"] = now() - timedelta(seconds=1)
            cookie.value = jwt.encode(
                claims, settings().jwt_secret.get_secret_value(), algorithm="HS256"
            )


def test_access_expiry_refresh_keeps_owner_and_consent_deadline(student_client):
    client = student_client
    owner = client.get("/api/v1/auth/me").json()["account_id"]
    consent = client.post("/api/v1/consents", json={"consent_status": "ACTIVE"}).json()
    expire_access(client)
    denied = client.get("/api/v1/demo/runs")
    assert denied.status_code == 401 and denied.json()["error_code"] == "AUTH_INVALID"
    assert client.post("/api/v1/auth/refresh").status_code == 200
    assert client.get("/api/v1/auth/me").json()["account_id"] == owner
    current = client.get(f"/api/v1/consents/{consent['consent_id']}").json()
    assert current == consent
    assert client.get("/api/v1/demo/runs").json()["runs"][0]["run_id"] == consent["consent_id"]


@pytest.mark.parametrize("state", ["WITHDRAWN", "EXPIRED", "REJECTED"])
def test_refresh_never_reactivates_blocked_consent(student_client, state):
    client = student_client
    _, body = submit_fixture(client)
    with Session(engine()) as db, db.begin():
        db.get(Consent, body["consent_id"]).status = state
    expire_access(client)
    assert client.post("/api/v1/auth/refresh").status_code == 200
    response = client.post("/api/v1/submissions", json=body)
    assert response.status_code == 403 and response.json()["error_code"] == "CONSENT_INVALID"
    assert client.get(f"/api/v1/consents/{body['consent_id']}").json()["consent_status"] == state


@pytest.mark.parametrize("revoked", [False, True])
def test_expired_or_revoked_refresh_requires_sign_in(student_client, revoked):
    with Session(engine()) as db, db.begin():
        record = db.scalar(select(AuthSession))
        if revoked:
            record.revoked = True
        else:
            record.expires_at = now() - timedelta(seconds=1)
    response = student_client.post("/api/v1/auth/refresh")
    assert response.status_code == 401 and response.json()["error_code"] == "AUTH_INVALID"
    assert student_client.get("/api/v1/auth/me").status_code == 401


def test_counsellor_review_continues_after_access_expiry(student_client, accounts):
    client = student_client
    submit_fixture(client)
    process_job(*claim_job(), adapter=synthetic_adapter)
    _, username, password = accounts["COUNSELLOR"]
    assert (
        client.post(
            "/api/v1/auth/login", json={"username": username, "password": password}
        ).status_code
        == 200
    )
    task = client.get("/api/v1/review-tasks").json()[0]["task_id"]
    expire_access(client)
    assert client.get("/api/v1/review-tasks").status_code == 401
    assert client.post("/api/v1/auth/refresh").status_code == 200
    for action in ("START_REVIEW", "COMPLETE_REVIEW"):
        assert (
            client.post(
                f"/api/v1/review-tasks/{task}/actions",
                json={"action": action, "idempotency_key": str(uuid4())},
            ).status_code
            == 200
        )
    assert client.post("/api/v1/auth/logout").status_code == 204
    assert client.post("/api/v1/auth/refresh").status_code == 401
