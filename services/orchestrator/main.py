import hashlib
import json
import logging
from datetime import timedelta
from uuid import UUID, uuid4

import httpx
from fastapi import Depends, Request, Response
from research_common.config import settings
from research_common.database import (
    Account,
    Assignment,
    Case,
    CaseLink,
    Consent,
    ConsentWithdrawal,
    CounterfactualFeedbackRecord,
    CounterfactualRecord,
    Explanation,
    FaithfulnessRecord,
    Job,
    Retention,
    Review,
    ReviewAction,
    StabilityRecord,
    Withdrawal,
    engine,
    session,
)
from research_common.service_auth import service_token
from research_common.web import SafeError, create_app
from research_contracts import (
    FIXTURES,
    AccountResponse,
    AssignmentRequest,
    C4CounterfactualListResponse,
    C4CounterfactualRequest,
    C4CounterfactualResponse,
    C4CounterfactualSummary,
    C4ExplanationListResponse,
    C4ExplanationRequest,
    C4ExplanationResponse,
    C4ExplanationSummary,
    C4FaithfulnessListResponse,
    C4FaithfulnessOccurrence,
    C4FaithfulnessRequest,
    C4FaithfulnessResponse,
    C4FaithfulnessStepResult,
    C4FaithfulnessSummary,
    C4InternalFaithfulnessRequest,
    C4InternalStabilityRequest,
    C4ManualEvaluationRequest,
    C4ManualEvaluationResponse,
    C4PredictionRequest,
    C4PredictionResponse,
    C4StabilityListResponse,
    C4StabilityRequest,
    C4StabilityResponse,
    C4StabilityRunResult,
    C4StabilitySummary,
    C4StabilityWordConsistency,
    ConsentDecision,
    ConsentLifecycle,
    ConsentRecord,
    CounterfactualCandidate,
    CounterfactualFeedback,
    CounterfactualFeedbackRequest,
    EditOperation,
    ErrorCode,
    FeatureContribution,
    FixturesResponse,
    HumanReviewAction,
    LoginRequest,
    PseudonymousCase,
    ReviewTask,
    Role,
    SubmissionSession,
    WithdrawalRequest,
    WorkflowRequest,
    now,
)
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from orchestrator import auth
from orchestrator.workflow import active_consent, check_case_consent, dispose, lock_case, transition

app = create_app("orchestrator", database=True)
student = auth.require_role(Role.STUDENT)
counsellor = auth.require_role(Role.COUNSELLOR)
admin = auth.require_role(Role.ADMIN)


def case_response(case):
    return PseudonymousCase(
        case_id=case.id,
        correlation_id=case.correlation_id,
        processing_status=case.status,
        created_at=case.created_at,
        updated_at=case.updated_at,
        error_code=case.error_code,
    )


def consent_response(consent):
    status = (
        "EXPIRED" if consent.status == "ACTIVE" and consent.expires_at <= now() else consent.status
    )
    return ConsentRecord(
        consent_id=consent.id,
        consent_status=status,
        consent_version=consent.version,
        purpose=consent.purpose,
        created_at=consent.created_at,
        expires_at=consent.expires_at,
    )


def own_case(db, case_id, account):
    case = lock_case(db, str(case_id))
    link = db.get(CaseLink, case.id)
    if not link or link.account_id != account.id:
        raise SafeError(ErrorCode.NOT_FOUND, 404)
    return case


def authorized_review(db, task_id, account):
    task = db.get(Review, str(task_id))
    if not task:
        raise SafeError(ErrorCode.NOT_FOUND, 404)
    case = lock_case(db, task.case_id)
    if not db.scalar(
        select(Assignment).where(
            Assignment.case_id == case.id, Assignment.counsellor_id == account.id
        )
    ):
        raise SafeError(ErrorCode.NOT_FOUND, 404)
    check_case_consent(db, case, "REVIEW")
    if case.status not in {"READY_FOR_REVIEW", "UNDER_REVIEW", "COMPLETED"}:
        raise SafeError(ErrorCode.NOT_FOUND, 404)
    return task, case


def review_response(task, case):
    return ReviewTask(
        task_id=task.id,
        case=case_response(case),
        inference=case.inference,
        explanation=case.explanation,
        preprocessing=getattr(case, "preprocessing", None),
    )


@app.get("/api/v1/fixtures", response_model=FixturesResponse)
def fixtures():
    return FixturesResponse(fixtures=FIXTURES)


@app.post("/api/v1/auth/student-session", response_model=SubmissionSession)
def open_session(request: Request, response: Response, db: Session = Depends(session)):
    auth.csrf(request)
    auth.rate_limit(request, "student-session")
    account = Account(role="STUDENT", expires_at=now() + timedelta(hours=1))
    db.add(account)
    db.flush()
    auth.issue(db, account, response)
    auth.audit(db, request, "AUTH_LOGIN", "SYNTHETIC_SESSION")
    db.commit()
    return SubmissionSession(
        session_id=account.id, role=account.role, expires_at=account.expires_at
    )


@app.post("/api/v1/auth/login", response_model=AccountResponse)
def login(body: LoginRequest, request: Request, response: Response, db: Session = Depends(session)):
    account = auth.login(body, request, response, db)
    return AccountResponse(account_id=account.id, role=account.role)


@app.post("/api/v1/auth/refresh", response_model=AccountResponse)
def refresh(request: Request, response: Response, db: Session = Depends(session)):
    account = auth.refresh(request, response, db)
    return AccountResponse(account_id=account.id, role=account.role)


@app.post("/api/v1/auth/logout", status_code=204)
def logout(request: Request, response: Response, db: Session = Depends(session)):
    auth.logout(request, response, db)


@app.get("/api/v1/auth/me", response_model=AccountResponse)
def me(account=Depends(auth.current_account)):
    return AccountResponse(account_id=account.id, role=account.role)


@app.post("/api/v1/consents", response_model=ConsentRecord, status_code=201)
def record_consent(
    body: ConsentDecision,
    request: Request,
    account=Depends(student),
    db: Session = Depends(session),
):
    consent = Consent(
        account_id=account.id,
        status=body.consent_status,
        purpose=body.purpose,
        version=body.consent_version,
        expires_at=account.expires_at,
    )
    db.add(consent)
    db.flush()
    auth.audit(db, request, "CONSENT_RECORDED", body.consent_status, consent_id=consent.id)
    db.commit()
    return consent_response(consent)


@app.get("/api/v1/consents/{consent_id}", response_model=ConsentRecord)
def get_consent(consent_id: UUID, account=Depends(student), db: Session = Depends(session)):
    consent = db.get(Consent, str(consent_id))
    if not consent or consent.account_id != account.id:
        raise SafeError(ErrorCode.NOT_FOUND, 404)
    return consent_response(consent)


def lifecycle_response(db, consent):
    link = db.scalar(select(CaseLink).where(CaseLink.consent_id == consent.id))
    case = db.get(Case, link.case_id) if link else None
    receipt = db.scalar(select(ConsentWithdrawal).where(ConsentWithdrawal.consent_id == consent.id))
    retained = None
    if case:
        receipt = db.scalar(select(Withdrawal).where(Withdrawal.case_id == case.id))
        retained = db.scalar(select(Retention).where(Retention.case_id == case.id))
    return ConsentLifecycle(
        consent=consent_response(consent),
        case=case_response(case) if case else None,
        explicitly_withdrawn_at=receipt.created_at if receipt else None,
        disposal_reason=retained.reason if retained else None,
    )


@app.get("/api/v1/consents/{consent_id}/lifecycle", response_model=ConsentLifecycle)
def consent_lifecycle(consent_id: UUID, account=Depends(student), db: Session = Depends(session)):
    consent = db.get(Consent, str(consent_id))
    if not consent or consent.account_id != account.id:
        raise SafeError(ErrorCode.NOT_FOUND, 404)
    return lifecycle_response(db, consent)


@app.post("/api/v1/consents/{consent_id}/withdraw", response_model=ConsentLifecycle)
def withdraw_consent(
    consent_id: UUID,
    body: WithdrawalRequest,
    request: Request,
    account=Depends(student),
    db: Session = Depends(session),
):
    consent = db.get(Consent, str(consent_id))
    if not consent or consent.account_id != account.id:
        raise SafeError(ErrorCode.NOT_FOUND, 404)
    link = db.scalar(select(CaseLink).where(CaseLink.consent_id == consent.id))
    if not link:
        consent = db.scalar(
            select(Consent)
            .where(Consent.id == str(consent_id))
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        # A submitter may have created a case while this request waited for consent.
        link = db.scalar(select(CaseLink).where(CaseLink.consent_id == consent.id))
        if not link:
            prior = db.scalar(
                select(ConsentWithdrawal).where(ConsentWithdrawal.consent_id == consent.id)
            )
            if not prior:
                if consent.status not in {"ACTIVE", "EXPIRED"}:
                    raise SafeError(ErrorCode.CONFLICT, 409)
                consent.status = "WITHDRAWN"
                db.add(
                    ConsentWithdrawal(
                        consent_id=consent.id, idempotency_key=str(body.idempotency_key)
                    )
                )
                auth.audit(db, request, "WITHDRAWAL", "BEFORE_SUBMISSION", consent_id=consent.id)
                db.commit()
            return lifecycle_response(db, consent)
        # Never acquire a case lock while holding its consent lock.
        db.commit()
    withdraw(UUID(link.case_id), body, request, account, db)
    db.refresh(consent)
    return lifecycle_response(db, consent)


@app.post("/api/v1/submissions", response_model=PseudonymousCase, status_code=202)
def submit(
    body: WorkflowRequest,
    request: Request,
    account=Depends(student),
    db: Session = Depends(session),
):
    if FIXTURES[body.fixture_id] != body.text:
        raise SafeError(ErrorCode.CONTRACT_INVALID, 422)
    fingerprint = hashlib.sha256(body.model_dump_json().encode()).hexdigest()
    existing = db.scalar(
        select(CaseLink).where(
            CaseLink.account_id == account.id, CaseLink.idempotency_key == str(body.idempotency_key)
        )
    )
    if existing:
        case = own_case(db, existing.case_id, account)
        check_case_consent(db, case, "SUBMISSION")
        if existing.request_hash != fingerprint:
            raise SafeError(ErrorCode.CONFLICT, 409)
        auth.audit(db, request, "SUBMISSION_REPLAY", "DUPLICATE", case.id, once="replay:" + case.id)
        db.commit()
        return case_response(case)
    consent = db.scalar(select(Consent).where(Consent.id == str(body.consent_id)).with_for_update())
    if consent and consent.account_id != account.id:
        raise SafeError(ErrorCode.NOT_FOUND, 404)
    active_consent(consent, db, request)
    existing = db.scalar(select(CaseLink).where(CaseLink.consent_id == consent.id))
    if existing:
        if (
            existing.idempotency_key == str(body.idempotency_key)
            and existing.request_hash == fingerprint
        ):
            # Another concurrent request committed while this request waited for consent.
            # Release the consent lock before acquiring the case lock (global lock order).
            db.commit()
            case = own_case(db, existing.case_id, account)
            check_case_consent(db, case, "SUBMISSION")
            auth.audit(
                db, request, "SUBMISSION_REPLAY", "CONCURRENT", case.id, once="replay:" + case.id
            )
            db.commit()
            return case_response(case)
        raise SafeError(ErrorCode.CONFLICT, 409)
    case = Case(
        correlation_id=str(request.state.correlation_id),
        expires_at=now() + timedelta(hours=settings().retention_hours),
    )
    db.add(case)
    db.flush()
    db.add(
        CaseLink(
            case_id=case.id,
            consent_id=consent.id,
            account_id=account.id,
            idempotency_key=str(body.idempotency_key),
            request_hash=fingerprint,
        )
    )
    db.add(
        Job(case_id=case.id, fixture_id=body.fixture_id, idempotency_key=str(body.idempotency_key))
    )
    auth.audit(db, request, "WORKFLOW_TRANSITION", "RECEIVED", case.id)
    auth.audit(db, request, "SUBMISSION", "ACCEPTED", case.id)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = db.scalar(
            select(CaseLink).where(
                CaseLink.account_id == account.id,
                CaseLink.idempotency_key == str(body.idempotency_key),
            )
        )
        if existing and existing.request_hash == fingerprint:
            case = own_case(db, existing.case_id, account)
            check_case_consent(db, case, "SUBMISSION")
            auth.audit(
                db, request, "SUBMISSION_REPLAY", "RECOVERED", case.id, once="replay:" + case.id
            )
            db.commit()
            return case_response(case)
        raise SafeError(ErrorCode.CONFLICT, 409) from None
    return case_response(case)


@app.get("/api/v1/cases/{case_id}/status", response_model=PseudonymousCase)
def status(case_id: UUID, account=Depends(student), db: Session = Depends(session)):
    return case_response(own_case(db, case_id, account))


@app.post("/api/v1/cases/{case_id}/withdraw", response_model=PseudonymousCase)
def withdraw(
    case_id: UUID,
    body: WithdrawalRequest,
    request: Request,
    account=Depends(student),
    db: Session = Depends(session),
):
    case = own_case(db, case_id, account)
    # Retention may already have disposed the case without an owner withdrawal.
    # The case lock serializes requests; the receipt makes repeated withdrawals a no-op.
    prior = db.scalar(select(Withdrawal).where(Withdrawal.case_id == case.id))
    if not prior:
        consent = db.scalar(
            select(Consent)
            .where(Consent.id == db.get(CaseLink, case.id).consent_id)
            .with_for_update()
        )
        consent.status = "WITHDRAWN"
        dispose(db, case, request, reason="OWNER_WITHDRAWAL")
        db.add(Withdrawal(case_id=case.id, idempotency_key=str(body.idempotency_key)))
        auth.audit(db, request, "WITHDRAWAL", "WITHDRAWN", case.id)
        db.commit()
    return case_response(case)


@app.get("/api/v1/review-tasks", response_model=list[ReviewTask])
def review_tasks(account=Depends(counsellor), db: Session = Depends(session)):
    tasks = db.scalars(
        select(Review)
        .join(Assignment, Assignment.case_id == Review.case_id)
        .where(Assignment.counsellor_id == account.id)
        .limit(100)
    ).all()
    result = []
    for task in tasks:
        try:
            _, case = authorized_review(db, task.id, account)
            result.append(review_response(task, case))
        except SafeError:
            continue
    return result


@app.get("/api/v1/review-tasks/{task_id}", response_model=ReviewTask)
def review_task(task_id: UUID, account=Depends(counsellor), db: Session = Depends(session)):
    return review_response(*authorized_review(db, task_id, account))


@app.post("/api/v1/review-tasks/{task_id}/actions", response_model=ReviewTask)
def review_action(
    task_id: UUID,
    body: HumanReviewAction,
    request: Request,
    account=Depends(counsellor),
    db: Session = Depends(session),
):
    task, case = authorized_review(db, task_id, account)
    prior = db.scalar(
        select(ReviewAction).where(ReviewAction.idempotency_key == str(body.idempotency_key))
    )
    if prior:
        if prior.task_id != task.id or prior.actor_id != account.id or prior.action != body.action:
            raise SafeError(ErrorCode.CONFLICT, 409)
        return review_response(task, case)
    transition(db, case, "UNDER_REVIEW" if body.action == "START_REVIEW" else "COMPLETED")
    db.add(
        ReviewAction(
            task_id=task.id,
            actor_id=account.id,
            action=body.action,
            idempotency_key=str(body.idempotency_key),
        )
    )
    auth.audit(db, request, "HUMAN_REVIEW", body.action, case.id)
    db.commit()
    return review_response(task, case)


@app.post("/api/v1/cases/{case_id}/assign", status_code=204)
def assign(
    case_id: UUID,
    body: AssignmentRequest,
    request: Request,
    account=Depends(admin),
    db: Session = Depends(session),
):
    case = lock_case(db, str(case_id))
    check_case_consent(db, case)
    reviewer = db.get(Account, str(body.counsellor_id))
    if not auth.account_valid(reviewer) or reviewer.role != "COUNSELLOR":
        raise SafeError(ErrorCode.FORBIDDEN, 403)
    existing = db.scalar(
        select(Assignment).where(
            Assignment.case_id == case.id, Assignment.counsellor_id == reviewer.id
        )
    )
    if not existing:
        db.add(Assignment(case_id=case.id, counsellor_id=reviewer.id))
        auth.audit(db, request, "ASSIGNMENT", "GRANTED", case.id)
        db.commit()


logger = logging.getLogger(__name__)


def _call_xai_explain(body: C4ExplanationRequest) -> C4ExplanationResponse:
    payload = body.model_dump(mode="json")
    # Avoid holding any database transaction open during model inference
    try:
        with httpx.Client(timeout=settings().xai_timeout_seconds, trust_env=False) as client:
            res = client.post(
                settings().xai_url + "/internal/v1/dev/explain",
                json=payload,
                headers={"Authorization": "Bearer " + service_token("xai")},
            )
            if res.status_code == 200:
                return C4ExplanationResponse.model_validate(res.json())
            elif res.status_code in {403, 422}:
                raise SafeError(ErrorCode.CONTRACT_INVALID, res.status_code)
            else:
                raise SafeError(ErrorCode.DOWNSTREAM_FAILED, 502)
    except httpx.TimeoutException:
        logger.warning("XAI service call timed out")
        raise SafeError(ErrorCode.DOWNSTREAM_TIMEOUT, 504) from None
    except httpx.ConnectError:
        logger.warning("XAI service connection failed")
        raise SafeError(ErrorCode.DEPENDENCY_UNAVAILABLE, 503) from None
    except SafeError:
        raise
    except Exception as exc:
        logger.exception("Inference call failed: %s", exc)
        raise SafeError(ErrorCode.DOWNSTREAM_FAILED, 502) from None


def explanation_record_to_response(record: Explanation) -> C4ExplanationResponse:
    raw_contributions = record.contributions or []
    contributions = [
        FeatureContribution(
            token=c["token"],
            weight=float(c["weight"]),
            direction=c["direction"],
            abs_weight=float(c["abs_weight"]),
        )
        for c in raw_contributions
    ]
    diagnostics: dict[str, int | float | str | bool] = {}
    if record.diagnostics and isinstance(record.diagnostics, dict):
        for k, v in record.diagnostics.items():
            if isinstance(v, (int, float, str, bool)):
                diagnostics[k] = v
    return C4ExplanationResponse(
        method=record.method,  # type: ignore[arg-type]
        status=record.status,  # type: ignore[arg-type]
        status_message=record.status_message or "Explanation retrieved successfully.",
        model_id=record.model_id,
        model_version=record.model_version,
        model_revision=record.model_revision,
        predicted_class=record.predicted_class,
        probabilities=record.probabilities or {},
        token_count=record.token_count,
        truncated=record.truncated,
        target_class=record.target_class,
        target_class_probability=record.target_class_probability,
        base_value=record.base_value,
        output_value=record.output_value,
        contributions=contributions,
        tokens=record.tokens or [],
        weights=record.weights or [],
        computation_bounds=record.explainer_config or {},
        reconstructed_output=record.reconstructed_output,
        additivity_residual=record.additivity_residual,
        additivity_within_tolerance=record.additivity_within_tolerance,
        additivity_discrepancy_message=record.additivity_discrepancy_message,
        explanation_id=UUID(record.id),
        created_at=record.created_at,
        is_development=record.is_development,
        source_reference=record.source_reference,
        diagnostics=diagnostics,
    )


@app.post("/api/v1/c4/explanations", response_model=C4ExplanationResponse, status_code=201)
def create_c4_explanation(
    body: C4ExplanationRequest,
    request: Request,
    account=Depends(auth.current_account),
):
    """Generate and persist an authenticated LIME or SHAP explanation."""
    auth.csrf(request)
    if account.role not in {Role.COUNSELLOR, Role.ADMIN, Role.RESEARCHER}:
        raise SafeError(ErrorCode.FORBIDDEN, 403)

    if not body.text or not body.text.strip():
        raise SafeError(ErrorCode.CONTRACT_INVALID, 422)

    # Compute request fingerprint
    fingerprint = hashlib.sha256(
        json.dumps(
            {
                "text": body.text,
                "method": body.method,
                "target_class": body.target_class,
                "language": body.language,
            },
            sort_keys=True,
        ).encode()
    ).hexdigest()

    # Prevent duplicate records when the same generation request is retried
    if body.idempotency_key:
        with Session(engine()) as db:
            existing = db.scalar(
                select(Explanation).where(
                    Explanation.account_id == account.id,
                    Explanation.idempotency_key == str(body.idempotency_key),
                )
            )
            if existing:
                if existing.request_hash != fingerprint:
                    raise SafeError(ErrorCode.CONFLICT, 409)
                if existing.expires_at and existing.expires_at <= now():
                    raise SafeError(ErrorCode.NOT_FOUND, 404)
                return explanation_record_to_response(existing)

    # Avoid holding a database transaction open during model inference
    explanation_res = _call_xai_explain(body)

    if explanation_res.status != "READY":
        # Do not persist incomplete or unavailable explanations
        return explanation_res

    # Handle inference and database failures clearly. Never claim a result was saved if persistence failed.
    explanation_id = str(uuid4())
    is_temporary_model = True  # Mark temporary-model records as development explanations
    created_time = now()

    diagnostics_data: dict[str, int | float | str | bool] = {}
    if explanation_res.token_count is not None:
        diagnostics_data["token_count"] = explanation_res.token_count
    if explanation_res.truncated is not None:
        diagnostics_data["truncated"] = explanation_res.truncated
    if isinstance(explanation_res.diagnostics, dict):
        for k, v in explanation_res.diagnostics.items():
            if isinstance(v, (int, float, str, bool)):
                diagnostics_data[k] = v

    try:
        with Session(engine()) as db:
            record = Explanation(
                id=explanation_id,
                account_id=account.id,
                source_reference=body.source_reference,
                idempotency_key=str(body.idempotency_key) if body.idempotency_key else None,
                request_hash=fingerprint,
                method=explanation_res.method,
                target_class=explanation_res.target_class or body.target_class or "Negative",
                model_id=explanation_res.model_id or "cardiffnlp/twitter-xlm-roberta-base-sentiment",
                model_version=explanation_res.model_version,
                model_revision=explanation_res.model_revision,
                explainer_version="0.1.0",
                explainer_config=explanation_res.computation_bounds,
                contributions=[c.model_dump(mode="json") for c in explanation_res.contributions],
                tokens=explanation_res.tokens,
                weights=explanation_res.weights,
                base_value=explanation_res.base_value,
                output_value=explanation_res.output_value,
                target_class_probability=explanation_res.target_class_probability,
                predicted_class=explanation_res.predicted_class,
                probabilities=explanation_res.probabilities,
                token_count=explanation_res.token_count,
                truncated=explanation_res.truncated,
                diagnostics=diagnostics_data,
                reconstructed_output=explanation_res.reconstructed_output,
                additivity_residual=explanation_res.additivity_residual,
                additivity_within_tolerance=explanation_res.additivity_within_tolerance,
                additivity_discrepancy_message=explanation_res.additivity_discrepancy_message,
                is_development=is_temporary_model,
                status="READY",
                status_message=explanation_res.status_message,
                expires_at=now() + timedelta(hours=settings().retention_hours),
                created_at=created_time,
                updated_at=created_time,
            )
            db.add(record)
            db.commit()
            saved_created_at = record.created_at or created_time
    except IntegrityError:
        # Concurrent retry or race condition on idempotency key
        if body.idempotency_key:
            with Session(engine()) as db:
                existing = db.scalar(
                    select(Explanation).where(
                        Explanation.account_id == account.id,
                        Explanation.idempotency_key == str(body.idempotency_key),
                    )
                )
                if existing:
                    if existing.request_hash != fingerprint:
                        raise SafeError(ErrorCode.CONFLICT, 409) from None
                    if existing.expires_at and existing.expires_at <= now():
                        raise SafeError(ErrorCode.NOT_FOUND, 404) from None
                    return explanation_record_to_response(existing)
        raise SafeError(ErrorCode.CONFLICT, 409) from None
    except Exception as exc:
        logger.exception("Failed to persist explanation: %s", exc)
        raise SafeError(ErrorCode.INTERNAL_ERROR, 500) from None

    explanation_res.explanation_id = UUID(explanation_id)
    explanation_res.created_at = saved_created_at
    explanation_res.is_development = is_temporary_model
    explanation_res.source_reference = body.source_reference
    explanation_res.diagnostics = diagnostics_data
    return explanation_res


@app.get("/api/v1/c4/explanations/{explanation_id}", response_model=C4ExplanationResponse)
def get_c4_explanation(
    explanation_id: UUID,
    account=Depends(auth.current_account),
    db: Session = Depends(session),
):
    """Retrieve an authenticated user's saved explanation by ID."""
    record = db.get(Explanation, str(explanation_id))
    # Prevent access to another user's records; derive ownership from verified authentication
    if not record or record.account_id != account.id:
        raise SafeError(ErrorCode.NOT_FOUND, 404)
    # Enforce retention policy
    if record.expires_at and record.expires_at <= now():
        raise SafeError(ErrorCode.NOT_FOUND, 404)
    return explanation_record_to_response(record)


@app.get("/api/v1/c4/explanations", response_model=C4ExplanationListResponse)
def list_c4_explanations(
    limit: int = 20,
    offset: int = 0,
    account=Depends(auth.current_account),
    db: Session = Depends(session),
):
    """Return a bounded, paginated list of the current authenticated user's explanations."""
    bounded_limit = max(1, min(limit, 100))
    bounded_offset = max(0, offset)

    query = (
        select(Explanation)
        .where(
            Explanation.account_id == account.id,
            (Explanation.expires_at.is_(None)) | (Explanation.expires_at > now()),
        )
        .order_by(Explanation.created_at.desc())
    )
    total = db.scalar(
        select(func.count(Explanation.id)).where(
            Explanation.account_id == account.id,
            (Explanation.expires_at.is_(None)) | (Explanation.expires_at > now()),
        )
    ) or 0

    records = db.scalars(query.offset(bounded_offset).limit(bounded_limit)).all()
    items = [
        C4ExplanationSummary(
            explanation_id=UUID(r.id),
            created_at=r.created_at,
            method=r.method,  # type: ignore[arg-type]
            target_class=r.target_class,
            predicted_class=r.predicted_class,
            target_class_probability=r.target_class_probability,
            is_development=r.is_development,
            source_reference=r.source_reference,
        )
        for r in records
    ]
    return C4ExplanationListResponse(
        items=items,
        total=total,
        limit=bounded_limit,
        offset=bounded_offset,
    )


def _call_xai_predict(body: C4PredictionRequest) -> C4PredictionResponse:
    payload = body.model_dump(mode="json")
    try:
        with httpx.Client(timeout=settings().xai_timeout_seconds, trust_env=False) as client:
            res = client.post(
                settings().xai_url + "/internal/v1/dev/predict",
                json=payload,
                headers={"Authorization": "Bearer " + service_token("xai")},
            )
            if res.status_code == 200:
                return C4PredictionResponse.model_validate(res.json())
            elif res.status_code in {403, 422}:
                raise SafeError(ErrorCode.CONTRACT_INVALID, res.status_code)
            else:
                raise SafeError(ErrorCode.DOWNSTREAM_FAILED, 502)
    except httpx.TimeoutException:
        logger.warning("XAI prediction service call timed out")
        raise SafeError(ErrorCode.DOWNSTREAM_TIMEOUT, 504) from None
    except httpx.ConnectError:
        logger.warning("XAI prediction service connection failed")
        raise SafeError(ErrorCode.DEPENDENCY_UNAVAILABLE, 503) from None
    except SafeError:
        raise
    except Exception as exc:
        logger.exception("Prediction call failed: %s", exc)
        raise SafeError(ErrorCode.DOWNSTREAM_FAILED, 502) from None


def _call_xai_counterfactual(body: C4CounterfactualRequest) -> C4CounterfactualResponse:
    payload = body.model_dump(mode="json")
    try:
        with httpx.Client(timeout=settings().xai_timeout_seconds, trust_env=False) as client:
            res = client.post(
                settings().xai_url + "/internal/v1/dev/counterfactuals",
                json=payload,
                headers={"Authorization": "Bearer " + service_token("xai")},
            )
            if res.status_code == 200:
                return C4CounterfactualResponse.model_validate(res.json())
            elif res.status_code in {403, 422}:
                raise SafeError(ErrorCode.CONTRACT_INVALID, res.status_code)
            else:
                raise SafeError(ErrorCode.DOWNSTREAM_FAILED, 502)
    except httpx.TimeoutException:
        logger.warning("XAI counterfactual service call timed out")
        raise SafeError(ErrorCode.DOWNSTREAM_TIMEOUT, 504) from None
    except httpx.ConnectError:
        logger.warning("XAI counterfactual service connection failed")
        raise SafeError(ErrorCode.DEPENDENCY_UNAVAILABLE, 503) from None
    except SafeError:
        raise
    except Exception as exc:
        logger.exception("Counterfactual call failed: %s", exc)
        raise SafeError(ErrorCode.DOWNSTREAM_FAILED, 502) from None


def _call_xai_manual_evaluation(body: C4ManualEvaluationRequest) -> C4ManualEvaluationResponse:
    payload = body.model_dump(mode="json")
    try:
        with httpx.Client(timeout=settings().xai_timeout_seconds, trust_env=False) as client:
            res = client.post(
                settings().xai_url + "/internal/v1/dev/counterfactuals/manual",
                json=payload,
                headers={"Authorization": "Bearer " + service_token("xai")},
            )
            if res.status_code == 200:
                return C4ManualEvaluationResponse.model_validate(res.json())
            elif res.status_code in {403, 422}:
                raise SafeError(ErrorCode.CONTRACT_INVALID, res.status_code)
            else:
                raise SafeError(ErrorCode.DOWNSTREAM_FAILED, 502)
    except httpx.TimeoutException:
        logger.warning("XAI manual counterfactual service call timed out")
        raise SafeError(ErrorCode.DOWNSTREAM_TIMEOUT, 504) from None
    except httpx.ConnectError:
        logger.warning("XAI manual counterfactual service connection failed")
        raise SafeError(ErrorCode.DEPENDENCY_UNAVAILABLE, 503) from None
    except SafeError:
        raise
    except Exception as exc:
        logger.exception("Manual counterfactual evaluation call failed: %s", exc)
        raise SafeError(ErrorCode.DOWNSTREAM_FAILED, 502) from None


def counterfactual_record_to_response(
    record: CounterfactualRecord,
    db: Session | None = None,
) -> C4CounterfactualResponse:
    feedback_by_candidate: dict[str, CounterfactualFeedback] = {}
    if db:
        try:
            feedbacks = db.scalars(
                select(CounterfactualFeedbackRecord).where(
                    CounterfactualFeedbackRecord.counterfactual_id == record.id
                )
            ).all()
            for fb in feedbacks:
                feedback_by_candidate[fb.candidate_id] = CounterfactualFeedback(
                    feedback_id=UUID(fb.id),
                    candidate_id=fb.candidate_id,
                    reviewer_id=fb.reviewer_account_id,
                    natural_wording=fb.natural_wording,
                    context_preserved=fb.context_preserved,
                    useful=fb.useful,
                    comment=fb.comment,
                    created_at=fb.created_at,
                    updated_at=fb.updated_at,
                )
        except Exception as exc:
            logger.warning("Could not fetch feedback for counterfactual %s: %s", record.id, exc)

    raw_candidates = record.candidates or []
    candidates: list[CounterfactualCandidate] = []
    for c in raw_candidates:
        c_id = c.get("candidate_id")
        edits = [
            EditOperation(
                op=e["op"],
                index=e["index"],
                original=e.get("original"),
                replacement=e.get("replacement"),
                start_offset=e.get("start_offset"),
                end_offset=e.get("end_offset"),
            )
            for e in c.get("edits", [])
        ]
        candidates.append(
            CounterfactualCandidate(
                candidate_id=c_id,
                candidate_text=c.get("candidate_text"),
                edits=edits,
                edit_count=c.get("edit_count", len(edits)),
                predicted_class=c.get("predicted_class", record.target_class),
                probabilities=c.get("probabilities", {}),
                target_probability=c.get("target_probability", 0.0),
                target_probability_delta=c.get("target_probability_delta", 0.0),
                diff_spans=[],
                minimality_rank=c.get("minimality_rank", 1),
                minimality_description=c.get(
                    "minimality_description",
                    "Fewest edits found within this search.",
                ),
                verified=c.get("verified", True),
                feedback=feedback_by_candidate.get(c_id) if c_id else None,
            )
        )

    best_candidate: CounterfactualCandidate | None = None
    if record.best_candidate:
        b = record.best_candidate
        b_id = b.get("candidate_id")
        b_edits = [
            EditOperation(
                op=e["op"],
                index=e["index"],
                original=e.get("original"),
                replacement=e.get("replacement"),
                start_offset=e.get("start_offset"),
                end_offset=e.get("end_offset"),
            )
            for e in b.get("edits", [])
        ]
        best_candidate = CounterfactualCandidate(
            candidate_id=b_id,
            candidate_text=b.get("candidate_text"),
            edits=b_edits,
            edit_count=b.get("edit_count", len(b_edits)),
            predicted_class=b.get("predicted_class", record.target_class),
            probabilities=b.get("probabilities", {}),
            target_probability=b.get("target_probability", 0.0),
            target_probability_delta=b.get("target_probability_delta", 0.0),
            diff_spans=[],
            minimality_rank=b.get("minimality_rank", 1),
            minimality_description=b.get(
                "minimality_description",
                "Fewest edits found within this search.",
            ),
            verified=b.get("verified", True),
            feedback=feedback_by_candidate.get(b_id) if b_id else None,
        )

    outcome_val = record.outcome
    if outcome_val not in {
        "SUCCESS",
        "NO_COUNTERFACTUAL_FOUND",
        "ALREADY_TARGET_CLASS",
        "SEARCH_LIMIT_EXCEEDED",
        "TIMEOUT",
        "UNAVAILABLE_MODEL",
    }:
        outcome_val = "SUCCESS"

    return C4CounterfactualResponse(
        counterfactual_id=UUID(record.id),
        created_at=record.created_at,
        target_class=record.target_class,
        original_predicted_class=record.original_predicted_class,
        original_probabilities=record.original_probabilities or {},
        outcome=outcome_val,  # type: ignore[arg-type]
        outcome_message=record.outcome_message or "Counterfactual retrieved successfully.",
        candidates=candidates,
        best_candidate=best_candidate,
        search_limits=record.search_limits or {},
        model_id=record.model_id,
        model_version=record.model_version,
        model_revision=record.model_revision,
        is_development=record.is_development,
        source_reference=record.source_reference,
        execution_time_ms=record.execution_time_ms,
        evaluated_candidate_count=(
            record.search_limits.get("evaluated_candidate_count", len(candidates) + (1 if best_candidate else 0))
            if isinstance(record.search_limits, dict)
            else len(candidates) + (1 if best_candidate else 0)
        ),
        successful_candidate_count=len(candidates) + (1 if best_candidate else 0),
        stopping_reason=(
            record.search_limits.get("stopping_reason")
            if isinstance(record.search_limits, dict)
            else None
        ),
        request_hash=record.request_hash,
    )


@app.post("/api/v1/c4/predict", response_model=C4PredictionResponse)
def create_c4_predict(
    body: C4PredictionRequest,
    request: Request,
    account=Depends(auth.optional_account),
):
    """Sentiment prediction route proxying to XAI service with CSRF & origin protection."""
    auth.csrf(request)
    if account and account.role not in {Role.COUNSELLOR, Role.ADMIN, Role.RESEARCHER, Role.STUDENT}:
        raise SafeError(ErrorCode.FORBIDDEN, 403)

    if not account and settings().environment != "development":
        raise SafeError(ErrorCode.AUTH_REQUIRED, 401)

    if not body.text or not body.text.strip():
        raise SafeError(ErrorCode.CONTRACT_INVALID, 422)

    return _call_xai_predict(body)


@app.post("/api/v1/c4/counterfactuals/manual", response_model=C4ManualEvaluationResponse)
def manual_c4_counterfactual(
    body: C4ManualEvaluationRequest,
    request: Request,
    account=Depends(auth.optional_account),
):
    """Evaluate a counsellor's manual 'What If?' edit with CSRF and role protection."""
    auth.csrf(request)
    if account and account.role not in {Role.COUNSELLOR, Role.ADMIN, Role.RESEARCHER}:
        raise SafeError(ErrorCode.FORBIDDEN, 403)
    if not account and settings().environment != "development":
        raise SafeError(ErrorCode.AUTH_REQUIRED, 401)
    if not body.original_text or not body.original_text.strip():
        raise SafeError(ErrorCode.CONTRACT_INVALID, 422)
    if not body.edited_text or not body.edited_text.strip():
        raise SafeError(ErrorCode.CONTRACT_INVALID, 422)
    return _call_xai_manual_evaluation(body)


@app.post("/api/v1/c4/counterfactuals", response_model=C4CounterfactualResponse, status_code=201)
def create_c4_counterfactual(
    body: C4CounterfactualRequest,
    request: Request,
    account=Depends(auth.optional_account),
):
    """Generate and persist an authenticated model-backed counterfactual explanation."""
    auth.csrf(request)
    if account and account.role not in {Role.COUNSELLOR, Role.ADMIN, Role.RESEARCHER}:
        raise SafeError(ErrorCode.FORBIDDEN, 403)
    if not account and settings().environment != "development":
        raise SafeError(ErrorCode.AUTH_REQUIRED, 401)

    target_account_id = account.id if account else None
    if not target_account_id and settings().environment == "development":
        with Session(engine()) as db:
            dev_acc = db.scalar(
                select(Account).where(Account.username == settings().dev_counsellor_username)
            )
            target_account_id = dev_acc.id if dev_acc else None
    if not target_account_id:
        raise SafeError(ErrorCode.AUTH_REQUIRED, 401)

    if not body.text or not body.text.strip():
        raise SafeError(ErrorCode.CONTRACT_INVALID, 422)

    fingerprint = hashlib.sha256(
        json.dumps(
            {
                "text": body.text,
                "target_class": body.target_class,
                "language": body.language,
                "max_edits": body.max_edits,
                "max_candidates": body.max_candidates,
                "edit_mode": body.edit_mode,
                "locked_spans": [s.model_dump(mode="json") for s in body.locked_spans],
            },
            sort_keys=True,
        ).encode()
    ).hexdigest()

    # Idempotency check before inference
    if body.idempotency_key:
        with Session(engine()) as db:
            existing = db.scalar(
                select(CounterfactualRecord).where(
                    CounterfactualRecord.account_id == target_account_id,
                    CounterfactualRecord.idempotency_key == str(body.idempotency_key),
                )
            )
            if existing:
                if existing.request_hash != fingerprint:
                    raise SafeError(ErrorCode.CONFLICT, 409)
                if existing.expires_at and existing.expires_at <= now():
                    raise SafeError(ErrorCode.NOT_FOUND, 404)
                return counterfactual_record_to_response(existing, db)

    # Run inference outside database transaction
    cf_res = _call_xai_counterfactual(body)

    if cf_res.outcome == "UNAVAILABLE_MODEL":
        return cf_res

    cf_id = str(uuid4())
    created_time = now()

    # Sanitize candidates for storage: keep complete raw candidate text transient!
    # Stored fragments only retain sensitive edit operations and verified metrics.
    stored_candidates = [
        {
            "candidate_id": c.candidate_id,
            "edits": [e.model_dump(mode="json") for e in c.edits],
            "edit_count": c.edit_count,
            "predicted_class": c.predicted_class,
            "probabilities": c.probabilities,
            "target_probability": c.target_probability,
            "target_probability_delta": c.target_probability_delta,
            "minimality_rank": c.minimality_rank,
            "minimality_description": c.minimality_description,
            "verified": c.verified,
        }
        for c in cf_res.candidates
    ]

    stored_best = None
    if cf_res.best_candidate:
        stored_best = {
            "candidate_id": cf_res.best_candidate.candidate_id,
            "edits": [e.model_dump(mode="json") for e in cf_res.best_candidate.edits],
            "edit_count": cf_res.best_candidate.edit_count,
            "predicted_class": cf_res.best_candidate.predicted_class,
            "probabilities": cf_res.best_candidate.probabilities,
            "target_probability": cf_res.best_candidate.target_probability,
            "target_probability_delta": cf_res.best_candidate.target_probability_delta,
            "minimality_rank": cf_res.best_candidate.minimality_rank,
            "minimality_description": cf_res.best_candidate.minimality_description,
            "verified": cf_res.best_candidate.verified,
        }

    try:
        with Session(engine()) as db:
            record = CounterfactualRecord(
                id=cf_id,
                account_id=target_account_id,
                source_reference=body.source_reference,
                idempotency_key=str(body.idempotency_key) if body.idempotency_key else None,
                request_hash=fingerprint,
                target_class=cf_res.target_class,
                original_predicted_class=cf_res.original_predicted_class,
                original_probabilities=cf_res.original_probabilities,
                model_id=cf_res.model_id or "cardiffnlp/twitter-xlm-roberta-base-sentiment",
                model_version=cf_res.model_version,
                model_revision=cf_res.model_revision,
                outcome=cf_res.outcome,
                outcome_message=cf_res.outcome_message,
                search_limits=cf_res.search_limits,
                candidates=stored_candidates,
                best_candidate=stored_best,
                is_development=True,
                execution_time_ms=cf_res.execution_time_ms,
                expires_at=now() + timedelta(hours=settings().retention_hours),
                created_at=created_time,
                updated_at=created_time,
            )
            db.add(record)
            db.commit()
            saved_created_at = record.created_at or created_time
    except IntegrityError:
        if body.idempotency_key:
            with Session(engine()) as db:
                existing = db.scalar(
                    select(CounterfactualRecord).where(
                        CounterfactualRecord.account_id == target_account_id,
                        CounterfactualRecord.idempotency_key == str(body.idempotency_key),
                    )
                )
                if existing:
                    if existing.request_hash != fingerprint:
                        raise SafeError(ErrorCode.CONFLICT, 409) from None
                    if existing.expires_at and existing.expires_at <= now():
                        raise SafeError(ErrorCode.NOT_FOUND, 404) from None
                    return counterfactual_record_to_response(existing, db)
        raise SafeError(ErrorCode.CONFLICT, 409) from None
    except Exception as exc:
        logger.exception("Failed to persist counterfactual: %s", exc)
        raise SafeError(ErrorCode.INTERNAL_ERROR, 500) from None

    cf_res.counterfactual_id = UUID(cf_id)
    cf_res.created_at = saved_created_at
    cf_res.source_reference = body.source_reference
    cf_res.request_hash = fingerprint
    return cf_res


@app.post(
    "/api/v1/c4/counterfactuals/{counterfactual_id}/feedback",
    response_model=CounterfactualFeedback,
)
def save_c4_counterfactual_feedback(
    counterfactual_id: UUID,
    body: CounterfactualFeedbackRequest,
    request: Request,
    account=Depends(auth.optional_account),
    db: Session = Depends(session),
):
    """Submit or update reviewer feedback for a counterfactual candidate with DB persistence."""
    auth.csrf(request)
    if account and account.role not in {Role.COUNSELLOR, Role.ADMIN, Role.RESEARCHER}:
        raise SafeError(ErrorCode.FORBIDDEN, 403)
    if not account and settings().environment != "development":
        raise SafeError(ErrorCode.AUTH_REQUIRED, 401)

    target_reviewer_id = account.id if account else None
    if not target_reviewer_id and settings().environment == "development":
        dev_acc = db.scalar(
            select(Account).where(Account.username == settings().dev_counsellor_username)
        )
        target_reviewer_id = dev_acc.id if dev_acc else None
    if not target_reviewer_id:
        raise SafeError(ErrorCode.AUTH_REQUIRED, 401)

    cf_record = db.get(CounterfactualRecord, str(counterfactual_id))
    if not cf_record:
        raise SafeError(ErrorCode.NOT_FOUND, 404)
    if cf_record.expires_at and cf_record.expires_at <= now():
        raise SafeError(ErrorCode.NOT_FOUND, 404)

    # Check if feedback already exists for this candidate by this reviewer
    existing = db.scalar(
        select(CounterfactualFeedbackRecord).where(
            CounterfactualFeedbackRecord.counterfactual_id == str(counterfactual_id),
            CounterfactualFeedbackRecord.candidate_id == body.candidate_id,
            CounterfactualFeedbackRecord.reviewer_account_id == target_reviewer_id,
        )
    )

    current_time = now()
    if existing:
        existing.natural_wording = body.natural_wording
        existing.context_preserved = body.context_preserved
        existing.useful = body.useful
        existing.comment = body.comment
        existing.updated_at = current_time
        db.commit()
        db.refresh(existing)
        feedback_record = existing
    else:
        feedback_record = CounterfactualFeedbackRecord(
            id=str(uuid4()),
            counterfactual_id=str(counterfactual_id),
            candidate_id=body.candidate_id,
            reviewer_account_id=target_reviewer_id,
            natural_wording=body.natural_wording,
            context_preserved=body.context_preserved,
            useful=body.useful,
            comment=body.comment,
            created_at=current_time,
            updated_at=current_time,
        )
        db.add(feedback_record)
        db.commit()
        db.refresh(feedback_record)

    return CounterfactualFeedback(
        feedback_id=UUID(feedback_record.id),
        candidate_id=feedback_record.candidate_id,
        reviewer_id=account.id,
        natural_wording=feedback_record.natural_wording,  # type: ignore[arg-type]
        context_preserved=feedback_record.context_preserved,  # type: ignore[arg-type]
        useful=feedback_record.useful,  # type: ignore[arg-type]
        comment=feedback_record.comment,
        created_at=feedback_record.created_at,
        updated_at=feedback_record.updated_at,
    )


@app.get("/api/v1/c4/counterfactuals/{counterfactual_id}", response_model=C4CounterfactualResponse)
def get_c4_counterfactual(
    counterfactual_id: UUID,
    account=Depends(auth.current_account),
    db: Session = Depends(session),
):
    """Retrieve an authenticated user's saved counterfactual by ID."""
    record = db.get(CounterfactualRecord, str(counterfactual_id))
    if not record or record.account_id != account.id:
        raise SafeError(ErrorCode.NOT_FOUND, 404)
    if record.expires_at and record.expires_at <= now():
        raise SafeError(ErrorCode.NOT_FOUND, 404)
    return counterfactual_record_to_response(record, db)



@app.get("/api/v1/c4/counterfactuals", response_model=C4CounterfactualListResponse)
def list_c4_counterfactuals(
    limit: int = 20,
    offset: int = 0,
    account=Depends(auth.current_account),
    db: Session = Depends(session),
):
    """Return a bounded, paginated list of the current authenticated user's counterfactuals."""
    bounded_limit = max(1, min(limit, 100))
    bounded_offset = max(0, offset)

    query = (
        select(CounterfactualRecord)
        .where(
            CounterfactualRecord.account_id == account.id,
            (CounterfactualRecord.expires_at.is_(None)) | (CounterfactualRecord.expires_at > now()),
        )
        .order_by(CounterfactualRecord.created_at.desc())
    )
    total = db.scalar(
        select(func.count(CounterfactualRecord.id)).where(
            CounterfactualRecord.account_id == account.id,
            (CounterfactualRecord.expires_at.is_(None)) | (CounterfactualRecord.expires_at > now()),
        )
    ) or 0

    records = db.scalars(query.offset(bounded_offset).limit(bounded_limit)).all()
    items = [
        C4CounterfactualSummary(
            counterfactual_id=UUID(r.id),
            created_at=r.created_at,
            target_class=r.target_class,
            original_predicted_class=r.original_predicted_class,
            outcome=r.outcome,
            candidate_count=len(r.candidates or []),
            best_edit_count=r.best_candidate.get("edit_count") if r.best_candidate else None,
            is_development=r.is_development,
            source_reference=r.source_reference,
        )
        for r in records
    ]
    return C4CounterfactualListResponse(
        items=items,
        total=total,
        limit=bounded_limit,
        offset=bounded_offset,
    )


def _call_xai_faithfulness(body: C4InternalFaithfulnessRequest) -> C4FaithfulnessResponse:
    payload = body.model_dump(mode="json")
    try:
        with httpx.Client(timeout=settings().xai_timeout_seconds, trust_env=False) as client:
            res = client.post(
                settings().xai_url + "/internal/v1/dev/faithfulness",
                json=payload,
                headers={"Authorization": "Bearer " + service_token("xai")},
            )
            if res.status_code == 200:
                return C4FaithfulnessResponse.model_validate(res.json())
            elif res.status_code in {403, 422}:
                raise SafeError(ErrorCode.CONTRACT_INVALID, res.status_code)
            else:
                raise SafeError(ErrorCode.DOWNSTREAM_FAILED, 502)
    except httpx.TimeoutException:
        logger.warning("XAI faithfulness service call timed out")
        raise SafeError(ErrorCode.DOWNSTREAM_TIMEOUT, 504) from None
    except httpx.ConnectError:
        logger.warning("XAI faithfulness service connection failed")
        raise SafeError(ErrorCode.DEPENDENCY_UNAVAILABLE, 503) from None
    except SafeError:
        raise
    except Exception as exc:
        logger.exception("Faithfulness service call failed: %s", exc)
        raise SafeError(ErrorCode.DOWNSTREAM_FAILED, 502) from None


def faithfulness_record_to_response(
    record: FaithfulnessRecord,
) -> C4FaithfulnessResponse:
    ranked_words = [
        C4FaithfulnessOccurrence.model_validate(rw)
        for rw in (record.selected_occurrence_offsets or [])
    ]
    steps = [
        C4FaithfulnessStepResult.model_validate(s)
        for s in (record.step_results or [])
    ]
    settings_dict = record.settings or {}
    outcome_val = record.outcome
    if outcome_val not in {
        "SUCCESS",
        "PARTIAL",
        "NO_SUPPORTING_WORDS",
        "UNSUPPORTED_ALIGNMENT",
        "INCOMPATIBLE_MODEL",
        "TEXT_MISMATCH",
        "OVERLENGTH_TEXT",
        "TIMEOUT",
        "UNAVAILABLE_MODEL",
        "INFERENCE_FAILED",
    }:
        outcome_val = "SUCCESS"

    return C4FaithfulnessResponse(
        evaluation_id=UUID(record.id),
        created_at=record.created_at,
        explanation_id=UUID(record.explanation_id),
        method=record.method,  # type: ignore[arg-type]
        explained_class=record.explained_class,
        baseline_probability=record.baseline_probability,
        model_id=record.model_id,
        model_version=record.model_version,
        model_revision=record.model_revision,
        outcome=outcome_val,  # type: ignore[arg-type]
        outcome_message=record.outcome_message or "Faithfulness evaluation restored from database.",
        ranked_words=ranked_words,
        steps=steps,
        aopc=record.aopc,
        final_comprehensiveness_drop=record.final_comprehensiveness_drop,
        final_sufficiency_gap=record.final_sufficiency_gap,
        final_random_mean_drop=record.final_random_mean_drop,
        final_difference_from_random=record.final_difference_from_random,
        total_eligible_words=record.total_eligible_words,
        budget_requested=settings_dict.get("budget_requested", record.budget_evaluated),
        budget_evaluated=record.budget_evaluated,
        completed_steps=record.completed_steps,
        completed_trials=record.completed_trials,
        total_inferences=record.total_inferences,
        execution_time_ms=record.execution_time_ms,
        seed=settings_dict.get("seed", 42),
        stopping_reason=record.stopping_reason,
        is_development=record.is_development,
        source_reference=record.source_reference,
        saved=True,
    )


@app.post("/api/v1/c4/faithfulness", response_model=C4FaithfulnessResponse)
def evaluate_c4_faithfulness(
    body: C4FaithfulnessRequest,
    request: Request,
    account=Depends(auth.current_account),
    db: Session = Depends(session),
):
    """Evaluate faithfulness of a saved explanation with exact source text verification and model provenance."""
    auth.csrf(request)
    if account.role not in {Role.COUNSELLOR, Role.ADMIN, Role.RESEARCHER}:
        raise SafeError(ErrorCode.FORBIDDEN, 403)

    if not body.text or not body.text.strip():
        raise SafeError(ErrorCode.CONTRACT_INVALID, 422)

    # 1. Server-side resolution of saved explanation (verify ownership and expiry)
    exp_record = db.get(Explanation, str(body.explanation_id))
    if not exp_record or exp_record.account_id != account.id:
        raise SafeError(ErrorCode.NOT_FOUND, 404)
    if exp_record.expires_at and exp_record.expires_at <= now():
        raise SafeError(ErrorCode.NOT_FOUND, 404)

    # 2. Verify exact source text against stored request fingerprint
    expected_hash = hashlib.sha256(
        json.dumps(
            {
                "text": body.text,
                "method": exp_record.method,
                "target_class": exp_record.target_class,
                "language": body.language,
            },
            sort_keys=True,
        ).encode()
    ).hexdigest()
    expected_hash_no_lang = hashlib.sha256(
        json.dumps(
            {
                "text": body.text,
                "method": exp_record.method,
                "target_class": exp_record.target_class,
                "language": None,
            },
            sort_keys=True,
        ).encode()
    ).hexdigest()

    if exp_record.request_hash and exp_record.request_hash not in (expected_hash, expected_hash_no_lang):
        return C4FaithfulnessResponse(
            explanation_id=body.explanation_id,
            method=exp_record.method,  # type: ignore[arg-type]
            explained_class=exp_record.target_class,
            baseline_probability=exp_record.target_class_probability or 0.0,
            outcome="TEXT_MISMATCH",
            outcome_message="Supplied source text does not match the source text used to generate the selected explanation.",
            is_development=True,
        )

    # 3. Check concurrency-safe idempotency
    eval_fingerprint = hashlib.sha256(
        json.dumps(
            {
                "explanation_id": str(body.explanation_id),
                "text": body.text,
                "budget_words": body.max_removal_words,
                "budget_pct": body.max_removal_pct,
                "trials": body.random_trials,
                "seed": body.seed,
            },
            sort_keys=True,
        ).encode()
    ).hexdigest()

    if body.idempotency_key:
        existing = db.scalar(
            select(FaithfulnessRecord).where(
                FaithfulnessRecord.account_id == account.id,
                FaithfulnessRecord.idempotency_key == str(body.idempotency_key),
            )
        )
        if existing:
            if existing.request_hash != eval_fingerprint:
                raise SafeError(ErrorCode.CONFLICT, 409)
            if existing.expires_at and existing.expires_at <= now():
                raise SafeError(ErrorCode.NOT_FOUND, 404)
            return faithfulness_record_to_response(existing)

    # 4. Construct internal request to XAI
    contributions_objs: list[FeatureContribution] = []
    if exp_record.contributions:
        for c in exp_record.contributions:
            try:
                contributions_objs.append(FeatureContribution.model_validate(c))
            except Exception:
                pass

    internal_req = C4InternalFaithfulnessRequest(
        text=body.text,
        explanation_id=body.explanation_id,
        method=exp_record.method,  # type: ignore[arg-type]
        explained_class=exp_record.target_class,
        tokens=exp_record.tokens or [],
        weights=exp_record.weights or [],
        contributions=contributions_objs,
        model_revision=exp_record.model_revision,
        target_class_probability=exp_record.target_class_probability,
        language=body.language,
        max_removal_words=body.max_removal_words,
        max_removal_pct=body.max_removal_pct,
        random_trials=body.random_trials,
        seed=body.seed,
    )

    # Run inference outside database transactions
    eval_res = _call_xai_faithfulness(internal_req)

    # 5. Persist completed or partial evaluation result
    if eval_res.outcome not in {"SUCCESS", "PARTIAL"}:
        return eval_res

    eval_id = str(uuid4())
    created_time = now()
    # Strip modified_text from step results before persisting (to keep raw text strictly transient)
    persisted_steps = [
        s.model_dump(mode="json", exclude={"modified_text"})
        for s in eval_res.steps
    ]
    persisted_ranked_words = [
        rw.model_dump(mode="json")
        for rw in eval_res.ranked_words
    ]
    settings_data = {
        "budget_requested": eval_res.budget_requested,
        "max_removal_words": body.max_removal_words,
        "max_removal_pct": body.max_removal_pct,
        "random_trials": eval_res.completed_trials,
        "seed": eval_res.seed,
    }

    try:
        with Session(engine()) as tx_db:
            record = FaithfulnessRecord(
                id=eval_id,
                explanation_id=str(body.explanation_id),
                account_id=account.id,
                source_reference=body.source_reference or exp_record.source_reference,
                idempotency_key=str(body.idempotency_key) if body.idempotency_key else None,
                request_hash=eval_fingerprint,
                method=eval_res.method,
                explained_class=eval_res.explained_class,
                baseline_probability=eval_res.baseline_probability,
                model_id=eval_res.model_id or exp_record.model_id,
                model_version=eval_res.model_version or exp_record.model_version,
                model_revision=eval_res.model_revision or exp_record.model_revision,
                explainer_version=exp_record.explainer_version or "0.1.0",
                settings=settings_data,
                selected_occurrence_offsets=persisted_ranked_words,
                step_results=persisted_steps,
                aopc=eval_res.aopc,
                final_comprehensiveness_drop=eval_res.final_comprehensiveness_drop,
                final_sufficiency_gap=eval_res.final_sufficiency_gap,
                final_random_mean_drop=eval_res.final_random_mean_drop,
                final_difference_from_random=eval_res.final_difference_from_random,
                total_eligible_words=eval_res.total_eligible_words,
                budget_evaluated=eval_res.budget_evaluated,
                completed_steps=eval_res.completed_steps,
                completed_trials=eval_res.completed_trials,
                total_inferences=eval_res.total_inferences,
                execution_time_ms=eval_res.execution_time_ms,
                outcome=eval_res.outcome,
                outcome_message=eval_res.outcome_message,
                stopping_reason=eval_res.stopping_reason,
                is_development=True,
                created_at=created_time,
                updated_at=created_time,
                expires_at=now() + timedelta(hours=settings().retention_hours),
            )
            tx_db.add(record)
            tx_db.commit()
            eval_res.evaluation_id = UUID(eval_id)
            eval_res.created_at = created_time
            eval_res.saved = True
    except IntegrityError:
        if body.idempotency_key:
            with Session(engine()) as tx_db:
                existing = tx_db.scalar(
                    select(FaithfulnessRecord).where(
                        FaithfulnessRecord.account_id == account.id,
                        FaithfulnessRecord.idempotency_key == str(body.idempotency_key),
                    )
                )
                if existing:
                    if existing.request_hash != eval_fingerprint:
                        raise SafeError(ErrorCode.CONFLICT, 409) from None
                    return faithfulness_record_to_response(existing)
        eval_res.saved = False
    except Exception as exc:
        logger.exception("Failed to persist faithfulness evaluation: %s", exc)
        eval_res.saved = False

    eval_res.source_reference = body.source_reference or exp_record.source_reference
    return eval_res


@app.get("/api/v1/c4/faithfulness/{evaluation_id}", response_model=C4FaithfulnessResponse)
def get_c4_faithfulness(
    evaluation_id: UUID,
    account=Depends(auth.current_account),
    db: Session = Depends(session),
):
    """Retrieve an authenticated user's saved faithfulness evaluation record by ID."""
    record = db.get(FaithfulnessRecord, str(evaluation_id))
    if not record or record.account_id != account.id:
        raise SafeError(ErrorCode.NOT_FOUND, 404)
    if record.expires_at and record.expires_at <= now():
        raise SafeError(ErrorCode.NOT_FOUND, 404)
    return faithfulness_record_to_response(record)


@app.get("/api/v1/c4/faithfulness", response_model=C4FaithfulnessListResponse)
def list_c4_faithfulness(
    limit: int = 20,
    offset: int = 0,
    account=Depends(auth.current_account),
    db: Session = Depends(session),
):
    """Return a bounded, paginated list of the current user's faithfulness evaluations."""
    bounded_limit = max(1, min(limit, 100))
    bounded_offset = max(0, offset)

    query = (
        select(FaithfulnessRecord)
        .where(
            FaithfulnessRecord.account_id == account.id,
            (FaithfulnessRecord.expires_at.is_(None)) | (FaithfulnessRecord.expires_at > now()),
        )
        .order_by(FaithfulnessRecord.created_at.desc())
    )
    total = db.scalar(
        select(func.count(FaithfulnessRecord.id)).where(
            FaithfulnessRecord.account_id == account.id,
            (FaithfulnessRecord.expires_at.is_(None)) | (FaithfulnessRecord.expires_at > now()),
        )
    ) or 0

    records = db.scalars(query.offset(bounded_offset).limit(bounded_limit)).all()
    items = [
        C4FaithfulnessSummary(
            evaluation_id=UUID(r.id),
            explanation_id=UUID(r.explanation_id),
            created_at=r.created_at,
            method=r.method,  # type: ignore[arg-type]
            explained_class=r.explained_class,
            baseline_probability=r.baseline_probability,
            aopc=r.aopc,
            outcome=r.outcome,
            is_development=r.is_development,
            source_reference=r.source_reference,
        )
        for r in records
    ]
    return C4FaithfulnessListResponse(
        items=items,
        total=total,
        limit=bounded_limit,
        offset=bounded_offset,
    )


@app.get("/api/v1/c4/faithfulness/by-explanation/{explanation_id}", response_model=C4FaithfulnessResponse)
def get_c4_faithfulness_by_explanation(
    explanation_id: UUID,
    account=Depends(auth.current_account),
    db: Session = Depends(session),
):
    """Retrieve the latest saved faithfulness evaluation for a given explanation ID."""
    record = db.scalar(
        select(FaithfulnessRecord)
        .where(
            FaithfulnessRecord.explanation_id == str(explanation_id),
            FaithfulnessRecord.account_id == account.id,
            (FaithfulnessRecord.expires_at.is_(None)) | (FaithfulnessRecord.expires_at > now()),
        )
        .order_by(FaithfulnessRecord.created_at.desc())
    )
    if not record:
        raise SafeError(ErrorCode.NOT_FOUND, 404)
    return faithfulness_record_to_response(record)


def _call_xai_stability(body: C4InternalStabilityRequest) -> C4StabilityResponse:
    try:
        with httpx.Client(timeout=35.0) as client:
            res = client.post(
                settings().xai_url + "/internal/v1/dev/stability",
                json=body.model_dump(mode="json"),
                headers={"Authorization": f"Bearer {service_token('orchestrator')}"},
            )
            if res.status_code == 200:
                return C4StabilityResponse.model_validate(res.json())
            logger.warning("XAI stability service error: %d %s", res.status_code, res.text)
            return C4StabilityResponse(
                explanation_id=body.explanation_id,
                method=body.method,
                explained_class=body.explained_class,
                baseline_probability=body.target_class_probability or 0.0,
                outcome="INFERENCE_FAILED",
                outcome_message=f"XAI stability service returned HTTP {res.status_code}.",
            )
    except httpx.TimeoutException:
        logger.warning("XAI stability service call timed out")
        return C4StabilityResponse(
            explanation_id=body.explanation_id,
            method=body.method,
            explained_class=body.explained_class,
            baseline_probability=body.target_class_probability or 0.0,
            outcome="TIMEOUT",
            outcome_message="XAI stability service timed out.",
        )
    except httpx.RequestError as exc:
        logger.warning("XAI stability service connection failed: %s", exc)
        return C4StabilityResponse(
            explanation_id=body.explanation_id,
            method=body.method,
            explained_class=body.explained_class,
            baseline_probability=body.target_class_probability or 0.0,
            outcome="UNAVAILABLE_MODEL",
            outcome_message="XAI service unavailable.",
        )
    except Exception as exc:
        logger.exception("Stability service call failed: %s", exc)
        return C4StabilityResponse(
            explanation_id=body.explanation_id,
            method=body.method,
            explained_class=body.explained_class,
            baseline_probability=body.target_class_probability or 0.0,
            outcome="INFERENCE_FAILED",
            outcome_message=f"Stability evaluation failed: {exc}",
        )


def stability_record_to_response(
    record: StabilityRecord,
    source_text: str | None = None,
) -> C4StabilityResponse:
    runs = [
        C4StabilityRunResult.model_validate(r)
        for r in (record.runs or [])
    ]
    word_consistency = []
    for wc in (record.word_consistency or []):
        wc_obj = C4StabilityWordConsistency.model_validate(wc)
        if source_text and 0 <= wc_obj.start < wc_obj.end <= len(source_text):
            wc_obj.word = source_text[wc_obj.start:wc_obj.end]
        else:
            wc_obj.word = ""
        word_consistency.append(wc_obj)

    outcome_val = record.outcome
    if outcome_val not in {
        "SUCCESS",
        "PARTIAL",
        "UNSUPPORTED_ALIGNMENT",
        "INCOMPATIBLE_MODEL",
        "TEXT_MISMATCH",
        "OVERLENGTH_TEXT",
        "TIMEOUT",
        "UNAVAILABLE_MODEL",
        "INFERENCE_FAILED",
    }:
        outcome_val = "SUCCESS"

    return C4StabilityResponse(
        evaluation_id=UUID(record.id),
        created_at=record.created_at,
        explanation_id=UUID(record.explanation_id),
        method=record.method,  # type: ignore[arg-type]
        explained_class=record.explained_class,
        baseline_probability=record.baseline_probability,
        model_id=record.model_id,
        model_version=record.model_version,
        model_revision=record.model_revision,
        explainer_version=record.explainer_version or "0.1.0",
        outcome=outcome_val,  # type: ignore[arg-type]
        outcome_message=record.outcome_message or "Stability evaluation restored from database.",
        stopping_reason=record.stopping_reason,
        runs=runs,
        word_consistency=word_consistency,
        mean_top_k_overlap=record.mean_top_k_overlap,
        mean_rank_correlation=record.mean_rank_correlation,
        mean_attribution_std=record.mean_attribution_std,
        requested_runs=record.requested_runs,
        completed_runs=record.completed_runs,
        effective_k=record.effective_k,
        total_eligible_words=record.total_eligible_words,
        is_deterministic=record.is_deterministic,
        determinism_notice=record.determinism_notice,
        execution_time_ms=record.execution_time_ms,
        is_development=record.is_development,
        source_reference=record.source_reference,
        saved=True,
    )


@app.post("/api/v1/c4/stability", response_model=C4StabilityResponse)
def evaluate_c4_stability(
    body: C4StabilityRequest,
    request: Request,
    account=Depends(auth.current_account),
    db: Session = Depends(session),
):
    """Evaluate repeated-run stability of a saved explanation with exact source text verification and model provenance."""
    auth.csrf(request)
    if account.role not in {Role.COUNSELLOR, Role.ADMIN, Role.RESEARCHER}:
        raise SafeError(ErrorCode.FORBIDDEN, 403)

    if not body.text or not body.text.strip():
        raise SafeError(ErrorCode.CONTRACT_INVALID, 422)

    # 1. Server-side resolution of saved explanation (verify ownership and expiry)
    exp_record = db.get(Explanation, str(body.explanation_id))
    if not exp_record or exp_record.account_id != account.id:
        raise SafeError(ErrorCode.NOT_FOUND, 404)
    if exp_record.expires_at and exp_record.expires_at <= now():
        raise SafeError(ErrorCode.NOT_FOUND, 404)

    # 2. Verify exact source text against stored request fingerprint
    expected_hash = hashlib.sha256(
        json.dumps(
            {
                "text": body.text,
                "method": exp_record.method,
                "target_class": exp_record.target_class,
                "language": body.language,
            },
            sort_keys=True,
        ).encode()
    ).hexdigest()
    expected_hash_no_lang = hashlib.sha256(
        json.dumps(
            {
                "text": body.text,
                "method": exp_record.method,
                "target_class": exp_record.target_class,
                "language": None,
            },
            sort_keys=True,
        ).encode()
    ).hexdigest()

    if exp_record.request_hash and exp_record.request_hash not in (expected_hash, expected_hash_no_lang):
        return C4StabilityResponse(
            explanation_id=body.explanation_id,
            method=exp_record.method,  # type: ignore[arg-type]
            explained_class=exp_record.target_class,
            baseline_probability=exp_record.target_class_probability or 0.0,
            outcome="TEXT_MISMATCH",
            outcome_message="Supplied source text does not match the source text used to generate the selected explanation.",
            is_development=True,
        )

    # 3. Check concurrency-safe idempotency
    eval_fingerprint = hashlib.sha256(
        json.dumps(
            {
                "explanation_id": str(body.explanation_id),
                "text": body.text,
                "run_count": body.run_count,
                "top_k": body.top_k,
                "base_seed": body.base_seed,
                "evals": body.explainer_evals,
            },
            sort_keys=True,
        ).encode()
    ).hexdigest()

    if body.idempotency_key:
        existing = db.scalar(
            select(StabilityRecord).where(
                StabilityRecord.account_id == account.id,
                StabilityRecord.idempotency_key == str(body.idempotency_key),
            )
        )
        if existing:
            if existing.request_hash != eval_fingerprint:
                raise SafeError(ErrorCode.CONFLICT, 409)
            if existing.expires_at and existing.expires_at <= now():
                raise SafeError(ErrorCode.NOT_FOUND, 404)
            return stability_record_to_response(existing, source_text=body.text)

    # 4. Construct internal request to XAI
    internal_req = C4InternalStabilityRequest(
        text=body.text,
        explanation_id=body.explanation_id,
        method=exp_record.method,  # type: ignore[arg-type]
        explained_class=exp_record.target_class,
        model_revision=exp_record.model_revision,
        target_class_probability=exp_record.target_class_probability,
        run_count=body.run_count,
        top_k=body.top_k,
        base_seed=body.base_seed,
        explainer_evals=body.explainer_evals,
        language=body.language,
    )

    # Run computation outside database transactions
    eval_res = _call_xai_stability(internal_req)

    # 5. Persist completed or partial evaluation result
    if eval_res.outcome not in {"SUCCESS", "PARTIAL"}:
        return eval_res

    eval_id = str(uuid4())
    created_time = now()

    # Strip raw text from word_consistency to keep transient
    persisted_word_consistency = [
        wc.model_dump(mode="json", exclude={"word"})
        for wc in eval_res.word_consistency
    ]
    persisted_runs = [
        r.model_dump(mode="json")
        for r in eval_res.runs
    ]
    persisted_offsets = [
        {"occurrence_id": wc.occurrence_id, "start": wc.start, "end": wc.end}
        for wc in eval_res.word_consistency
    ]
    settings_data = {
        "run_count": eval_res.requested_runs,
        "completed_runs": eval_res.completed_runs,
        "top_k": body.top_k,
        "effective_k": eval_res.effective_k,
        "base_seed": body.base_seed,
        "explainer_evals": body.explainer_evals,
    }

    try:
        with Session(engine()) as tx_db:
            record = StabilityRecord(
                id=eval_id,
                explanation_id=str(body.explanation_id),
                account_id=account.id,
                source_reference=body.source_reference or exp_record.source_reference,
                idempotency_key=str(body.idempotency_key) if body.idempotency_key else None,
                request_hash=eval_fingerprint,
                method=eval_res.method,
                explained_class=eval_res.explained_class,
                baseline_probability=eval_res.baseline_probability,
                model_id=eval_res.model_id or exp_record.model_id,
                model_version=eval_res.model_version or exp_record.model_version,
                model_revision=eval_res.model_revision or exp_record.model_revision,
                explainer_version=exp_record.explainer_version or "0.1.0",
                settings=settings_data,
                selected_occurrence_offsets=persisted_offsets,
                runs=persisted_runs,
                word_consistency=persisted_word_consistency,
                mean_top_k_overlap=eval_res.mean_top_k_overlap,
                mean_rank_correlation=eval_res.mean_rank_correlation,
                mean_attribution_std=eval_res.mean_attribution_std,
                requested_runs=eval_res.requested_runs,
                completed_runs=eval_res.completed_runs,
                effective_k=eval_res.effective_k,
                total_eligible_words=eval_res.total_eligible_words,
                is_deterministic=eval_res.is_deterministic,
                determinism_notice=eval_res.determinism_notice,
                execution_time_ms=eval_res.execution_time_ms,
                outcome=eval_res.outcome,
                outcome_message=eval_res.outcome_message,
                stopping_reason=eval_res.stopping_reason,
                is_development=True,
                created_at=created_time,
                updated_at=created_time,
                expires_at=now() + timedelta(hours=settings().retention_hours),
            )
            tx_db.add(record)
            tx_db.commit()
            eval_res.evaluation_id = UUID(eval_id)
            eval_res.created_at = created_time
            eval_res.saved = True
    except IntegrityError:
        if body.idempotency_key:
            with Session(engine()) as tx_db:
                existing = tx_db.scalar(
                    select(StabilityRecord).where(
                        StabilityRecord.account_id == account.id,
                        StabilityRecord.idempotency_key == str(body.idempotency_key),
                    )
                )
                if existing:
                    if existing.request_hash != eval_fingerprint:
                        raise SafeError(ErrorCode.CONFLICT, 409) from None
                    return stability_record_to_response(existing, source_text=body.text)
        eval_res.saved = False
    except Exception as exc:
        logger.exception("Failed to persist stability evaluation: %s", exc)
        eval_res.saved = False

    eval_res.source_reference = body.source_reference or exp_record.source_reference
    return eval_res


@app.get("/api/v1/c4/stability/{evaluation_id}", response_model=C4StabilityResponse)
def get_c4_stability(
    evaluation_id: UUID,
    account=Depends(auth.current_account),
    db: Session = Depends(session),
):
    """Retrieve an authenticated user's saved stability evaluation record by ID."""
    record = db.get(StabilityRecord, str(evaluation_id))
    if not record or record.account_id != account.id:
        raise SafeError(ErrorCode.NOT_FOUND, 404)
    if record.expires_at and record.expires_at <= now():
        raise SafeError(ErrorCode.NOT_FOUND, 404)
    return stability_record_to_response(record)


@app.get("/api/v1/c4/stability", response_model=C4StabilityListResponse)
def list_c4_stability(
    limit: int = 20,
    offset: int = 0,
    account=Depends(auth.current_account),
    db: Session = Depends(session),
):
    """Return a bounded, paginated list of the current user's stability evaluations."""
    bounded_limit = max(1, min(limit, 100))
    bounded_offset = max(0, offset)

    query = (
        select(StabilityRecord)
        .where(
            StabilityRecord.account_id == account.id,
            (StabilityRecord.expires_at.is_(None)) | (StabilityRecord.expires_at > now()),
        )
        .order_by(StabilityRecord.created_at.desc())
    )
    total = db.scalar(
        select(func.count(StabilityRecord.id)).where(
            StabilityRecord.account_id == account.id,
            (StabilityRecord.expires_at.is_(None)) | (StabilityRecord.expires_at > now()),
        )
    ) or 0

    records = db.scalars(query.offset(bounded_offset).limit(bounded_limit)).all()
    items = [
        C4StabilitySummary(
            evaluation_id=UUID(r.id),
            explanation_id=UUID(r.explanation_id),
            created_at=r.created_at,
            method=r.method,  # type: ignore[arg-type]
            explained_class=r.explained_class,
            mean_top_k_overlap=r.mean_top_k_overlap,
            mean_rank_correlation=r.mean_rank_correlation,
            mean_attribution_std=r.mean_attribution_std,
            requested_runs=r.requested_runs,
            completed_runs=r.completed_runs,
            outcome=r.outcome,
            is_development=r.is_development,
            source_reference=r.source_reference,
        )
        for r in records
    ]
    return C4StabilityListResponse(
        items=items,
        total=total,
        limit=bounded_limit,
        offset=bounded_offset,
    )


@app.get("/api/v1/c4/stability/by-explanation/{explanation_id}", response_model=C4StabilityResponse)
def get_c4_stability_by_explanation(
    explanation_id: UUID,
    account=Depends(auth.current_account),
    db: Session = Depends(session),
):
    """Retrieve the latest saved stability evaluation for a given explanation ID."""
    record = db.scalar(
        select(StabilityRecord)
        .where(
            StabilityRecord.explanation_id == str(explanation_id),
            StabilityRecord.account_id == account.id,
            (StabilityRecord.expires_at.is_(None)) | (StabilityRecord.expires_at > now()),
        )
        .order_by(StabilityRecord.created_at.desc())
    )
    if not record:
        raise SafeError(ErrorCode.NOT_FOUND, 404)
    return stability_record_to_response(record)




