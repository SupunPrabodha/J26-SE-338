"""Staff and allocation controls over existing models; never counselling content."""

import hashlib
from datetime import UTC
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from pydantic import AwareDatetime
from research_common.config import settings
from research_common.database import (
    Account,
    Assignment,
    Audit,
    AuthSession,
    Case,
    CaseLink,
    Consent,
    Job,
    Retention,
    Review,
    session,
)
from research_common.web import SafeError
from research_contracts import (
    PURPOSE,
    AdminCasePage,
    AdminCaseSummary,
    AdminOverview,
    AssignmentChangeRequest,
    ComponentDirectory,
    ComponentRoute,
    ErrorCode,
    Role,
    StaffPage,
    StaffSummary,
    StaffUpdateRequest,
    WorkflowState,
    now,
)
from sqlalchemy import delete, func, select, update

from orchestrator import auth
from orchestrator.workflow import check_case_consent, lock_case

router = APIRouter(prefix="/api/v1", tags=["restricted staff and allocation"])
administrator = auth.require_role(Role.ADMIN)
research_access = auth.require_role(Role.ADMIN, Role.COUNSELLOR, Role.RESEARCHER)
STAFF_ROLES = ("ADMIN", "COUNSELLOR", "RESEARCHER")
REVIEW_STATES = ("READY_FOR_REVIEW", "UNDER_REVIEW", "COMPLETED")


def staff_summary(row, actor=None):
    return StaffSummary(
        account_id=row.id,
        display_name=staff_display_name(row.id, row.role),
        role=row.role,
        enabled=row.enabled,
        usable=auth.usable_staff(row),
        created_at=row.created_at,
        updated_at=row.updated_at,
        expires_at=row.expires_at,
        is_current_account=bool(actor and actor.id == row.id),
    )


def staff_display_name(identifier, role="COUNSELLOR"):
    # A permitted local staff pseudonym, never the private login handle or a student identity.
    return f"{role.title()} {identifier[:8]}"


def lock_staff(db):
    # All administration account locks are sorted. Domain locks precede staff locks;
    # account locks precede session locks. Staff mutation never acquires a case lock.
    return db.scalars(
        select(Account)
        .where(Account.role.in_(STAFF_ROLES))
        .order_by(Account.id)
        .with_for_update()
        .execution_options(populate_existing=True)
    ).all()


def eligible():
    return (
        Case.status.in_(REVIEW_STATES)
        & (Case.expires_at > now())
        & (Consent.status == "ACTIVE")
        & (Consent.expires_at > now())
        & (Consent.purpose == PURPOSE)
        & (Consent.version == "dev-notice-1")
        & (select(Review.id).where(Review.case_id == Case.id).exists())
    )


def assignment_version(ids):
    return hashlib.sha256(",".join(sorted(ids)).encode()).hexdigest()


def assignment_ids(db, case_id):
    return list(db.scalars(select(Assignment.counsellor_id).where(Assignment.case_id == case_id)))


def case_query():
    return (
        select(
            Case.id,
            Case.status,
            Case.created_at,
            Case.updated_at,
            Case.expires_at,
            Case.error_code,
            Job.status.label("job_status"),
            Job.attempts,
            Retention.reason,
            func.coalesce(eligible(), False).label("eligible"),
        )
        .outerjoin(CaseLink, CaseLink.case_id == Case.id)
        .outerjoin(Consent, Consent.id == CaseLink.consent_id)
        .outerjoin(Job, Job.case_id == Case.id)
        .outerjoin(Retention, Retention.case_id == Case.id)
    )


def case_summary(db, row, actor):
    ids = assignment_ids(db, row.id)
    staff = db.scalars(
        select(Account)
        .where(Account.id.in_(ids), Account.role.in_(STAFF_ROLES))
        .order_by(Account.id)
        .limit(20)
    ).all()
    return AdminCaseSummary(
        case_id=row.id,
        processing_status=row.status,
        created_at=row.created_at,
        updated_at=row.updated_at,
        expires_at=row.expires_at,
        assignment_eligible=row.eligible,
        assignment_state="NOT_ELIGIBLE"
        if not row.eligible
        else "ASSIGNED"
        if ids
        else "AWAITING_ASSIGNMENT",
        assignment_version=assignment_version(ids),
        assignment_count=len(ids),
        counsellors=[staff_summary(a, actor) for a in staff],
        last_assignment_at=db.scalar(
            select(func.max(Audit.created_at)).where(
                Audit.case_id == row.id,
                Audit.event_type == "ASSIGNMENT",
                Audit.status.in_(("AUTO_GRANTED", "GRANTED", "REASSIGNED", "CLEARED")),
            )
        ),
        human_review_status={
            "READY_FOR_REVIEW": "AWAITING_REVIEW",
            "UNDER_REVIEW": "IN_PROGRESS",
            "COMPLETED": "COMPLETED",
        }.get(row.status, "UNAVAILABLE"),
        job_status=row.job_status,
        attempts=row.attempts or 0,
        failure_code=row.error_code if row.error_code in set(ErrorCode) else None,
        disposal_reason=row.reason
        if row.reason in {"RETENTION", "OWNER_WITHDRAWAL", "LEGACY_DISPOSAL"}
        else None,
    )


@router.get("/admin/overview", response_model=AdminOverview)
def overview(account=Depends(administrator), db=Depends(session)):
    query = (
        select(Case.id)
        .join(CaseLink, CaseLink.case_id == Case.id)
        .join(Consent, Consent.id == CaseLink.consent_id)
        .where(eligible())
    )
    assigned = select(Assignment.id).where(Assignment.case_id == Case.id).exists()

    def count(query):
        return db.scalar(select(func.count()).select_from(query.subquery()))

    usable = (
        Account.enabled.is_(True)
        & (Account.expires_at.is_(None) | (Account.expires_at > now()))
        & Account.username.is_not(None)
        & Account.password_hash.is_not(None)
    )
    designated = db.scalar(
        select(Account).where(
            Account.username == settings().dev_counsellor_username, Account.role == "COUNSELLOR"
        )
    )
    return AdminOverview(
        eligible_cases=count(query),
        awaiting_assignment=count(query.where(~assigned)),
        assigned_cases=count(query.where(assigned)),
        active_counsellors=count(select(Account.id).where(usable, Account.role == "COUNSELLOR")),
        enabled_staff=count(
            select(Account.id).where(Account.enabled.is_(True), Account.role.in_(STAFF_ROLES))
        ),
        pending_jobs=count(select(Job.id).where(Job.status.in_(("QUEUED", "RUNNING")))),
        failed_cases=count(select(Case.id).where(Case.status == "FAILED")),
        disposed_cases=count(select(Case.id).where(Case.status == "WITHDRAWN")),
        assignment_policy=settings().assignment_policy,
        designated_counsellor_available=auth.usable_staff(designated),
        retention_hours=settings().retention_hours,
        observed_at=now(),
    )


@router.get("/admin/staff", response_model=StaffPage)
def staff_list(
    q: str | None = Query(None, pattern="^[0-9a-fA-F-]{4,36}$"),
    role: str | None = Query(None, pattern="^(ADMIN|COUNSELLOR|RESEARCHER)$"),
    enabled: bool | None = None,
    offset: int = Query(0, ge=0, le=10000),
    limit: int = Query(20, ge=1, le=20),
    account=Depends(administrator),
    db=Depends(session),
):
    query = select(Account).where(Account.role.in_(STAFF_ROLES))
    if q:
        query = query.where(Account.id.startswith(q.lower()))
    if role:
        query = query.where(Account.role == role)
    if enabled is not None:
        query = query.where(Account.enabled == enabled)
    rows = db.scalars(query.order_by(Account.id).offset(offset).limit(limit + 1)).all()
    return StaffPage(
        items=[staff_summary(a, account) for a in rows[:limit]],
        next_offset=offset + limit if len(rows) > limit and offset + limit <= 10000 else None,
        observed_at=now(),
    )


@router.post("/admin/staff/{staff_id}", response_model=StaffSummary)
def update_staff(
    staff_id: UUID,
    body: StaffUpdateRequest,
    request: Request,
    account=Depends(administrator),
    db=Depends(session),
):
    rows = lock_staff(db)
    auth.lock_valid_account(db, account, request, "ADMIN")
    target = next((row for row in rows if row.id == str(staff_id)), None)
    if not target:
        raise SafeError(ErrorCode.NOT_FOUND, 404)
    if target.role == body.role and target.enabled == body.enabled:
        return staff_summary(target, account)
    if target.updated_at != body.expected_updated_at:
        raise SafeError(ErrorCode.CONFLICT, 409)
    remaining = [
        a for a in rows if a.id != target.id and a.role == "ADMIN" and auth.usable_staff(a)
    ]
    if not remaining and not (
        body.role == "ADMIN"
        and body.enabled
        and target.username
        and target.password_hash
        and (target.expires_at is None or target.expires_at > now())
    ):
        raise SafeError(ErrorCode.CONFLICT, 409)
    target.role, target.enabled = body.role, body.enabled
    db.execute(update(AuthSession).where(AuthSession.account_id == target.id).values(revoked=True))
    auth.audit(db, request, "STAFF_ADMINISTRATION", "UPDATED")
    auth.audit(db, request, "SESSION_REVOKED", "STAFF_CHANGED")
    db.commit()
    return staff_summary(target, account)


class CaseFilters:
    """One filter definition for administration case tables and aggregate charts."""

    def __init__(
        self,
        q: str | None = Query(None, pattern="^[0-9a-fA-F-]{4,36}$"),
        state: WorkflowState | None = None,
        assignment: str | None = Query(None, pattern="^(AWAITING_ASSIGNMENT|ASSIGNED)$"),
        eligible_only: bool = False,
        disposed_only: bool = False,
        since: AwareDatetime | None = None,
        until: AwareDatetime | None = None,
    ):
        if since and until and since >= until:
            raise SafeError(ErrorCode.CONTRACT_INVALID, 422)
        self.q, self.state, self.assignment = q, state, assignment
        self.eligible_only, self.disposed_only = eligible_only, disposed_only
        self.since = since.astimezone(UTC) if since else None
        self.until = until.astimezone(UTC) if until else None

    def apply(self, query):
        if self.q:
            query = query.where(Case.id.startswith(self.q.lower()))
        if self.state:
            query = query.where(Case.status == self.state)
        if self.eligible_only or self.assignment:
            query = query.where(eligible())
        if self.disposed_only:
            query = query.where(Case.status == "WITHDRAWN")
        if self.assignment:
            exists = select(Assignment.id).where(Assignment.case_id == Case.id).exists()
            query = query.where(exists if self.assignment == "ASSIGNED" else ~exists)
        if self.since:
            query = query.where(Case.created_at >= self.since)
        if self.until:
            query = query.where(Case.created_at < self.until)
        return query


@router.get("/admin/cases", response_model=AdminCasePage)
def cases(
    filters: CaseFilters = Depends(),
    offset: int = Query(0, ge=0, le=10000),
    limit: int = Query(20, ge=1, le=20),
    account=Depends(administrator),
    db=Depends(session),
):
    query = filters.apply(case_query())
    rows = db.execute(
        query.order_by(Case.created_at.desc(), Case.id).offset(offset).limit(limit + 1)
    ).all()
    return AdminCasePage(
        items=[case_summary(db, row, account) for row in rows[:limit]],
        next_offset=offset + limit if len(rows) > limit and offset + limit <= 10000 else None,
        observed_at=now(),
    )


def allocation_case(db, case_id):
    case = lock_case(db, case_id)
    check_case_consent(db, case, "REVIEW")
    if case.status not in REVIEW_STATES or not db.scalar(
        select(Review.id).where(Review.case_id == case.id)
    ):
        raise SafeError(ErrorCode.CONFLICT, 409)
    return case


@router.post("/admin/cases/{case_id}/assignment", response_model=AdminCaseSummary)
def assign_case(
    case_id: UUID,
    body: AssignmentChangeRequest,
    request: Request,
    account=Depends(administrator),
    db=Depends(session),
):
    case = allocation_case(db, str(case_id))
    staff = lock_staff(db)
    auth.lock_valid_account(db, account, request, "ADMIN")
    desired = str(body.counsellor_id) if body.counsellor_id else None
    if desired:
        target = next((a for a in staff if a.id == desired), None)
        if not auth.usable_staff(target) or target.role != "COUNSELLOR":
            raise SafeError(ErrorCode.FORBIDDEN, 403)
    current = assignment_ids(db, case.id)
    if sorted(current) != ([desired] if desired else []):
        if body.expected_version != assignment_version(current):
            raise SafeError(ErrorCode.CONFLICT, 409)
        db.execute(delete(Assignment).where(Assignment.case_id == case.id))
        if desired:
            db.add(Assignment(case_id=case.id, counsellor_id=desired))
        auth.audit(
            db,
            request,
            "ASSIGNMENT",
            "REASSIGNED" if current and desired else "GRANTED" if desired else "CLEARED",
            case.id,
        )
        db.commit()
    return case_summary(db, db.execute(case_query().where(Case.id == case.id)).one(), account)


def grant_legacy_assignment(db, case_id, counsellor_id, request, account):
    # Existing contract remains an additive grant. Explicit exclusive reassignment is separate.
    case = allocation_case(db, case_id)
    staff = lock_staff(db)
    auth.lock_valid_account(db, account, request, "ADMIN")
    target = next((a for a in staff if a.id == counsellor_id), None)
    if not auth.usable_staff(target) or target.role != "COUNSELLOR":
        raise SafeError(ErrorCode.FORBIDDEN, 403)
    if counsellor_id not in assignment_ids(db, case.id):
        db.add(Assignment(case_id=case.id, counsellor_id=counsellor_id))
        auth.audit(db, request, "ASSIGNMENT", "GRANTED", case.id)
        db.commit()


@router.get("/component-routes", response_model=ComponentDirectory)
def component_routes(account=Depends(research_access)):
    # No teammate web routes exist in this checkout. Internal service endpoints are not links.
    return ComponentDirectory(
        items=[
            ComponentRoute(
                component=component, function=function, provider="MOCK_SYNTHETIC_DEVELOPMENT_ONLY"
            )
            for component, function in (
                ("C2", "PREPROCESSING"),
                ("C3", "INFERENCE"),
                ("C4", "EXPLANATION"),
            )
        ],
        observed_at=now(),
    )
