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
    CounterfactualRecord,
    Explanation,
    Job,
    Retention,
    Review,
    ReviewAction,
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
    C4PredictionRequest,
    C4PredictionResponse,
    ConsentDecision,
    ConsentLifecycle,
    ConsentRecord,
    CounterfactualCandidate,
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


def counterfactual_record_to_response(
    record: CounterfactualRecord,
) -> C4CounterfactualResponse:
    raw_candidates = record.candidates or []
    candidates: list[CounterfactualCandidate] = []
    for c in raw_candidates:
        edits = [
            EditOperation(
                op=e["op"],
                index=e["index"],
                original=e.get("original"),
                replacement=e.get("replacement"),
            )
            for e in c.get("edits", [])
        ]
        candidates.append(
            CounterfactualCandidate(
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
                    "Smallest edit distance found within this bounded search; not a global guarantee.",
                ),
                verified=c.get("verified", True),
            )
        )

    best_candidate: CounterfactualCandidate | None = None
    if record.best_candidate:
        b = record.best_candidate
        b_edits = [
            EditOperation(
                op=e["op"],
                index=e["index"],
                original=e.get("original"),
                replacement=e.get("replacement"),
            )
            for e in b.get("edits", [])
        ]
        best_candidate = CounterfactualCandidate(
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
                "Smallest edit distance found within this bounded search; not a global guarantee.",
            ),
            verified=b.get("verified", True),
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


@app.post("/api/v1/c4/counterfactuals", response_model=C4CounterfactualResponse, status_code=201)
def create_c4_counterfactual(
    body: C4CounterfactualRequest,
    request: Request,
    account=Depends(auth.current_account),
):
    """Generate and persist an authenticated model-backed counterfactual explanation."""
    auth.csrf(request)
    if account.role not in {Role.COUNSELLOR, Role.ADMIN, Role.RESEARCHER}:
        raise SafeError(ErrorCode.FORBIDDEN, 403)

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
            },
            sort_keys=True,
        ).encode()
    ).hexdigest()

    # Idempotency check before inference
    if body.idempotency_key:
        with Session(engine()) as db:
            existing = db.scalar(
                select(CounterfactualRecord).where(
                    CounterfactualRecord.account_id == account.id,
                    CounterfactualRecord.idempotency_key == str(body.idempotency_key),
                )
            )
            if existing:
                if existing.request_hash != fingerprint:
                    raise SafeError(ErrorCode.CONFLICT, 409)
                if existing.expires_at and existing.expires_at <= now():
                    raise SafeError(ErrorCode.NOT_FOUND, 404)
                return counterfactual_record_to_response(existing)

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
                account_id=account.id,
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
                        CounterfactualRecord.account_id == account.id,
                        CounterfactualRecord.idempotency_key == str(body.idempotency_key),
                    )
                )
                if existing:
                    if existing.request_hash != fingerprint:
                        raise SafeError(ErrorCode.CONFLICT, 409) from None
                    if existing.expires_at and existing.expires_at <= now():
                        raise SafeError(ErrorCode.NOT_FOUND, 404) from None
                    return counterfactual_record_to_response(existing)
        raise SafeError(ErrorCode.CONFLICT, 409) from None
    except Exception as exc:
        logger.exception("Failed to persist counterfactual: %s", exc)
        raise SafeError(ErrorCode.INTERNAL_ERROR, 500) from None

    cf_res.counterfactual_id = UUID(cf_id)
    cf_res.created_at = saved_created_at
    cf_res.source_reference = body.source_reference
    return cf_res


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
    return counterfactual_record_to_response(record)


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


