import hashlib
from datetime import timedelta
from uuid import UUID

from fastapi import Depends, Request, Response
from research_common.config import settings
from research_common.database import (
    Account,
    Assignment,
    Case,
    CaseLink,
    Consent,
    Job,
    Review,
    ReviewAction,
    Withdrawal,
    session,
)
from research_common.web import SafeError, create_app
from research_contracts import (
    FIXTURES,
    AccountResponse,
    AssignmentRequest,
    ConsentDecision,
    ConsentRecord,
    ErrorCode,
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
from sqlalchemy import select
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
    check_case_consent(db, case)
    if case.status not in {"READY_FOR_REVIEW", "UNDER_REVIEW", "COMPLETED"}:
        raise SafeError(ErrorCode.NOT_FOUND, 404)
    return task, case


def review_response(task, case):
    return ReviewTask(
        task_id=task.id,
        case=case_response(case),
        inference=case.inference,
        explanation=case.explanation,
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
    auth.audit(db, request, "CONSENT_RECORDED", body.consent_status)
    db.commit()
    return consent_response(consent)


@app.get("/api/v1/consents/{consent_id}", response_model=ConsentRecord)
def get_consent(consent_id: UUID, account=Depends(student), db: Session = Depends(session)):
    consent = db.get(Consent, str(consent_id))
    if not consent or consent.account_id != account.id:
        raise SafeError(ErrorCode.NOT_FOUND, 404)
    return consent_response(consent)


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
        check_case_consent(db, case)
        if existing.request_hash != fingerprint:
            raise SafeError(ErrorCode.CONFLICT, 409)
        return case_response(case)
    consent = db.scalar(select(Consent).where(Consent.id == str(body.consent_id)).with_for_update())
    if consent and consent.account_id != account.id:
        raise SafeError(ErrorCode.NOT_FOUND, 404)
    active_consent(consent)
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
            check_case_consent(db, case)
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
            return case_response(own_case(db, existing.case_id, account))
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
        dispose(db, case, request)
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
