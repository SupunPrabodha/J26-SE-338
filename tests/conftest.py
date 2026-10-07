import secrets
from collections import defaultdict
from datetime import timedelta
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from orchestrator import auth
from orchestrator.main import app
from research_common import service_auth, web
from research_common.config import settings
from research_common.database import Account, engine
from research_contracts import now
from sqlalchemy.orm import Session


class MemoryRedis:
    def __init__(self):
        self.data = {}
        self.counts = defaultdict(int)

    def get(self, key):
        return self.data.get(key)

    def set(self, key, value, **kwargs):
        self.data[key] = value

    def delete(self, key):
        self.data.pop(key, None)

    def ping(self):
        return True

    def eval(self, script, count, key):
        self.counts[key] += 1
        return self.counts[key]


@pytest.fixture
def platform(tmp_path, monkeypatch):
    for key in ("JWT_SECRET", "PREPROCESSING_SECRET", "NLP_SECRET", "XAI_SECRET"):
        monkeypatch.setenv(key, secrets.token_urlsafe(48))
    monkeypatch.setenv("DATABASE_URL", "sqlite:///" + str(tmp_path / "test.db"))
    monkeypatch.setenv("DEV_COUNSELLOR_USERNAME", "synthetic-reviewer")
    monkeypatch.setenv("COOKIE_SECURE", "false")
    settings.cache_clear()
    engine.cache_clear()
    cache = MemoryRedis()
    for module in (web, auth, service_auth):
        monkeypatch.setattr(module, "redis_client", lambda: cache)
    command.upgrade(Config("alembic.ini"), "head")
    client = TestClient(
        app, headers={"Origin": "http://localhost:3000", "X-Requested-With": "j26-browser"}
    )
    yield client, cache
    client.close()
    engine().dispose()
    engine.cache_clear()
    settings.cache_clear()


@pytest.fixture
def student_client(platform):
    client, _ = platform
    assert client.post("/api/v1/auth/student-session").status_code == 200
    return client


@pytest.fixture
def accounts(platform):
    passwords = {role: secrets.token_urlsafe(36) for role in ("COUNSELLOR", "ADMIN", "RESEARCHER")}
    ids = {}
    with Session(engine()) as db, db.begin():
        for role, password in passwords.items():
            name = "synthetic-reviewer" if role == "COUNSELLOR" else f"synthetic-{role.lower()}"
            account = Account(username=name, password_hash=auth.passwords.hash(password), role=role)
            db.add(account)
            db.flush()
            ids[role] = (account.id, name, password)
    return ids


def submit_fixture(client, **changes):
    from research_contracts import FIXTURES

    consent = client.post("/api/v1/consents", json={"consent_status": "ACTIVE"}).json()
    body = {
        "consent_id": consent["consent_id"],
        "idempotency_key": str(uuid4()),
        "fixture_id": "english",
        "text": FIXTURES["english"],
        **changes,
    }
    return client.post("/api/v1/submissions", json=body), body


def expired():
    return now() - timedelta(seconds=5)
