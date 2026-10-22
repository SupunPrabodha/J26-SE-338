"""Development-only C2 annotation of allowlisted, privacy-cleared synthetic items."""

import hashlib
import json

from fastapi import APIRouter, Depends, Request
from research_common.database import session
from research_common.web import SafeError
from research_contracts import (
    C2AnnotationAnswer,
    C2AnnotationDetail,
    C2AnnotationItem,
    C2AnnotationLabels,
    C2AnnotationPrepareRequest,
    C2AnnotationQueue,
    C2AnnotationRevision,
    C2AnnotationSaveRequest,
    C2AnnotationSubmission,
    C2AnnotationSubmissionQueue,
    C2DemoRequest,
    C2DemoResponse,
    ErrorCode,
    Role,
)
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from orchestrator import auth
from orchestrator.c2_annotation_store import (
    AnnotationRecord,
    AnnotationRevision,
    AnnotationSlot,
    AnnotationSubmission,
    SubmissionAnswer,
    SubmissionAssignment,
)

SCHEMA = "c2-dataset-annotation-v1"
VOCABULARY = "c2-provisional-vocabulary-v1"
DIMENSIONS = ("language", "code_mixing", "emotion", "wellbeing")
# Server-owned catalogue IDs only. Deliberately include blocked controls so the
# actual pipeline, not a fixture's expected label, decides queue eligibility.
SAMPLES = (
    "english-ordinary",
    "sinhala",
    "romanized",
    "code-mixed",
    "short",
    "empty",
    "placeholder-only",
)
annotator = auth.require_role(Role.COUNSELLOR, Role.ADMIN)


def development_only():
    from orchestrator.demo import development_demo

    development_demo()


router = APIRouter(prefix="/api/v1/c2-annotations", dependencies=[Depends(development_only)])


def vocabulary():
    properties = C2AnnotationLabels.model_json_schema()["properties"]
    return {
        key: next(option["enum"] for option in properties[key]["anyOf"] if "enum" in option)
        for key in DIMENSIONS
    }


def item(row):
    return C2AnnotationItem(
        record_id=row.record_id,
        record_version=row.record_version,
        pipeline_version=row.pipeline_version,
        annotation_schema_version=row.annotation_schema_version,
        vocabulary_version=row.vocabulary_version,
        preprocessing=row.snapshot,
    )


def locked_record(db, record_id, actor_id):
    answer = db.scalar(
        select(SubmissionAnswer).where(SubmissionAnswer.source_record_id == record_id)
    )
    if (
        answer is not None
        and db.get(SubmissionAssignment, (answer.submission_id, actor_id)) is None
    ):
        raise SafeError(ErrorCode.NOT_FOUND, 404)
    row = db.scalar(
        select(AnnotationRecord).where(AnnotationRecord.record_id == record_id).with_for_update()
    )
    if row is None:
        raise SafeError(ErrorCode.NOT_FOUND, 404)
    return row


def detail(db, row, actor_id):
    revisions = db.scalars(
        select(AnnotationRevision)
        .where(AnnotationRevision.record_id == row.record_id)
        .order_by(AnnotationRevision.revision)
    ).all()
    own = [revision for revision in revisions if revision.actor_id == actor_id]
    finals = [revision for revision in revisions if revision.status == "FINAL"]
    own_final = bool(own and own[-1].status == "FINAL")
    slots = db.scalars(
        select(AnnotationSlot).where(AnnotationSlot.record_id == row.record_id)
    ).all()

    def public(revision):
        return C2AnnotationRevision(
            revision=revision.revision,
            status=revision.status,
            labels=revision.labels,
            saved_at=revision.saved_at,
        )

    return C2AnnotationDetail(
        item=item(row),
        own_history=[public(revision) for revision in own],
        finalized_count=len(finals),
        annotation_status="PAIR_FINALIZED"
        if own_final and len(finals) == 2
        else "SUBMITTED"
        if own_final
        else "DRAFT"
        if own
        else "PENDING",
        peer_final=next(
            (public(revision) for revision in finals if revision.actor_id != actor_id), None
        )
        if own_final and len(finals) == 2
        else None,
        can_submit=not own_final
        and (any(slot.actor_id == actor_id for slot in slots) or len(slots) < 2),
    )


@router.post("/prepare", response_model=C2AnnotationQueue)
def prepare(
    body: C2AnnotationPrepareRequest,
    request: Request,
    account=Depends(annotator),
    db: Session = Depends(session),
):
    from preprocessing.language_id import VERSION as LANGUAGE_VERSION
    from preprocessing.span_evaluation import SELECTION_VERSION
    from preprocessing.text_processing import NORMALIZATION_METHOD, TOKENIZATION_METHOD

    from orchestrator.demo import forward

    pipeline_version = "|".join(
        (SELECTION_VERSION, LANGUAGE_VERSION, NORMALIZATION_METHOD, TOKENIZATION_METHOD)
    )
    for scenario in SAMPLES:
        if db.get(AnnotationRecord, scenario) is not None:
            continue
        actual = forward(
            request,
            "runs",
            C2DemoResponse,
            C2DemoRequest(scenario_id=scenario, strategy="presidio"),
        )
        if not (
            actual.release_ready
            and actual.privacy_summary.status == "PASSED"
            and len(actual.records) == 1
            and actual.records[0].quality_status == "PASS"
            and not actual.records[0].requires_privacy_review
        ):
            continue
        snapshot = actual.model_dump(mode="json")
        fingerprint = hashlib.sha256(
            json.dumps(
                {
                    "snapshot": snapshot,
                    "pipeline": pipeline_version,
                    "schema": SCHEMA,
                    "vocabulary": VOCABULARY,
                },
                sort_keys=True,
                ensure_ascii=True,
            ).encode()
        ).hexdigest()
        # Separate transactions tolerate simultaneous preparation by both accounts.
        try:
            db.add(
                AnnotationRecord(
                    record_id=scenario,
                    record_version=fingerprint,
                    pipeline_version=pipeline_version,
                    annotation_schema_version=SCHEMA,
                    vocabulary_version=VOCABULARY,
                    snapshot=snapshot,
                )
            )
            db.commit()
        except IntegrityError:
            db.rollback()
    return C2AnnotationQueue(
        items=[
            item(row)
            for row in db.scalars(select(AnnotationRecord).order_by(AnnotationRecord.record_id))
            if db.scalar(
                select(SubmissionAnswer).where(SubmissionAnswer.record_id == row.record_id)
            )
            is None
        ],
        vocabulary=vocabulary(),
    )


def submission_detail(db, row, actor_id):
    if db.get(SubmissionAssignment, (row.submission_id, actor_id)) is None:
        raise SafeError(ErrorCode.NOT_FOUND, 404)
    answers = []
    for answer in sorted(
        db.scalars(
            select(SubmissionAnswer).where(SubmissionAnswer.submission_id == row.submission_id)
        ),
        key=lambda value: int(value.question_id[1:]),
    ):
        annotation = (
            detail(db, db.get(AnnotationRecord, answer.record_id), actor_id)
            if answer.record_id
            else None
        )
        answers.append(
            C2AnnotationAnswer(
                question_id=answer.question_id,
                question_text=answer.question_text,
                source_record_id=answer.source_record_id,
                required=answer.question_id != "Q10",
                state=answer.state,
                blocking_reasons=answer.blocking_reasons,
                annotation=annotation,
            )
        )
    eligible = [answer for answer in answers if answer.state == "AVAILABLE"]
    finalized = sum(
        bool(answer.annotation.own_history and answer.annotation.own_history[-1].status == "FINAL")
        for answer in eligible
    )
    blocked = sum(answer.state in {"WITHHELD", "MISSING_REQUIRED"} for answer in answers)
    return C2AnnotationSubmission(
        submission_id=row.submission_id,
        submission_version=row.submission_version,
        source_dataset_id=row.provenance["dataset_id"],
        source_file_sha256=row.provenance["source_file_sha256"],
        required_answers=6,
        available_answers=len(eligible),
        finalized_answers=finalized,
        blocked_answers=blocked,
        complete=not blocked and finalized == len(eligible) and len(answers) == 7,
        answers=answers,
    )


@router.get("/submissions", response_model=C2AnnotationSubmissionQueue)
def submissions(account=Depends(annotator), db: Session = Depends(session)):
    rows = db.scalars(
        select(AnnotationSubmission)
        .join(SubmissionAssignment)
        .where(SubmissionAssignment.actor_id == account.id)
        .order_by(AnnotationSubmission.submission_id)
    )
    return C2AnnotationSubmissionQueue(
        submissions=[submission_detail(db, row, account.id) for row in rows],
        vocabulary=vocabulary(),
    )


@router.get("/submissions/{submission_id}", response_model=C2AnnotationSubmission)
def submission(submission_id: str, account=Depends(annotator), db: Session = Depends(session)):
    row = db.get(AnnotationSubmission, submission_id)
    if row is None:
        raise SafeError(ErrorCode.NOT_FOUND, 404)
    return submission_detail(db, row, account.id)


@router.get("/{record_id}", response_model=C2AnnotationDetail)
def read(record_id: str, account=Depends(annotator), db: Session = Depends(session)):
    return detail(db, locked_record(db, record_id, account.id), account.id)


@router.post("/{record_id}/revisions", response_model=C2AnnotationDetail)
def save(
    record_id: str,
    body: C2AnnotationSaveRequest,
    account=Depends(annotator),
    db: Session = Depends(session),
):
    row = locked_record(db, record_id, account.id)
    if body.record_version != row.record_version or body.pipeline_version != row.pipeline_version:
        raise SafeError(ErrorCode.CONFLICT, 409)
    current = detail(db, row, account.id)
    previous = current.own_history[-1].revision if current.own_history else 0
    if not current.can_submit or previous != body.expected_revision:
        raise SafeError(ErrorCode.CONFLICT, 409)
    if body.status == "FINAL" and any(getattr(body.labels, key) is None for key in DIMENSIONS):
        raise SafeError(ErrorCode.CONTRACT_INVALID, 422)
    try:
        if db.get(AnnotationSlot, (record_id, account.id)) is None:
            slots = db.scalars(
                select(AnnotationSlot).where(AnnotationSlot.record_id == record_id)
            ).all()
            if len(slots) >= 2:
                raise SafeError(ErrorCode.CONFLICT, 409)
            db.add(AnnotationSlot(record_id=record_id, actor_id=account.id, slot=len(slots) + 1))
        db.add(
            AnnotationRevision(
                record_id=record_id,
                actor_id=account.id,
                revision=previous + 1,
                status=body.status,
                labels=body.labels.model_dump(mode="json"),
            )
        )
        db.commit()
    except IntegrityError:
        db.rollback()
        raise SafeError(ErrorCode.CONFLICT, 409) from None
    return detail(db, row, account.id)
