"""Restricted operational receipts, with no identity linkage or counselling content."""

import base64
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from pydantic import AwareDatetime, ValidationError
from research_common.database import Audit, Case, CaseLink, Consent, Retention, session
from research_common.web import SafeError
from research_contracts import (
    PURPOSE,
    AdminAuditItem,
    AdminAuditPage,
    AdminCaseOperations,
    AdminEventType,
    ErrorCode,
    Role,
    ServiceProvenance,
    WorkflowState,
    now,
)
from sqlalchemy import and_, or_, select

from orchestrator import auth

router = APIRouter(prefix="/api/v1/admin", tags=["restricted operational evidence"])
administrator = auth.require_role(Role.ADMIN)

# Both event and outcome are allowlisted. Never serialize arbitrary stored status values.
OUTCOMES = {
    "AUTH_LOGIN": {"SYNTHETIC_SESSION", "SUCCESS"},
    "AUTH_FAILURE": {"DENIED", "REFRESH_DENIED"},
    "AUTH_LOGOUT": {"SUCCESS"},
    "AUTH_REFRESH": {"ROTATED"},
    "SESSION_REVOKED": {"REFRESH_DENIED", "STAFF_CHANGED"},
    "CONSENT_RECORDED": {"ACTIVE", "REJECTED"},
    "CONSENT_EXPIRED": {"DETECTED"},
    "OPERATION_BLOCKED": {"SUBMISSION", "PROCESSING", "REVIEW", "CONSENT_REQUIRED"},
    "SUBMISSION": {"ACCEPTED"},
    "SUBMISSION_REPLAY": {"DUPLICATE", "CONCURRENT", "RECOVERED"},
    "WORKFLOW_TRANSITION": {s.value for s in WorkflowState},
    "JOB_RETRY": {"DOWNSTREAM_FAILED", "DOWNSTREAM_TIMEOUT"},
    "JOB_TERMINAL": {e.value for e in ErrorCode},
    "JOB_CLAIM": {"CLAIMED", "LEASE_RECOVERED"},
    "ASSIGNMENT": {"AUTO_GRANTED", "GRANTED", "REASSIGNED", "CLEARED"},
    "HUMAN_REVIEW": {"START_REVIEW", "COMPLETE_REVIEW", "RECORD_SAVED"},
    "WITHDRAWAL": {"BEFORE_SUBMISSION", "WITHDRAWN"},
    "RETENTION": {"DERIVED_EVIDENCE_DELETED"},
    "ADMIN_EVIDENCE_ACCESS": {"VIEWED"},
    "STAFF_ADMINISTRATION": {"UPDATED"},
}


def cursor_for(row):
    return (
        base64.urlsafe_b64encode(f"{row.created_at.isoformat()}|{row.id}".encode())
        .decode()
        .rstrip("=")
    )


@router.get("/audit-events", response_model=AdminAuditPage)
def audit_events(
    request: Request,
    event_type: AdminEventType | None = None,
    case_id: UUID | None = None,
    since: AwareDatetime | None = None,
    until: AwareDatetime | None = None,
    cursor: str | None = Query(None, max_length=160),
    limit: int = Query(25, ge=1, le=50),
    account=Depends(administrator),
    db=Depends(session),
):
    if since and until and since > until:
        raise SafeError(ErrorCode.CONTRACT_INVALID, 422)
    allowed = or_(
        *(
            and_(Audit.event_type == key, Audit.status.in_(values))
            for key, values in OUTCOMES.items()
        )
    )
    query = select(Audit).where(allowed, Audit.service_version == "0.1.0")
    if event_type:
        query = query.where(Audit.event_type == event_type)
    if case_id:
        query = query.where(Audit.case_id == str(case_id))
    if since:
        query = query.where(Audit.created_at >= since)
    if until:
        query = query.where(Audit.created_at <= until)
    if cursor:
        try:
            instant, identifier = (
                base64.b64decode(cursor + "=" * (-len(cursor) % 4), altchars=b"-_", validate=True)
                .decode()
                .split("|")
            )
            instant, identifier = datetime.fromisoformat(instant), str(UUID(identifier))
            if instant.tzinfo is None:
                raise ValueError()
        except (ValueError, UnicodeError):
            raise SafeError(ErrorCode.CONTRACT_INVALID, 422) from None
        query = query.where(
            or_(
                Audit.created_at < instant, and_(Audit.created_at == instant, Audit.id < identifier)
            )
        )
    rows = db.scalars(
        query.order_by(Audit.created_at.desc(), Audit.id.desc()).limit(limit + 1)
    ).all()
    operations = None
    if case_id:
        # Select only operational columns. No account, consent or review text is projected.
        row = db.execute(
            select(
                Case.status,
                Case.error_code,
                Case.provenance,
                Case.correlation_id,
                Case.expires_at,
                Retention.reason,
                Consent.status,
                Consent.expires_at,
                Consent.purpose,
                Consent.version,
            )
            .outerjoin(Retention, Retention.case_id == Case.id)
            .outerjoin(CaseLink, CaseLink.case_id == Case.id)
            .outerjoin(Consent, Consent.id == CaseLink.consent_id)
            .where(Case.id == str(case_id))
        ).first()
        if row:
            provenance = None
            if (
                row[0] not in {"WITHDRAWN", "WITHDRAWAL_REQUESTED"}
                and row[4] > now()
                and row[6] == "ACTIVE"
                and row[7] > now()
                and row[8] == PURPOSE
                and row[9] == "dev-notice-1"
            ):
                try:
                    provenance = ServiceProvenance.model_validate(row[2])
                    if str(provenance.correlation_id) != row[3]:
                        provenance = None
                except ValidationError:
                    pass
            operations = AdminCaseOperations(
                case_id=case_id,
                processing_status=row[0],
                failure_code=row[1] if row[1] in set(ErrorCode) else None,
                retention_reason=row[5]
                if row[5] in {"RETENTION", "OWNER_WITHDRAWAL", "LEGACY_DISPOSAL"}
                else None,
                provenance=provenance,
            )
    # One read receipt per authenticated session, not per poll/filter/page. No actor linkage exported.
    auth.audit(
        db,
        request,
        "ADMIN_EVIDENCE_ACCESS",
        "VIEWED",
        once="admin-evidence:" + request.state.auth_session_id,
    )
    db.commit()
    return AdminAuditPage(
        items=[
            AdminAuditItem(
                event_id=row.id,
                event_type=row.event_type,
                outcome=row.status,
                occurred_at=row.created_at,
                policy_expires_at=row.policy_expires_at,
                case_id=row.case_id,
                correlation_id=row.correlation_id,
            )
            for row in rows[:limit]
        ],
        next_cursor=cursor_for(rows[limit - 1]) if len(rows) > limit else None,
        observed_at=now(),
        case_operations=operations,
    )
