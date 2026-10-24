"""Actual PostgreSQL allocation/staff races in a verified disposable schema."""

import json
import secrets
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from http.cookies import SimpleCookie
from threading import Barrier, Event
from types import SimpleNamespace
from uuid import UUID, uuid4

from fastapi import Response
from orchestrator import administration, analytics, auth, main, workflow
from research_common.database import (
    Account,
    Assignment,
    AuthSession,
    Case,
    Review,
    ReviewAction,
    engine,
)
from research_common.web import SafeError
from research_contracts import AssignmentChangeRequest, HumanReviewAction, StaffUpdateRequest
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session
from synthetic_runtime import create_case, isolated_postgres, request, synthetic_adapter


def wait_for_account_wait():
    deadline = time.monotonic() + 8
    while time.monotonic() < deadline:
        with engine().connect() as connection:
            if connection.scalar(
                text(
                    "SELECT count(*) FROM pg_stat_activity WHERE pid <> pg_backend_pid() AND wait_event_type = 'Lock' AND query LIKE '%access_accounts%'"
                )
            ):
                return
        Event().wait(0.01)
    raise AssertionError("Expected account lock wait was not observed")


def staff(role):
    with Session(engine(), expire_on_commit=False) as db, db.begin():
        account = Account(
            role=role,
            username=secrets.token_urlsafe(30),
            password_hash=auth.passwords.hash(secrets.token_urlsafe(36)),
        )
        db.add(account)
        db.flush()
        response = Response()
        auth.issue(db, account, response)
        db.flush()
        record = db.scalar(select(AuthSession).where(AuthSession.account_id == account.id))
        cookies = SimpleCookie()
        for header in response.headers.getlist("set-cookie"):
            cookies.load(header)
        identifier, refresh = record.id, cookies["j26_refresh"].value
    return account, identifier, refresh


def principal_request(session_id):
    result = request()
    result.state.auth_session_id = session_id
    return result


def run():
    checks = []
    with isolated_postgres():
        admin, admin_session, _ = staff("ADMIN")
        old, old_session, _ = staff("COUNSELLOR")
        new, new_session, _ = staff("COUNSELLOR")

        def review_case():
            _, _, case_id = create_case()
            workflow.process_job(*workflow.claim_job(), adapter=synthetic_adapter)
            with Session(engine(), expire_on_commit=False) as db, db.begin():
                task = db.scalar(select(Review).where(Review.case_id == case_id))
                db.add(Assignment(case_id=case_id, counsellor_id=old.id))
            return case_id, task.id

        def reassign(case_id):
            with Session(engine(), expire_on_commit=False) as db:
                return administration.assign_case(
                    UUID(case_id),
                    AssignmentChangeRequest(
                        counsellor_id=new.id,
                        expected_version=administration.assignment_version([old.id]),
                    ),
                    principal_request(admin_session),
                    admin,
                    db,
                )

        def old_start(task_id):
            with Session(engine(), expire_on_commit=False) as db:
                try:
                    main.review_action(
                        UUID(task_id),
                        HumanReviewAction(action="START_REVIEW", idempotency_key=uuid4()),
                        principal_request(old_session),
                        old,
                        db,
                    )
                    return 200
                except SafeError as error:
                    return error.status

        from postgres_checks import wait_for_lock_wait

        case_id, task_id = review_case()
        with Session(engine(), expire_on_commit=False) as blocker:
            blocker.scalar(select(Case).where(Case.id == case_id).with_for_update())
            with ThreadPoolExecutor(max_workers=1) as pool:
                waiting_review = pool.submit(old_start, task_id)
                wait_for_lock_wait()
                administration.assign_case(
                    UUID(case_id),
                    AssignmentChangeRequest(
                        counsellor_id=new.id,
                        expected_version=administration.assignment_version([old.id]),
                    ),
                    principal_request(admin_session),
                    admin,
                    blocker,
                )
                blocker.rollback()
                assert waiting_review.result(timeout=15) == 404
        with Session(engine()) as db:
            assert db.scalar(select(ReviewAction).where(ReviewAction.task_id == task_id)) is None
        checks.append("reassignment_before_waiting_review_denies_old_counsellor")

        case_id, task_id = review_case()
        with Session(engine(), expire_on_commit=False) as blocker:
            blocker.scalar(select(Case).where(Case.id == case_id).with_for_update())
            with ThreadPoolExecutor(max_workers=1) as pool:
                assigning = pool.submit(reassign, case_id)
                wait_for_lock_wait()
                main.review_action(
                    UUID(task_id),
                    HumanReviewAction(action="START_REVIEW", idempotency_key=uuid4()),
                    principal_request(old_session),
                    old,
                    blocker,
                )
                blocker.rollback()
                assert assigning.result(timeout=15).assignment_count == 1
        assert old_start(task_id) == 404
        with Session(engine(), expire_on_commit=False) as db:
            result = main.review_action(
                UUID(task_id),
                HumanReviewAction(action="COMPLETE_REVIEW", idempotency_key=uuid4()),
                principal_request(new_session),
                new,
                db,
            )
            assert result.case.processing_status == "COMPLETED"
        checks.append("review_before_reassignment_linearizes_then_revokes_old_access")

        second_admin, second_session, _ = staff("ADMIN")
        gate = Barrier(2)

        def disable_admin(actor, session_id, target):
            gate.wait(timeout=8)
            with Session(engine(), expire_on_commit=False) as db:
                try:
                    administration.update_staff(
                        UUID(target.id),
                        StaffUpdateRequest(
                            role="ADMIN", enabled=False, expected_updated_at=target.updated_at
                        ),
                        principal_request(session_id),
                        actor,
                        db,
                    )
                    return 200
                except SafeError as error:
                    return error.status

        with ThreadPoolExecutor(max_workers=2) as pool:
            first = pool.submit(disable_admin, admin, admin_session, second_admin)
            second = pool.submit(disable_admin, second_admin, second_session, admin)
            assert sorted([first.result(timeout=15), second.result(timeout=15)]) == [200, 401]
        with Session(engine(), expire_on_commit=False) as db:
            enabled_admins = db.scalars(
                select(Account).where(Account.role == "ADMIN", Account.enabled.is_(True))
            ).all()
            assert len(enabled_admins) == 1
            active = enabled_admins[0]
            active_session = db.scalar(
                select(AuthSession.id).where(
                    AuthSession.account_id == active.id, AuthSession.revoked.is_(False)
                )
            )
        checks.append("competing_admin_disables_preserve_one_usable_admin")

        target, _, refresh_token = staff("COUNSELLOR")

        def refresh_target():
            incoming = SimpleNamespace(
                method="POST",
                headers={"origin": "http://localhost:3000", "x-requested-with": "j26-browser"},
                cookies={"j26_refresh": refresh_token},
                client=None,
                state=SimpleNamespace(correlation_id=uuid4()),
            )
            with Session(engine(), expire_on_commit=False) as db:
                try:
                    auth.refresh(incoming, Response(), db)
                    return 200
                except SafeError as error:
                    return error.status

        with Session(engine(), expire_on_commit=False) as blocker:
            administration.lock_staff(blocker)
            with ThreadPoolExecutor(max_workers=1) as pool:
                rotating = pool.submit(refresh_target)
                wait_for_account_wait()
                administration.update_staff(
                    UUID(target.id),
                    StaffUpdateRequest(
                        role="COUNSELLOR", enabled=False, expected_updated_at=target.updated_at
                    ),
                    principal_request(active_session),
                    active,
                    blocker,
                )
                blocker.rollback()
                assert rotating.result(timeout=15) == 401
        with Session(engine()) as db:
            assert (
                db.scalar(
                    select(func.count())
                    .select_from(AuthSession)
                    .where(AuthSession.account_id == target.id, AuthSession.revoked.is_(False))
                )
                == 0
            )
        checks.append("staff_disable_serializes_with_refresh_and_revokes_sessions")
        # Exercise the PostgreSQL-specific UTC aggregate expression in the same verified
        # disposable schema. This is metadata-only and does not query development records.
        _, _, aggregate_case = create_case()
        workflow.process_job(*workflow.claim_job(), adapter=synthetic_adapter)
        boundary = datetime(2026, 10, 19, tzinfo=UTC)
        with Session(engine(), expire_on_commit=False) as db, db.begin():
            db.get(Case, aggregate_case).created_at = boundary
        with Session(engine()) as db:
            filters = administration.CaseFilters(
                q=aggregate_case,
                state=None,
                assignment=None,
                eligible_only=False,
                disposed_only=False,
                since=boundary,
                until=boundary + timedelta(days=7),
            )
            aggregate = analytics.analytics(filters, "week", active, db)
            table = administration.cases(filters, 0, 20, active, db)
            assert aggregate.total_cases == len(table.items) == 1
            assert sum(row.cases for row in aggregate.submissions) == 1
            assert aggregate.submissions[0].bucket_start == boundary
            filters.until = boundary
            filters.since = boundary - timedelta(days=1)
            assert analytics.analytics(filters, "day", active, db).total_cases == 0
        checks.append("postgres_utc_chart_table_parity_and_exclusive_upper_boundary")
    return {
        "synthetic": True,
        "database": "PostgreSQL",
        "passed": len(checks),
        "checks": checks,
        "isolation": "Verified new UUID schema only; development records and volume preserved.",
    }


if __name__ == "__main__":
    try:
        print(json.dumps(run(), indent=2))
    except Exception as error:
        print(json.dumps({"passed": False, "error_type": type(error).__name__}))
        raise SystemExit(1) from None
