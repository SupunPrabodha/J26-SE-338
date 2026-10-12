"""Isolated PostgreSQL schema and fixed mock calls for disposable C1 evaluations."""

import os
from contextlib import contextmanager, redirect_stdout
from datetime import timedelta
from io import StringIO
from types import SimpleNamespace
from uuid import uuid4

from alembic import command
from alembic.config import Config
from orchestrator import main
from research_common.config import settings
from research_common.database import Account, Consent, engine
from research_common.mocks import mock_app
from research_contracts import FIXTURES, PURPOSE, WorkflowRequest, now
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session


@contextmanager
def isolated_postgres():
    original = os.environ["DATABASE_URL"]
    url = make_url(original)
    if url.get_backend_name() != "postgresql":
        raise RuntimeError("PostgreSQL is required for this evaluation")
    schema = "c1_eval_" + uuid4().hex
    admin_engine = create_engine(url, hide_parameters=True)
    with admin_engine.begin() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    isolated = url.update_query_dict(
        {"options": f"-csearch_path={schema} -clock_timeout=10000 -cstatement_timeout=15000"}
    )
    os.environ["DATABASE_URL"] = isolated.render_as_string(hide_password=False)
    settings.cache_clear()
    engine.cache_clear()
    try:
        command.upgrade(Config("alembic.ini"), "head")
        with redirect_stdout(StringIO()):
            config = Config("alembic.ini", stdout=StringIO())
            command.check(config)
        yield
    finally:
        engine().dispose()
        engine.cache_clear()
        settings.cache_clear()
        os.environ["DATABASE_URL"] = original
        # Only the newly generated, fixed-prefix UUID schema is disposable.
        with admin_engine.begin() as connection:
            connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        admin_engine.dispose()


def request():
    return SimpleNamespace(state=SimpleNamespace(correlation_id=uuid4()))


def owner_consent():
    with Session(engine(), expire_on_commit=False) as db, db.begin():
        owner = Account(role="STUDENT", expires_at=now() + timedelta(hours=1))
        db.add(owner)
        db.flush()
        consent = Consent(
            account_id=owner.id, status="ACTIVE", purpose=PURPOSE, expires_at=owner.expires_at
        )
        db.add(consent)
        db.flush()
    return owner, consent


def submission(consent):
    return WorkflowRequest(
        consent_id=consent.id,
        idempotency_key=uuid4(),
        fixture_id="english",
        text=FIXTURES["english"],
    )


def create_case():
    owner, consent = owner_consent()
    with Session(engine(), expire_on_commit=False) as db:
        case = main.submit(submission(consent), request(), owner, db)
    return owner, consent, str(case.case_id)


MOCKS = {name: mock_app(name) for name in ("preprocessing", "nlp", "xai")}


def synthetic_adapter(name, path, body, response_type):
    # Invoke the existing fixed provider endpoint, excluding network/auth transport.
    endpoint = next(route.endpoint for route in MOCKS[name].routes if route.path == path)
    return response_type.model_validate(endpoint(body))
