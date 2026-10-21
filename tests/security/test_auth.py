import secrets
from datetime import timedelta
from uuid import uuid4

import jwt
import pytest
from orchestrator.auth import AUDIENCE, ISSUER
from research_common.config import settings
from research_common.database import Account, AuthSession, engine
from research_common.mocks import mock_app
from research_common.service_auth import service_token
from research_contracts import FIXTURES, now
from sqlalchemy import select
from sqlalchemy.orm import Session


def test_missing_token(platform):
    assert platform[0].get("/api/v1/auth/me").status_code == 401


@pytest.mark.parametrize(
    "change",
    [
        "signature",
        "expired",
        "issuer",
        "audience",
        "future",
        "missing_jti",
        "algorithm",
        "unknown_jti",
        "disabled",
        "revoked",
    ],
)
def test_invalid_tokens(student_client, change):
    client = student_client
    token = client.cookies.get("j26_access")
    secret = settings().jwt_secret.get_secret_value()
    claims = jwt.decode(token, secret, algorithms=["HS256"], audience=AUDIENCE, issuer=ISSUER)
    if change == "signature":
        secret = secrets.token_urlsafe(48)
    elif change == "expired":
        claims["exp"] = now() - timedelta(seconds=1)
    elif change == "issuer":
        claims["iss"] = "wrong"
    elif change == "audience":
        claims["aud"] = "wrong"
    elif change == "future":
        claims["iat"] = now() + timedelta(minutes=1)
    elif change == "missing_jti":
        del claims["jti"]
    elif change == "unknown_jti":
        claims["jti"] = str(uuid4())
    elif change in {"disabled", "revoked"}:
        with Session(engine()) as db, db.begin():
            if change == "disabled":
                db.get(Account, claims["sub"]).enabled = False
            else:
                db.scalar(
                    select(AuthSession).where(AuthSession.access_jti == claims["jti"])
                ).revoked = True
    token = jwt.encode(claims, secret, algorithm="HS384" if change == "algorithm" else "HS256")
    client.cookies.clear()
    client.cookies.set("j26_access", token)
    assert client.get("/api/v1/auth/me").status_code == 401


def test_claims_cookies_refresh_replay_and_logout(student_client):
    client = student_client
    initial = client.cookies.get("j26_access")
    old_refresh = client.cookies.get("j26_refresh")
    claims = jwt.decode(
        initial, settings().jwt_secret.get_secret_value(), algorithms=["HS256"], audience=AUDIENCE
    )
    assert set(claims) == {"sub", "role", "iss", "aud", "iat", "exp", "jti"}
    response = client.post("/api/v1/auth/refresh")
    assert response.status_code == 200
    assert all(
        "HttpOnly" in cookie and "SameSite=strict" in cookie
        for cookie in response.headers.get_list("set-cookie")
    )
    new_access = client.cookies.get("j26_access")
    client.cookies.clear()
    client.cookies.set("j26_access", initial)
    assert client.get("/api/v1/auth/me").status_code == 401
    client.cookies.clear()
    client.cookies.set("j26_refresh", old_refresh)
    assert client.post("/api/v1/auth/refresh").status_code == 401
    client.cookies.set("j26_access", new_access)
    assert client.get("/api/v1/auth/me").status_code == 401
    assert client.post("/api/v1/auth/logout").status_code == 204


def test_login_roles_errors_rate_limit(platform, accounts):
    client, _ = platform
    _, username, password = accounts["ADMIN"]
    assert (
        client.post(
            "/api/v1/auth/login", json={"username": username, "password": password}
        ).status_code
        == 200
    )
    assert client.get("/api/v1/review-tasks").status_code == 403
    first = client.post(
        "/api/v1/auth/login", json={"username": "absent", "password": secrets.token_urlsafe(24)}
    )
    second = client.post(
        "/api/v1/auth/login", json={"username": username, "password": secrets.token_urlsafe(24)}
    )
    assert first.status_code == second.status_code == 401
    assert first.json()["message"] == second.json()["message"]
    for _ in range(9):
        response = client.post(
            "/api/v1/auth/login", json={"username": "absent", "password": secrets.token_urlsafe(24)}
        )
    assert response.status_code == 429


def test_csrf(student_client):
    assert (
        student_client.post(
            "/api/v1/consents",
            json={"consent_status": "ACTIVE"},
            headers={"Origin": "https://untrusted.invalid"},
        ).status_code
        == 403
    )


@pytest.mark.parametrize(
    "name,path", [("preprocessing", "preprocess"), ("nlp", "infer"), ("xai", "explain")]
)
def test_service_requires_credentials(platform, name, path):
    from fastapi.testclient import TestClient

    with TestClient(mock_app(name)) as client:
        assert client.post(f"/internal/v1/{path}", json={}).status_code == 401


def test_service_revocation_and_scope(platform):
    from fastapi.testclient import TestClient

    client = TestClient(mock_app("preprocessing"))
    payload = {
        "case_id": str(uuid4()),
        "correlation_id": str(uuid4()),
        "idempotency_key": str(uuid4()),
        "text": FIXTURES["english"],
    }
    token = service_token("preprocessing")
    headers = {"Authorization": "Bearer " + token}
    assert client.post("/internal/v1/preprocess", json=payload, headers=headers).status_code == 200
    assert (
        client.post(
            "/internal/v1/preprocess",
            json=payload,
            headers={"Authorization": "Bearer " + service_token("nlp")},
        ).status_code
        == 401
    )
    platform[1].set("j26:service-disabled:preprocessing", "disabled")
    assert client.post("/internal/v1/preprocess", json=payload, headers=headers).status_code == 401
