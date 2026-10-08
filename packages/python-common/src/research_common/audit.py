"""Allowlisted receipts. Stable IDs bound policy events; never update existing audit rows."""

from uuid import NAMESPACE_URL, uuid5

from research_contracts import LifecycleAuditEvent
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from research_common.database import Audit, CaseLink


def record(
    db,
    request,
    event,
    status,
    case_id=None,
    *,
    once=None,
    expires_at=None,
    pending=False,
    consent_id=None,
):
    if case_id and not consent_id:
        with db.no_autoflush:
            link = next(
                (row for row in db.new if isinstance(row, CaseLink) and row.case_id == case_id),
                None,
            )
            link = link or db.get(CaseLink, case_id)
            consent_id = link.consent_id if link else None
    trace_id = str(uuid5(NAMESPACE_URL, "j26-trace:" + consent_id)) if consent_id else None
    item = LifecycleAuditEvent(
        case_id=case_id,
        correlation_id=request.state.correlation_id,
        event_type=event,
        status=status,
        policy_expires_at=expires_at,
    )
    values = dict(
        id=str(uuid5(NAMESPACE_URL, "j26-audit:" + once)) if once else str(item.event_id),
        case_id=str(case_id) if case_id else None,
        correlation_id=str(item.correlation_id),
        event_type=item.event_type,
        status=item.status,
        trace_id=trace_id,
        created_at=item.created_at,
        policy_expires_at=item.policy_expires_at,
    )
    if pending:
        db.info.setdefault("pending_audit", []).append(values)
    elif once is None:
        db.add(Audit(**values))
    else:
        insert_event(db, values)


def insert_event(db, values):
    insert = pg_insert if db.bind.dialect.name == "postgresql" else sqlite_insert
    db.execute(insert(Audit).values(**values).on_conflict_do_nothing(index_elements=["id"]))


def flush_pending(db):
    for values in db.info.pop("pending_audit", []):
        insert_event(db, values)
