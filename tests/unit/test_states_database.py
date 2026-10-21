from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from orchestrator.workflow import TRANSITIONS, transition
from research_common.database import Account, Base, Case, engine
from research_common.web import SafeError
from research_contracts import now
from sqlalchemy import inspect, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session


def test_migrations_empty_and_metadata(platform):
    assert set(inspect(engine()).get_table_names()) == set(Base.metadata.tables) | {
        "alembic_version"
    }
    command.check(Config("alembic.ini"))
    command.downgrade(Config("alembic.ini"), "base")
    assert inspect(engine()).get_table_names() == ["alembic_version"]
    command.upgrade(Config("alembic.ini"), "head")


def test_role_constraint(platform):
    with Session(engine()) as db:
        db.add(Account(role="UNKNOWN"))
        with pytest.raises(IntegrityError):
            db.commit()


def test_identity_separation(platform):
    columns = set(inspect(engine()).get_columns("workflow_cases")[0])
    assert columns
    for table in ("workflow_cases", "workflow_jobs"):
        names = {column["name"] for column in inspect(engine()).get_columns(table)}
        assert not names & {"username", "password_hash", "account_id", "email", "raw_text", "text"}


def test_invalid_transition(platform):
    with Session(engine()) as db:
        case = Case(
            id=str(uuid4()), status="RECEIVED", correlation_id=str(uuid4()), expires_at=now()
        )
        with pytest.raises(SafeError):
            transition(db, case, "READY_FOR_REVIEW")
    assert TRANSITIONS["WITHDRAWN"] == set()


def test_database_connectivity(platform):
    with engine().connect() as connection:
        assert connection.scalar(text("SELECT 1")) == 1
