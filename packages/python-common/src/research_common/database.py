from datetime import UTC
from functools import lru_cache
from uuid import uuid4

from research_contracts import now
from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    create_engine,
    event,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column
from sqlalchemy.types import TypeDecorator

from research_common.config import settings


class UTCDateTime(TypeDecorator):
    impl = DateTime(timezone=True)
    cache_ok = True

    def process_result_value(self, value, dialect):
        return value.replace(tzinfo=UTC) if value and value.tzinfo is None else value


class Base(DeclarativeBase):
    pass


class Entity:
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    created_at: Mapped[object] = mapped_column(UTCDateTime, default=now)
    updated_at: Mapped[object] = mapped_column(UTCDateTime, default=now, onupdate=now)


class Account(Entity, Base):
    __tablename__ = "access_accounts"
    __table_args__ = (
        CheckConstraint("role IN ('STUDENT','COUNSELLOR','ADMIN','RESEARCHER','SERVICE')"),
    )
    username: Mapped[str | None] = mapped_column(String(100), unique=True)
    password_hash: Mapped[str | None] = mapped_column(String(256))
    role: Mapped[str] = mapped_column(String(20))
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    expires_at: Mapped[object | None] = mapped_column(UTCDateTime)


class AuthSession(Entity, Base):
    __tablename__ = "access_sessions"
    account_id: Mapped[str] = mapped_column(ForeignKey("access_accounts.id"), index=True)
    access_jti: Mapped[str] = mapped_column(String(36), unique=True)
    refresh_hash: Mapped[str] = mapped_column(String(64), unique=True)
    family_id: Mapped[str] = mapped_column(String(36), index=True)
    expires_at: Mapped[object] = mapped_column(UTCDateTime)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)


class Consent(Entity, Base):
    __tablename__ = "linkage_consents"
    account_id: Mapped[str] = mapped_column(ForeignKey("access_accounts.id"), index=True)
    status: Mapped[str] = mapped_column(String(20))
    version: Mapped[str] = mapped_column(String(30), default="dev-notice-1")
    purpose: Mapped[str] = mapped_column(String(80))
    expires_at: Mapped[object] = mapped_column(UTCDateTime, index=True)
    __table_args__ = (
        CheckConstraint(
            "status IN ('PENDING','ACTIVE','EXPIRED','WITHDRAWN','REJECTED','INVALID')"
        ),
    )


class CaseLink(Base):
    __tablename__ = "linkage_cases"
    case_id: Mapped[str] = mapped_column(ForeignKey("workflow_cases.id"), primary_key=True)
    consent_id: Mapped[str] = mapped_column(ForeignKey("linkage_consents.id"), unique=True)
    account_id: Mapped[str] = mapped_column(ForeignKey("access_accounts.id"), index=True)
    idempotency_key: Mapped[str] = mapped_column(String(36))
    request_hash: Mapped[str] = mapped_column(String(64))
    __table_args__ = (UniqueConstraint("account_id", "idempotency_key"),)


class Case(Entity, Base):
    __tablename__ = "workflow_cases"
    correlation_id: Mapped[str] = mapped_column(String(36), unique=True)
    status: Mapped[str] = mapped_column(String(30), default="RECEIVED", index=True)
    error_code: Mapped[str | None] = mapped_column(String(40))
    inference: Mapped[dict | None] = mapped_column(JSON)
    explanation: Mapped[dict | None] = mapped_column(JSON)
    provenance: Mapped[dict | None] = mapped_column(JSON)
    expires_at: Mapped[object] = mapped_column(UTCDateTime, index=True)
    __table_args__ = (
        CheckConstraint(
            "status IN ('RECEIVED','CONSENT_VERIFIED','PREPROCESSING','INFERENCE','EXPLANATION','READY_FOR_REVIEW','UNDER_REVIEW','COMPLETED','FAILED','WITHDRAWAL_REQUESTED','WITHDRAWN')"
        ),
    )


class Job(Entity, Base):
    __tablename__ = "workflow_jobs"
    case_id: Mapped[str] = mapped_column(ForeignKey("workflow_cases.id"), unique=True)
    fixture_id: Mapped[str | None] = mapped_column(String(20))
    idempotency_key: Mapped[str] = mapped_column(String(36))
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(20), default="QUEUED", index=True)
    lease_until: Mapped[object | None] = mapped_column(UTCDateTime, index=True)
    __table_args__ = (CheckConstraint("attempts >= 0 AND attempts <= 3"),)


class Assignment(Entity, Base):
    __tablename__ = "review_assignments"
    case_id: Mapped[str] = mapped_column(ForeignKey("workflow_cases.id"), index=True)
    counsellor_id: Mapped[str] = mapped_column(ForeignKey("access_accounts.id"), index=True)
    __table_args__ = (UniqueConstraint("case_id", "counsellor_id"),)


class Review(Entity, Base):
    __tablename__ = "review_tasks"
    case_id: Mapped[str] = mapped_column(ForeignKey("workflow_cases.id"), unique=True)


class ReviewAction(Entity, Base):
    __tablename__ = "review_actions"
    task_id: Mapped[str] = mapped_column(ForeignKey("review_tasks.id"), index=True)
    actor_id: Mapped[str] = mapped_column(ForeignKey("access_accounts.id"))
    action: Mapped[str] = mapped_column(String(30))
    idempotency_key: Mapped[str] = mapped_column(String(36), unique=True)


class Withdrawal(Entity, Base):
    __tablename__ = "linkage_withdrawals"
    case_id: Mapped[str] = mapped_column(ForeignKey("workflow_cases.id"), unique=True)
    idempotency_key: Mapped[str] = mapped_column(String(36))


class Retention(Entity, Base):
    __tablename__ = "workflow_retention"
    case_id: Mapped[str] = mapped_column(ForeignKey("workflow_cases.id"), unique=True)
    status: Mapped[str] = mapped_column(String(20), default="COMPLETED")
    reason: Mapped[str] = mapped_column(String(30), default="RETENTION")


class ConsentWithdrawal(Entity, Base):
    __tablename__ = "linkage_consent_withdrawals"
    consent_id: Mapped[str] = mapped_column(ForeignKey("linkage_consents.id"), unique=True)
    idempotency_key: Mapped[str] = mapped_column(String(36))


class Audit(Base):
    __tablename__ = "audit_events"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    case_id: Mapped[str | None] = mapped_column(String(36), index=True)
    correlation_id: Mapped[str] = mapped_column(String(36), index=True)
    event_type: Mapped[str] = mapped_column(String(30))
    status: Mapped[str] = mapped_column(String(40))
    created_at: Mapped[object] = mapped_column(UTCDateTime, default=now)
    service_version: Mapped[str] = mapped_column(String(20), default="0.1.0")
    policy_expires_at: Mapped[object | None] = mapped_column(UTCDateTime)
    trace_id: Mapped[str | None] = mapped_column(String(36))


@lru_cache
def engine():
    url = settings().database_url.get_secret_value()
    options = {"connect_args": {"check_same_thread": False}} if url.startswith("sqlite") else {}
    eng = create_engine(url, pool_pre_ping=True, hide_parameters=True, **options)
    if url.startswith("sqlite"):

        @event.listens_for(eng, "connect")
        def foreign_keys(connection, record):
            connection.execute("PRAGMA foreign_keys=ON")

    return eng


def session():
    with Session(engine(), expire_on_commit=False) as db:
        try:
            yield db
        except Exception:
            db.rollback()
            persist_pending_audit(db)
            raise
        else:
            persist_pending_audit(db)


def persist_pending_audit(db):
    from research_common.audit import flush_pending

    if db.info.get("pending_audit"):
        flush_pending(db)
        db.commit()
