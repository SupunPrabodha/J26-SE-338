"""C2-only durable synthetic snapshots and append-only label revisions."""

from research_common.database import Base, UTCDateTime
from research_contracts import now
from sqlalchemy import JSON, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column


class AnnotationRecord(Base):
    __tablename__ = "c2_annotation_records"
    record_id: Mapped[str] = mapped_column(String(80), primary_key=True)
    record_version: Mapped[str] = mapped_column(String(64))
    pipeline_version: Mapped[str] = mapped_column(String(600))
    annotation_schema_version: Mapped[str] = mapped_column(String(80))
    vocabulary_version: Mapped[str] = mapped_column(String(80))
    snapshot: Mapped[dict] = mapped_column(JSON)


class AnnotationSlot(Base):
    __tablename__ = "c2_annotation_slots"
    record_id: Mapped[str] = mapped_column(
        ForeignKey("c2_annotation_records.record_id"), primary_key=True
    )
    actor_id: Mapped[str] = mapped_column(ForeignKey("access_accounts.id"), primary_key=True)
    slot: Mapped[int] = mapped_column(Integer)
    __table_args__ = (UniqueConstraint("record_id", "slot"),)


class AnnotationRevision(Base):
    __tablename__ = "c2_annotation_revisions"
    record_id: Mapped[str] = mapped_column(
        ForeignKey("c2_annotation_records.record_id"), primary_key=True
    )
    actor_id: Mapped[str] = mapped_column(ForeignKey("access_accounts.id"), primary_key=True)
    revision: Mapped[int] = mapped_column(Integer, primary_key=True)
    status: Mapped[str] = mapped_column(String(10))
    labels: Mapped[dict] = mapped_column(JSON)
    saved_at: Mapped[object] = mapped_column(UTCDateTime, default=now)


class AnnotationSubmission(Base):
    __tablename__ = "c2_annotation_submissions"
    submission_id: Mapped[str] = mapped_column(String(80), primary_key=True)
    submission_version: Mapped[str] = mapped_column(String(64))
    provenance: Mapped[dict] = mapped_column(JSON)


class SubmissionAssignment(Base):
    __tablename__ = "c2_submission_assignments"
    submission_id: Mapped[str] = mapped_column(
        ForeignKey("c2_annotation_submissions.submission_id"), primary_key=True
    )
    actor_id: Mapped[str] = mapped_column(ForeignKey("access_accounts.id"), primary_key=True)
    slot: Mapped[int] = mapped_column(Integer)
    __table_args__ = (UniqueConstraint("submission_id", "slot"),)


class SubmissionAnswer(Base):
    __tablename__ = "c2_submission_answers"
    submission_id: Mapped[str] = mapped_column(
        ForeignKey("c2_annotation_submissions.submission_id"), primary_key=True
    )
    question_id: Mapped[str] = mapped_column(String(4), primary_key=True)
    source_record_id: Mapped[str] = mapped_column(String(80), unique=True)
    question_text: Mapped[str] = mapped_column(String(1000))
    state: Mapped[str] = mapped_column(String(30))
    record_id: Mapped[str | None] = mapped_column(ForeignKey("c2_annotation_records.record_id"))
    blocking_reasons: Mapped[list] = mapped_column(JSON)
