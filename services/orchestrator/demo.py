"""Owner-only synthetic receipts. No general audit or derived-content API."""

from uuid import NAMESPACE_URL, UUID, uuid5

from fastapi import APIRouter, Depends, Query
from pydantic import ValidationError
from research_common.database import (
    Assignment,
    Audit,
    Case,
    CaseLink,
    Consent,
    ConsentWithdrawal,
    Job,
    Retention,
    Review,
    ReviewAction,
    ReviewRecord,
    Withdrawal,
    session,
)
from research_common.web import SafeError
from research_contracts import (
    DemoEvidence,
    DemoReceipt,
    DemoRun,
    DemoRunPage,
    ErrorCode,
    Role,
    ServiceProvenance,
    WorkflowState,
    now,
)
from sqlalchemy import and_, or_, select

from orchestrator import auth
from orchestrator.workflow import active_consent

router = APIRouter(prefix="/api/v1/demo")
student = auth.require_role(Role.STUDENT)
PAIRS = {
    "CONSENT_RECORDED": {"ACTIVE", "REJECTED"},
    "CONSENT_EXPIRED": {"DETECTED"},
    "OPERATION_BLOCKED": {"SUBMISSION", "PROCESSING", "REVIEW", "CONSENT_REQUIRED"},
    "SUBMISSION_REPLAY": {"DUPLICATE", "CONCURRENT", "RECOVERED"},
    "WORKFLOW_TRANSITION": {state.value for state in WorkflowState},
    "JOB_RETRY": {"DOWNSTREAM_FAILED", "DOWNSTREAM_TIMEOUT"},
    "JOB_TERMINAL": {
        "DOWNSTREAM_FAILED",
        "DOWNSTREAM_TIMEOUT",
        "RETRY_EXHAUSTED",
        "CONTRACT_INVALID",
    },
    "HUMAN_REVIEW": {"START_REVIEW", "COMPLETE_REVIEW", "RECORD_SAVED"},
    "WITHDRAWAL": {"BEFORE_SUBMISSION", "WITHDRAWN"},
    "RETENTION": {"DERIVED_EVIDENCE_DELETED"},
}
RECEIPT_TYPES = {
    "CONSENT_RECORDED",
    "CONSENT_EXPIRED",
    "OPERATION_BLOCKED",
    "HUMAN_REVIEW",
    "WITHDRAWAL",
    "RETENTION",
}


def summary(consent, case=None):
    return DemoRun(
        run_id=consent.id,
        created_at=consent.created_at,
        consent_status="EXPIRED"
        if consent.status == "ACTIVE" and consent.expires_at <= now()
        else consent.status,
        case_id=case.id if case else None,
        processing_status=case.status if case else None,
    )


@router.get("/runs", response_model=DemoRunPage)
def runs(
    offset: int = Query(0, ge=0, le=10000),
    limit: int = Query(20, ge=1, le=20),
    account=Depends(student),
    db=Depends(session),
):
    rows = db.execute(
        select(Consent, Case)
        .outerjoin(CaseLink, CaseLink.consent_id == Consent.id)
        .outerjoin(Case, Case.id == CaseLink.case_id)
        .where(Consent.account_id == account.id)
        .order_by(Consent.created_at.desc(), Consent.id)
        .offset(offset)
        .limit(limit + 1)
    ).all()
    return DemoRunPage(
        runs=[summary(c, case) for c, case in rows[:limit]],
        next_offset=offset + limit if len(rows) > limit and offset + limit <= 10000 else None,
    )


@router.get("/runs/{run_id}", response_model=DemoEvidence)
def evidence(run_id: UUID, account=Depends(student), db=Depends(session)):
    run_id = str(run_id)
    consent = db.get(Consent, run_id)
    if not consent or consent.account_id != account.id:
        raise SafeError(ErrorCode.NOT_FOUND, 404)
    link = db.scalar(select(CaseLink).where(CaseLink.consent_id == run_id))
    if not link:
        consent = db.scalar(
            select(Consent)
            .where(Consent.id == run_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        link = db.scalar(select(CaseLink).where(CaseLink.consent_id == run_id))
        if link:
            # A submission committed while we waited. Release consent before case lock.
            case_id = link.case_id
            db.rollback()
        else:
            case_id = None
    else:
        case_id = link.case_id
    case = None
    if case_id:
        case = db.scalar(select(Case).where(Case.id == case_id).with_for_update())
        consent = db.scalar(
            select(Consent)
            .where(Consent.id == run_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
    if consent.account_id != account.id:
        raise SafeError(ErrorCode.NOT_FOUND, 404)
    valid = True
    try:
        active_consent(consent)
    except SafeError:
        valid = False
    receipt_only = not valid or bool(
        case and (case.status in {"WITHDRAWN", "WITHDRAWAL_REQUESTED"} or case.expires_at <= now())
    )
    scope = Audit.trace_id == str(uuid5(NAMESPACE_URL, "j26-trace:" + run_id))
    if case:
        scope = or_(scope, Audit.case_id == case.id)
    allowed = or_(
        *(
            and_(Audit.event_type == kind, Audit.status.in_(values))
            for kind, values in PAIRS.items()
            if not receipt_only or kind in RECEIPT_TYPES
        )
    )
    events = list(
        db.scalars(
            select(Audit)
            .where(scope, allowed)
            .order_by(Audit.created_at.desc(), Audit.id)
            .limit(51)
        )
    )

    # Existence checks are independent of the bounded receipt window.
    def has(kind):
        return (
            db.scalar(
                select(Audit.id)
                .where(scope, Audit.event_type == kind, Audit.status.in_(PAIRS[kind]))
                .limit(1)
            )
            is not None
        )

    provenance_ok = False
    if case and not receipt_only and case.provenance:
        try:
            provenance = ServiceProvenance.model_validate(case.provenance)
            provenance_ok = str(provenance.correlation_id) == case.correlation_id
        except ValidationError:
            pass
    task = db.scalar(select(Review).where(Review.case_id == case_id)) if case else None
    actions = (
        dict(
            db.execute(
                select(ReviewAction.action, ReviewAction.created_at)
                .where(
                    ReviewAction.task_id == task.id,
                    ReviewAction.action.in_(["START_REVIEW", "COMPLETE_REVIEW"]),
                )
                .order_by(ReviewAction.created_at)
                .limit(2)
            ).all()
        )
        if task
        else {}
    )
    withdrawal = (
        db.scalar(select(Withdrawal).where(Withdrawal.case_id == case_id))
        if case
        else db.scalar(select(ConsentWithdrawal).where(ConsentWithdrawal.consent_id == run_id))
    )
    retention = db.scalar(select(Retention).where(Retention.case_id == case_id)) if case else None
    job = db.scalar(select(Job).where(Job.case_id == case_id)) if case else None
    assigned = (
        db.scalar(select(Assignment.id).where(Assignment.case_id == case_id).limit(1))
        if case
        else None
    )
    disposed = bool(
        case
        and retention
        and retention.status == "COMPLETED"
        and case.status == "WITHDRAWN"
        and case.inference is None
        and case.explanation is None
        and case.provenance is None
        and not assigned
        and not (task and db.scalar(select(ReviewRecord.id).where(ReviewRecord.task_id == task.id)))
        and (not job or job.status == "CANCELLED" and job.fixture_id is None)
    )
    return DemoEvidence(
        run=summary(consent, case),
        observed_at=now(),
        receipt_only=receipt_only,
        consent_recorded=has("CONSENT_RECORDED"),
        consent_policy_valid=valid,
        blocking_observed=has("OPERATION_BLOCKED"),
        replay_observed=not receipt_only and has("SUBMISSION_REPLAY"),
        failure_observed=not receipt_only and (has("JOB_RETRY") or has("JOB_TERMINAL")),
        provenance_validated=provenance_ok,
        review_task_authorized=bool(
            not receipt_only
            and provenance_ok
            and assigned
            and task
            and case.status in {"READY_FOR_REVIEW", "UNDER_REVIEW", "COMPLETED"}
        ),
        review_started_at=actions.get("START_REVIEW"),
        review_completed_at=actions.get("COMPLETE_REVIEW"),
        review_record_saved_at=db.scalar(
            select(Audit.created_at)
            .where(scope, Audit.event_type == "HUMAN_REVIEW", Audit.status == "RECORD_SAVED")
            .limit(1)
        ),
        withdrawn_at=withdrawal.created_at if withdrawal else None,
        disposal_confirmed=disposed,
        receipts=[DemoReceipt(event=e.event_type, occurred_at=e.created_at) for e in events[:50]],
        receipts_truncated=len(events) > 50,
    )
