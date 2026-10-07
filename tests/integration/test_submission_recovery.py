"""Force the exceptional submission path with a real database uniqueness violation."""

from datetime import timedelta

import pytest
from conftest import submit_fixture
from fastapi.testclient import TestClient
from orchestrator import main, workflow
from research_common.config import settings
from research_common.database import (
    Account,
    Audit,
    Case,
    CaseLink,
    Consent,
    Job,
    Review,
    engine,
    session,
)
from research_contracts import FIXTURES, now
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

SCENARIOS = [
    ("valid", 202, None),
    ("missing", 403, "CONSENT_REQUIRED"),
    ("WITHDRAWN", 403, "CONSENT_INVALID"),
    ("INVALID", 403, "CONSENT_INVALID"),
    ("REJECTED", 403, "CONSENT_INVALID"),
    ("PENDING", 403, "CONSENT_INVALID"),
    ("EXPIRED", 403, "CONSENT_INVALID"),
    ("elapsed", 403, "CONSENT_INVALID"),
    ("expiry_boundary", 403, "CONSENT_INVALID"),
    ("purpose", 403, "CONSENT_INVALID"),
    ("version", 403, "CONSENT_INVALID"),
    ("disposed", 403, "CONSENT_INVALID"),
    ("disposing", 403, "CONSENT_INVALID"),
    ("case_expired", 403, "CONSENT_INVALID"),
]


def row_counts():
    with Session(engine()) as db:
        return tuple(
            db.scalar(select(func.count()).select_from(model))
            for model in (Case, CaseLink, Job, Review, Audit)
        )


@pytest.fixture
def recovery_request(student_client, monkeypatch, caplog):
    """Hide only the two preflight duplicate reads, never consent/ownership guards.

    The duplicate insert then raises an actual IntegrityError. A post-rollback
    state change represents a competing policy update; it is not a concurrency
    simulator. The missing-record case substitutes a lookup miss without
    violating database foreign keys.
    """
    response, payload = submit_fixture(student_client)
    assert response.status_code == 202
    case_id = response.json()["case_id"]
    instant = now()
    monkeypatch.setattr(workflow, "now", lambda: instant)

    def change_policy(db, scenario):
        consent = db.get(Consent, payload["consent_id"])
        case = db.get(Case, case_id)
        if scenario in {"WITHDRAWN", "INVALID", "REJECTED", "PENDING", "EXPIRED"}:
            consent.status = scenario
        elif scenario == "elapsed":
            consent.expires_at = instant - timedelta(microseconds=1)
        elif scenario == "expiry_boundary":
            consent.expires_at = instant
        elif scenario == "purpose":
            consent.purpose = "synthetic-unapproved-purpose"
        elif scenario == "version":
            consent.version = "synthetic-unsupported-notice"
        elif scenario in {"disposed", "disposing"}:
            case.status = "WITHDRAWN" if scenario == "disposed" else "WITHDRAWAL_REQUESTED"
        elif scenario == "case_expired":
            case.expires_at = instant
        elif scenario == "foreign":
            outsider = Account(role="STUDENT")
            db.add(outsider)
            db.flush()
            db.get(CaseLink, case_id).account_id = outsider.id

    def send(scenario="valid", force_recovery=True, changed_payload=False, reviewed=False):
        if reviewed:
            with Session(engine()) as db, db.begin():
                db.get(Case, case_id).status = "READY_FOR_REVIEW"
                db.add(Review(case_id=case_id))
        if not force_recovery:
            with Session(engine()) as db, db.begin():
                change_policy(db, scenario)

        evidence = {"hidden_reads": 0, "integrity_errors": 0, "rollbacks": 0, "locks": []}
        baseline = row_counts()

        class RecoverySession(Session):
            recovered = False

            def scalar(self, statement, *args, **kwargs):
                entity = statement.column_descriptions[0].get("entity")
                if (
                    force_recovery
                    and not self.recovered
                    and entity is CaseLink
                    and evidence["hidden_reads"] < 2
                ):
                    evidence["hidden_reads"] += 1
                    return None
                if self.recovered and statement._for_update_arg is not None:
                    evidence["locks"].append(entity)
                if (
                    scenario == "missing"
                    and entity is Consent
                    and (self.recovered or not force_recovery)
                ):
                    return None
                return super().scalar(statement, *args, **kwargs)

            def commit(self):
                try:
                    return super().commit()
                except IntegrityError:
                    evidence["integrity_errors"] += 1
                    raise

            def rollback(self):
                super().rollback()
                evidence["rollbacks"] += 1
                self.recovered = True
                change_policy(self, scenario)
                super().commit()

        def request_session():
            with RecoverySession(engine(), expire_on_commit=False) as db:
                yield db

        caplog.set_level("INFO", logger="research.safe")
        caplog.clear()
        request = dict(payload)
        if changed_payload:
            request["fixture_id"], request["text"] = "mixed", FIXTURES["mixed"]
        with monkeypatch.context() as override:
            override.setitem(main.app.dependency_overrides, session, request_session)
            result = student_client.post("/api/v1/submissions", json=request)

        if force_recovery:
            assert evidence["hidden_reads"] == 2
            assert evidence["integrity_errors"] == evidence["rollbacks"] == 1
        else:
            assert evidence["integrity_errors"] == evidence["rollbacks"] == 0
        assert row_counts() == baseline

        # Inspect output without emitting any input, token or linkage value.
        with Session(engine()) as db:
            link = db.get(CaseLink, case_id)
            prohibited = [
                *FIXTURES.values(),
                link.account_id,
                payload["consent_id"],
                link.request_hash,
                student_client.cookies.get("j26_access"),
                student_client.cookies.get("j26_refresh"),
                settings().jwt_secret.get_secret_value(),
            ]
        output = result.text + caplog.text
        assert all(value not in output for value in prohibited if value)
        return result, evidence, case_id

    return send


@pytest.mark.parametrize("force_recovery", [False, True], ids=["ordinary", "recovery"])
@pytest.mark.parametrize("scenario,status,error", SCENARIOS, ids=[item[0] for item in SCENARIOS])
def test_current_consent_on_duplicate_paths(
    recovery_request, force_recovery, scenario, status, error
):
    result, evidence, case_id = recovery_request(scenario, force_recovery)
    assert result.status_code == status
    if error:
        assert result.json()["error_code"] == error
    else:
        assert result.json()["case_id"] == case_id
    if force_recovery:
        # The established ordering remains case first, consent second.
        expected = (
            [Case] if scenario in {"disposed", "disposing", "case_expired"} else [Case, Consent]
        )
        assert evidence["locks"] == expected


def test_recovered_reviewable_case_is_not_duplicated(recovery_request):
    result, _, case_id = recovery_request(reviewed=True)
    assert result.status_code == 202
    assert result.json()["case_id"] == case_id
    assert result.json()["processing_status"] == "READY_FOR_REVIEW"


@pytest.mark.parametrize("force_recovery", [False, True], ids=["ordinary", "recovery"])
def test_changed_payload_stays_conflict(recovery_request, force_recovery):
    result, _, _ = recovery_request(force_recovery=force_recovery, changed_payload=True)
    assert result.status_code == 409
    assert result.json()["error_code"] == "CONFLICT"


def test_foreign_link_is_not_recovered(recovery_request):
    result, _, _ = recovery_request("foreign")
    assert result.status_code == 409
    assert result.json()["error_code"] == "CONFLICT"


def test_foreign_consent_is_denied_before_recovery(student_client):
    _, payload = submit_fixture(student_client)
    with TestClient(main.app, headers=student_client.headers) as outsider:
        assert outsider.post("/api/v1/auth/student-session").status_code == 200
        result = outsider.post("/api/v1/submissions", json=payload)
    assert result.status_code == 404
    assert result.json()["error_code"] == "NOT_FOUND"
