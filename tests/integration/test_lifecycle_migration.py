from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from research_common.database import Account, Audit, AuthSession, Case, Retention, engine
from research_contracts import now
from sqlalchemy import text
from sqlalchemy.exc import DatabaseError
from sqlalchemy.orm import Session


def test_existing_rows_survive_additive_migrations(platform):
    config = Config("alembic.ini")
    command.downgrade(config, "e2985e1a1001")
    case_id, audit_id, correlation_id, retention_id = (str(uuid4()) for _ in range(4))
    instant = now().isoformat()
    with engine().begin() as connection:
        values = dict(
            case_id=case_id,
            correlation_id=correlation_id,
            instant=instant,
            audit_id=audit_id,
            retention_id=retention_id,
        )
        connection.execute(
            text(
                "INSERT INTO workflow_cases (id, correlation_id, status, created_at, updated_at, expires_at) VALUES (:case_id, :correlation_id, 'WITHDRAWN', :instant, :instant, :instant)"
            ),
            values,
        )
        connection.execute(
            text(
                "INSERT INTO workflow_retention (id, case_id, status, created_at, updated_at) VALUES (:retention_id, :case_id, 'COMPLETED', :instant, :instant)"
            ),
            values,
        )
        connection.execute(
            text(
                "INSERT INTO audit_events (id, case_id, correlation_id, event_type, status, created_at, service_version) VALUES (:audit_id, :case_id, :correlation_id, 'RETENTION', 'DERIVED_EVIDENCE_DELETED', :instant, '0.1.0')"
            ),
            values,
        )
    command.upgrade(config, "head")
    command.check(config)
    with Session(engine()) as db:
        assert db.get(Case, case_id).status == "WITHDRAWN"
        assert db.get(Case, case_id).provenance is None
        assert db.get(Retention, retention_id).reason == "LEGACY_DISPOSAL"
        assert db.get(Audit, audit_id).status == "DERIVED_EVIDENCE_DELETED"
        assert db.get(Audit, audit_id).trace_id is None
        with pytest.raises(DatabaseError):
            db.execute(text("DELETE FROM audit_events"))


def test_legacy_sessions_keep_expiry_and_revocation_after_remembered_upgrade(platform):
    # The platform fixture supplies a unique disposable database, never the local volume.
    config = Config("alembic.ini")
    instant = now()
    with Session(engine()) as db, db.begin():
        account = Account(role="RESEARCHER")
        db.add(account)
        db.flush()
        record = AuthSession(
            account_id=account.id,
            access_jti=str(uuid4()),
            refresh_hash=str(uuid4()),
            family_id=str(uuid4()),
            expires_at=instant,
            revoked=True,
        )
        db.add(record)
        db.flush()
        identifier, family, fingerprint = record.id, record.family_id, record.refresh_hash
    command.downgrade(config, "f310c1000003")
    command.upgrade(config, "head")
    command.check(config)
    with Session(engine()) as db:
        retained = db.get(AuthSession, identifier)
        assert retained.expires_at == instant
        assert retained.revoked is True
        assert retained.family_id == family
        assert retained.refresh_hash == fingerprint
        assert retained.remembered is False
        assert retained.absolute_expires_at is None
