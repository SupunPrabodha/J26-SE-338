"""Deterministic PostgreSQL races; print only safe aggregate evidence."""

import json
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier, Event
from uuid import UUID, uuid4

from orchestrator import main, workflow
from research_common.database import Audit, Case, Consent, Job, Review, Withdrawal, engine
from research_common.web import SafeError
from research_contracts import ErrorCode, WithdrawalRequest, now
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session
from synthetic_runtime import (
    create_case,
    isolated_postgres,
    owner_consent,
    request,
    submission,
    synthetic_adapter,
)


def expire_lease(case_id, attempts=None):
    with Session(engine()) as db, db.begin():
        job = db.scalar(select(Job).where(Job.case_id == case_id))
        job.lease_until = now() - timedelta(seconds=1)
        if attempts is not None:
            job.attempts = attempts


def withdraw(owner, consent):
    with Session(engine(), expire_on_commit=False) as db:
        return main.withdraw_consent(
            UUID(consent.id), WithdrawalRequest(idempotency_key=uuid4()), request(), owner, db
        )


def assert_disposed(case_id):
    with Session(engine()) as db:
        case = db.get(Case, case_id)
        job = db.scalar(select(Job).where(Job.case_id == case_id))
        assert case.status == "WITHDRAWN" and case.inference is None and case.provenance is None
        assert job.status == "CANCELLED" and job.fixture_id is None and job.lease_until is None
        assert (
            db.scalar(
                select(func.count()).select_from(Withdrawal).where(Withdrawal.case_id == case_id)
            )
            == 1
        )


def wait_for_lock_wait():
    # Inspect the database's lock wait rather than assuming a sleeping thread has reached SQL.
    deadline = time.monotonic() + 8
    while time.monotonic() < deadline:
        with engine().connect() as connection:
            if connection.scalar(
                text(
                    "SELECT count(*) FROM pg_stat_activity WHERE pid <> pg_backend_pid() AND wait_event_type = 'Lock' AND query LIKE '%workflow_cases%'"
                )
            ):
                return
        Event().wait(0.01)
    raise AssertionError("Expected PostgreSQL lock wait was not observed")


def run():
    results = []
    with isolated_postgres():
        batch = [create_case() for _ in range(4)]
        gate = Barrier(4)

        def parallel_claim():
            gate.wait(timeout=8)
            return workflow.claim_job()

        with ThreadPoolExecutor(max_workers=4) as pool:
            claims = [
                future.result(timeout=15) for future in [pool.submit(parallel_claim) for _ in batch]
            ]
        assert all(claims) and len({item[0] for item in claims}) == 4
        for owner, consent, case_id in batch:
            withdraw(owner, consent)
            assert_disposed(case_id)
        results.append("parallel_claims_do_not_lock_entire_queue")
        owner, consent, case_id = create_case()
        old = workflow.claim_job()
        expire_lease(case_id)
        recovered = workflow.claim_job()
        assert recovered[0] == old[0] and recovered[1] == old[1] + 1
        workflow.process_job(
            *old, adapter=lambda *args: (_ for _ in ()).throw(AssertionError("stale adapter"))
        )
        workflow.process_job(*recovered, adapter=synthetic_adapter)
        with Session(engine()) as db:
            assert db.get(Case, case_id).status == "READY_FOR_REVIEW"
            assert (
                db.scalar(select(func.count()).select_from(Review).where(Review.case_id == case_id))
                == 1
            )
        results.append("interruption_lease_recovery_and_stale_attempt")
        withdraw(owner, consent)

        owner, consent, case_id = create_case()
        claimed = workflow.claim_job()
        barrier = Barrier(2)

        def execute():
            barrier.wait(timeout=8)
            workflow.process_job(*claimed, adapter=synthetic_adapter)

        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(execute) for _ in range(2)]
            for future in futures:
                future.result(timeout=20)
        with Session(engine()) as db:
            assert db.get(Case, case_id).status == "READY_FOR_REVIEW"
            assert (
                db.scalar(select(func.count()).select_from(Review).where(Review.case_id == case_id))
                == 1
            )
        results.append("duplicate_execution_single_review")
        withdraw(owner, consent)

        owner, consent, case_id = create_case()
        claimed = workflow.claim_job()
        real_now, original_transition = workflow.now, workflow.transition

        def expire_during_publish(db, case, state):
            original_transition(db, case, state)
            if state == "READY_FOR_REVIEW":
                deadline = db.get(Job, claimed[0]).lease_until
                workflow.now = lambda: deadline

        workflow.transition = expire_during_publish
        try:
            workflow.process_job(*claimed, adapter=synthetic_adapter)
        finally:
            workflow.now, workflow.transition = real_now, original_transition
        with Session(engine()) as db:
            assert db.get(Case, case_id).status == "EXPLANATION"
            assert (
                db.scalar(select(func.count()).select_from(Review).where(Review.case_id == case_id))
                == 0
            )
        expire_lease(case_id)
        workflow.process_job(*workflow.claim_job(), adapter=synthetic_adapter)
        withdraw(owner, consent)
        results.append("lease_expires_at_final_publication_boundary")

        for point in ("PREPROCESSING", "READY_FOR_REVIEW"):
            owner, consent, case_id = create_case()
            claimed = workflow.claim_job()
            entered, release = Event(), Event()
            original = workflow.transition

            def gated(
                db,
                case,
                state,
                original=original,
                case_id=case_id,
                point=point,
                entered=entered,
                release=release,
            ):
                original(db, case, state)
                if case.id == case_id and state == point:
                    entered.set()
                    assert release.wait(10)

            workflow.transition = gated
            try:
                with ThreadPoolExecutor(max_workers=2) as pool:
                    worker = pool.submit(workflow.process_job, *claimed, adapter=synthetic_adapter)
                    assert entered.wait(8)
                    withdrawal = pool.submit(withdraw, owner, consent)
                    try:
                        wait_for_lock_wait()
                    finally:
                        release.set()
                    withdrawal.result(timeout=15)
                    worker.result(timeout=15)
                assert_disposed(case_id)
                workflow.process_job(*claimed, adapter=synthetic_adapter)
                assert_disposed(case_id)
            finally:
                release.set()
                workflow.transition = original
            results.append("withdrawal_race_" + point.lower())

        owner, consent, case_id = create_case()
        claimed = workflow.claim_job()
        expire_lease(case_id, attempts=3)
        assert workflow.claim_job() is None
        with Session(engine()) as db:
            job = db.get(Job, claimed[0])
            assert job.status == "DEAD_LETTER" and job.attempts == 3 and job.lease_until is None
            assert db.get(Case, case_id).error_code == "RETRY_EXHAUSTED"
        withdraw(owner, consent)
        assert_disposed(case_id)
        results.append("exhausted_interrupted_job_then_withdrawal")

        owner, consent, case_id = create_case()

        def timeout(*args):
            raise SafeError(ErrorCode.DOWNSTREAM_TIMEOUT, 503)

        for _ in range(3):
            workflow.process_job(*workflow.claim_job(), adapter=timeout)
        assert workflow.claim_job() is None
        with Session(engine()) as db:
            job = db.scalar(select(Job).where(Job.case_id == case_id))
            assert job.attempts == 3 and job.status == "DEAD_LETTER"
            assert (
                len(
                    db.scalars(
                        select(Audit).where(
                            Audit.case_id == case_id, Audit.event_type == "JOB_RETRY"
                        )
                    ).all()
                )
                == 2
            )
        results.append("bounded_timeout_retries")

        # Hold the consent row so both requests demonstrably contend on PostgreSQL.
        owner, consent = owner_consent()
        payload = submission(consent)

        def submit():
            with Session(engine(), expire_on_commit=False) as db:
                try:
                    return main.submit(payload, request(), owner, db)
                except SafeError as error:
                    assert error.status == 403
                    return None

        with Session(engine()) as blocker:
            blocker.scalar(select(Consent).where(Consent.id == consent.id).with_for_update())
            with ThreadPoolExecutor(max_workers=2) as pool:
                submitted = pool.submit(submit)
                withdrawn = pool.submit(withdraw, owner, consent)
                blocker.rollback()
                submitted.result(timeout=15)
                value = withdrawn.result(timeout=15)
        assert value.consent.consent_status == "WITHDRAWN"
        if value.case:
            assert_disposed(str(value.case.case_id))
        with Session(engine()) as db:
            assert db.get(Consent, consent.id).status == "WITHDRAWN"
        results.append("concurrent_submission_withdrawal")
    return {
        "synthetic": True,
        "database": "PostgreSQL",
        "passed": len(results),
        "checks": results,
        "isolation": "Unique migrated schema removed after evaluation; development tables/volume preserved.",
    }


if __name__ == "__main__":
    try:
        print(json.dumps(run(), indent=2))
    except Exception as error:
        print(json.dumps({"passed": False, "error_type": type(error).__name__}))
        raise SystemExit(1) from None
