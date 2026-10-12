from datetime import timedelta
from types import SimpleNamespace
from uuid import UUID

import httpx
from pydantic import ValidationError
from research_common.audit import flush_pending
from research_common.config import settings
from research_common.database import (
    Account,
    Assignment,
    Case,
    CaseLink,
    Consent,
    Job,
    Retention,
    Review,
    engine,
)
from research_common.mocks import context
from research_common.service_auth import service_token
from research_common.web import SafeError
from research_contracts import (
    FIXTURES,
    PURPOSE,
    ErrorCode,
    ExplanationRequest,
    ExplanationResponse,
    InferenceRequest,
    InferenceResponse,
    PreprocessRequest,
    PreprocessResponse,
    ServiceProvenance,
    now,
)
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from orchestrator.auth import audit

TERMINAL = {"WITHDRAWN", "COMPLETED", "READY_FOR_REVIEW", "UNDER_REVIEW"}


class StaleAttempt(Exception):
    """A fenced or duplicate executor must not mutate the active attempt."""


TRANSITIONS = {
    "RECEIVED": {"CONSENT_VERIFIED", "FAILED", "WITHDRAWAL_REQUESTED"},
    "CONSENT_VERIFIED": {"PREPROCESSING", "FAILED", "WITHDRAWAL_REQUESTED"},
    "PREPROCESSING": {"INFERENCE", "FAILED", "WITHDRAWAL_REQUESTED"},
    "INFERENCE": {"EXPLANATION", "FAILED", "WITHDRAWAL_REQUESTED"},
    "EXPLANATION": {"READY_FOR_REVIEW", "FAILED", "WITHDRAWAL_REQUESTED"},
    "READY_FOR_REVIEW": {"UNDER_REVIEW", "WITHDRAWAL_REQUESTED"},
    "UNDER_REVIEW": {"COMPLETED", "WITHDRAWAL_REQUESTED"},
    "COMPLETED": {"WITHDRAWAL_REQUESTED"},
    "FAILED": {"RECEIVED", "WITHDRAWAL_REQUESTED"},
    "WITHDRAWAL_REQUESTED": {"WITHDRAWN"},
    "WITHDRAWN": set(),
}


def transition(db, case, state):
    if state not in TRANSITIONS[case.status]:
        raise SafeError(ErrorCode.CONFLICT, 409)
    case.status = state
    request = SimpleNamespace(state=SimpleNamespace(correlation_id=UUID(case.correlation_id)))
    audit(db, request, "WORKFLOW_TRANSITION", state, case.id)


def active_consent(consent, db=None, request=None, operation="SUBMISSION", case_id=None):
    if not consent:
        if db is not None and request is not None:
            audit(
                db,
                request,
                "OPERATION_BLOCKED",
                "CONSENT_REQUIRED",
                case_id,
                once=f"missing:{case_id or request.state.correlation_id}:{operation}",
                pending=True,
            )
        raise SafeError(ErrorCode.CONSENT_REQUIRED, 403)
    if (
        consent.status != "ACTIVE"
        or consent.expires_at <= now()
        or consent.purpose != PURPOSE
        or consent.version != "dev-notice-1"
    ):
        if db is not None and request is not None:
            if consent.status == "EXPIRED" or (
                consent.status == "ACTIVE" and consent.expires_at <= now()
            ):
                audit(
                    db,
                    request,
                    "CONSENT_EXPIRED",
                    "DETECTED",
                    case_id,
                    once="expiry:" + consent.id,
                    expires_at=consent.expires_at,
                    pending=True,
                    consent_id=consent.id,
                )
            audit(
                db,
                request,
                "OPERATION_BLOCKED",
                operation,
                case_id,
                once=f"blocked:{consent.id}:{operation}:{consent.status}",
                pending=True,
                consent_id=consent.id,
            )
        raise SafeError(ErrorCode.CONSENT_INVALID, 403)


def lock_case(db, case_id):
    case = db.scalar(select(Case).where(Case.id == case_id).with_for_update())
    if not case:
        raise SafeError(ErrorCode.NOT_FOUND, 404)
    return case


def check_case_consent(db, case, operation="PROCESSING"):
    request = SimpleNamespace(state=SimpleNamespace(correlation_id=UUID(case.correlation_id)))
    if case.status in {"WITHDRAWN", "WITHDRAWAL_REQUESTED"} or case.expires_at <= now():
        audit(
            db,
            request,
            "OPERATION_BLOCKED",
            operation,
            case.id,
            once=f"disposed-block:{case.id}:{operation}",
            pending=True,
        )
        raise SafeError(ErrorCode.CONSENT_INVALID, 403)
    link = db.get(CaseLink, case.id)
    consent = db.scalar(select(Consent).where(Consent.id == link.consent_id).with_for_update())
    active_consent(consent, db, request, operation, case.id)
    return consent


def dispose(db, case, request, reason="RETENTION"):
    if case.status == "WITHDRAWN":
        return
    transition(db, case, "WITHDRAWAL_REQUESTED")
    case.inference = None
    case.explanation = None
    case.provenance = None
    db.execute(delete(Assignment).where(Assignment.case_id == case.id))
    job = db.scalar(select(Job).where(Job.case_id == case.id))
    if job:
        job.status, job.fixture_id, job.lease_until = "CANCELLED", None, None
    if not db.scalar(select(Retention).where(Retention.case_id == case.id)):
        db.add(Retention(case_id=case.id, reason=reason))
    transition(db, case, "WITHDRAWN")
    audit(db, request, "RETENTION", "DERIVED_EVIDENCE_DELETED", case.id)


def call_service(name, path, body, response_type):
    try:
        with httpx.Client(timeout=settings().service_timeout_seconds, trust_env=False) as client:
            response = client.post(
                getattr(settings(), name + "_url") + path,
                json=body.model_dump(mode="json"),
                headers={
                    "Authorization": "Bearer " + service_token(name),
                    "X-Correlation-ID": str(body.correlation_id),
                },
            )
            response.raise_for_status()
            result = response_type.model_validate(response.json())
        if context(body) != context(result):
            raise ValueError()
        return result
    except httpx.TimeoutException:
        raise SafeError(ErrorCode.DOWNSTREAM_TIMEOUT, 503) from None
    except (ValidationError, ValueError):
        raise SafeError(ErrorCode.CONTRACT_INVALID, 502) from None
    except Exception:
        raise SafeError(ErrorCode.DOWNSTREAM_FAILED, 503) from None


def claim_job():
    with Session(engine()) as db, db.begin():
        # All mutators serialize on the case before inspecting/updating its job.
        # Locking the job first inverted disposal's case -> job order.
        case = db.scalar(
            select(Case)
            .join(Job, Job.case_id == Case.id)
            .where(
                (Job.status == "QUEUED") | ((Job.status == "RUNNING") & (Job.lease_until <= now()))
            )
            .order_by(Job.created_at)
            .limit(1)
            .with_for_update(of=Case, skip_locked=True)
        )
        if not case:
            return None
        job = db.scalar(select(Job).where(Job.case_id == case.id).with_for_update())
        if case.status in TERMINAL:
            if case.status == "WITHDRAWN":
                job.status, job.fixture_id, job.lease_until = "CANCELLED", None, None
            else:
                job.status, job.fixture_id, job.lease_until = "DONE", None, None
            return None
        request = SimpleNamespace(
            state=SimpleNamespace(correlation_id=db.get(Case, job.case_id).correlation_id)
        )
        if job.attempts >= 3:
            job.status, job.fixture_id, job.lease_until = "DEAD_LETTER", None, None
            if case.status not in TERMINAL and case.status != "FAILED":
                transition(db, case, "FAILED")
            case.error_code = ErrorCode.RETRY_EXHAUSTED
            audit(db, request, "JOB_TERMINAL", "RETRY_EXHAUSTED", case.id)
            return None
        recovered = job.status == "RUNNING"
        if case.status != "RECEIVED":
            if case.status != "FAILED":
                transition(db, case, "FAILED")
            transition(db, case, "RECEIVED")
        job.attempts += 1
        job.status, job.lease_until = "RUNNING", now() + timedelta(seconds=90)
        audit(db, request, "JOB_CLAIM", "LEASE_RECOVERED" if recovered else "CLAIMED", job.case_id)
        return job.id, job.attempts


def process_job(job_id, attempt, adapter=call_service):
    """Each transition serializes with withdrawal. No text is written to the job or logs."""

    def stage(state, operation=None):
        with Session(engine()) as db, db.begin():
            job = db.get(Job, job_id)
            case = lock_case(db, job.case_id)
            db.refresh(job)
            if (
                job.status != "RUNNING"
                or job.attempts != attempt
                or case.status in TERMINAL
                or job.lease_until is None
                or job.lease_until <= now()
            ):
                raise StaleAttempt()
            if state == "CONSENT_VERIFIED" and case.status != "RECEIVED":
                raise StaleAttempt()
            check_case_consent(db, case)
            transition(db, case, state)
            lease_deadline = job.lease_until
            result = operation(db, case, job) if operation else None
            # The lease may expire during a bounded remote call while this transaction holds locks.
            if lease_deadline <= now():
                raise StaleAttempt()
            return result

    try:
        stage("CONSENT_VERIFIED")

        def preprocess(db, case, job):
            body = PreprocessRequest(
                case_id=case.id,
                correlation_id=case.correlation_id,
                idempotency_key=job.idempotency_key,
                text=FIXTURES[job.fixture_id],
            )
            return adapter("preprocessing", "/internal/v1/preprocess", body, PreprocessResponse)

        pre = stage("PREPROCESSING", preprocess)
        inference = stage(
            "INFERENCE",
            lambda db, case, job: adapter(
                "nlp",
                "/internal/v1/infer",
                InferenceRequest(**context(pre), preprocessing=pre),
                InferenceResponse,
            ),
        )
        explanation = stage(
            "EXPLANATION",
            lambda db, case, job: adapter(
                "xai",
                "/internal/v1/explain",
                ExplanationRequest(**context(pre), preprocessing=pre, inference=inference),
                ExplanationResponse,
            ),
        )

        def finish(db, case, job):
            case.inference, case.explanation = (
                inference.model_dump(mode="json"),
                explanation.model_dump(mode="json"),
            )
            case.error_code = None
            case.provenance = ServiceProvenance(
                correlation_id=case.correlation_id,
                preprocessing_service_version=pre.service_version,
                pipeline_version=pre.pipeline_version,
                preprocessing_dataset_version=pre.dataset_version,
                nlp_service_version=inference.service_version,
                model_version=inference.model_version,
                model_dataset_version=inference.dataset_version,
                xai_service_version=explanation.service_version,
                explainer_version=explanation.explainer_version,
            ).model_dump(mode="json")
            db.add(Review(case_id=case.id))
            designated = db.scalar(
                select(Account).where(
                    Account.username == settings().dev_counsellor_username,
                    Account.role == "COUNSELLOR",
                    Account.enabled.is_(True),
                )
            )
            if designated:
                db.add(Assignment(case_id=case.id, counsellor_id=designated.id))
                audit(
                    db,
                    SimpleNamespace(state=SimpleNamespace(correlation_id=case.correlation_id)),
                    "ASSIGNMENT",
                    "AUTO_GRANTED",
                    case.id,
                )
            job.status, job.fixture_id, job.lease_until = "DONE", None, None

        stage("READY_FOR_REVIEW", finish)
    except StaleAttempt:
        return
    except Exception as exc:
        code = exc.code if isinstance(exc, SafeError) else ErrorCode.DOWNSTREAM_FAILED
        with Session(engine()) as db, db.begin():
            job = db.get(Job, job_id)
            case = lock_case(db, job.case_id)
            db.refresh(job)
            if (
                job.attempts != attempt
                or job.status != "RUNNING"
                or case.status in TERMINAL
                or job.lease_until is None
                or job.lease_until <= now()
            ):
                return
            if case.status != "FAILED":
                transition(db, case, "FAILED")
            case.error_code = code
            retry = (
                code in {ErrorCode.DOWNSTREAM_FAILED, ErrorCode.DOWNSTREAM_TIMEOUT}
                and job.attempts < 3
            )
            job.status, job.lease_until = ("QUEUED" if retry else "DEAD_LETTER"), None
            if not retry:
                job.fixture_id = None
            request = SimpleNamespace(state=SimpleNamespace(correlation_id=case.correlation_id))
            if code in {ErrorCode.CONSENT_INVALID, ErrorCode.CONSENT_REQUIRED}:
                try:
                    check_case_consent(db, case)
                except SafeError:
                    flush_pending(db)
            audit(db, request, "JOB_RETRY" if retry else "JOB_TERMINAL", str(code), case.id)


def enforce_retention():
    with Session(engine()) as db, db.begin():
        cases = db.scalars(
            select(Case)
            .where(Case.expires_at <= now(), Case.status != "WITHDRAWN")
            .with_for_update(skip_locked=True)
        ).all()
        for case in cases:
            request = SimpleNamespace(
                state=SimpleNamespace(correlation_id=UUID(case.correlation_id))
            )
            dispose(db, case, request)
