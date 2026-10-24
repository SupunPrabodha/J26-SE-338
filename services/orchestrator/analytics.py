"""Bounded administration aggregates over safe case metadata, never model/review payloads."""

from datetime import UTC, datetime, timedelta
from typing import Literal

from fastapi import APIRouter, Depends
from research_common.database import Account, Assignment, Case, session
from research_common.web import SafeError
from research_contracts import AdminAnalytics, ErrorCode, now
from sqlalchemy import func, select

from orchestrator.administration import (
    CaseFilters,
    administrator,
    case_query,
    eligible,
    staff_display_name,
)

router = APIRouter(prefix="/api/v1/admin", tags=["restricted operational aggregates"])


@router.get("/analytics", response_model=AdminAnalytics)
def analytics(
    filters: CaseFilters = Depends(),
    interval: Literal["day", "week"] = "day",
    account=Depends(administrator),
    db=Depends(session),
):
    observed = now()
    until = filters.until or observed.replace(
        hour=0, minute=0, second=0, microsecond=0
    ) + timedelta(days=1)
    since = filters.since or until - timedelta(days=7)
    if since >= until or until - since > timedelta(days=366):
        raise SafeError(ErrorCode.CONTRACT_INVALID, 422)
    filters.since, filters.until = since, until
    scope = filters.apply(case_query()).with_only_columns(Case.id).subquery()
    scoped = Case.id.in_(select(scope.c.id))
    statuses = db.execute(
        select(Case.status, func.count()).where(scoped).group_by(Case.status).order_by(Case.status)
    ).all()
    # Group only safe counts in SQL. Explicit UTC boundaries work on PostgreSQL and test SQLite.
    day = (
        func.date(func.timezone("UTC", Case.created_at))
        if db.bind.dialect.name == "postgresql"
        else func.date(Case.created_at)
    )
    daily = db.execute(select(day, func.count()).where(scoped).group_by(day)).all()
    buckets = {}
    start = since.astimezone(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
    if interval == "week":
        start -= timedelta(days=start.weekday())
    cursor = start
    while cursor < until:
        buckets[cursor] = 0
        cursor += timedelta(days=7 if interval == "week" else 1)
    for date, count in daily:
        instant = datetime.fromisoformat(str(date)).replace(tzinfo=UTC)
        if interval == "week":
            instant -= timedelta(days=instant.weekday())
        buckets[instant] += count
    usable = (
        Account.enabled.is_(True)
        & (Account.expires_at.is_(None) | (Account.expires_at > observed))
        & Account.username.is_not(None)
        & Account.password_hash.is_not(None)
        & (Account.role == "COUNSELLOR")
    )
    # Workload is a subset: active grants to usable staff on review-ready/in-progress cases.
    # Reuse scope and policy predicates; never count completed/disposed/expired work as active.
    from research_common.database import CaseLink, Consent

    workload = (
        select(Assignment.counsellor_id.label("id"), func.count().label("cases"))
        .join(Case, Case.id == Assignment.case_id)
        .join(CaseLink, CaseLink.case_id == Case.id)
        .join(Consent, Consent.id == CaseLink.consent_id)
        .join(Account, Account.id == Assignment.counsellor_id)
        .where(scoped, eligible(), Case.status.in_(("READY_FOR_REVIEW", "UNDER_REVIEW")), usable)
        .group_by(Assignment.counsellor_id)
    ).subquery()
    pairs = db.scalar(select(func.coalesce(func.sum(workload.c.cases), 0)))
    rows = db.execute(
        select(workload).order_by(workload.c.cases.desc(), workload.c.id).limit(20)
    ).all()
    workloads = [
        {"counsellor_id": row.id, "display_name": staff_display_name(row.id), "cases": row.cases}
        for row in rows
    ]
    remainder = pairs - sum(row.cases for row in rows)
    if remainder:
        workloads.append(
            {"counsellor_id": None, "display_name": "Other active counsellors", "cases": remainder}
        )
    return AdminAnalytics(
        since=since,
        until=until,
        interval=interval,
        total_cases=sum(row[1] for row in statuses),
        statuses=[{"state": state, "cases": count} for state, count in statuses],
        submissions=[{"bucket_start": date, "cases": count} for date, count in buckets.items()],
        workload=workloads,
        workload_assignment_pairs=pairs,
        observed_at=observed,
    )
