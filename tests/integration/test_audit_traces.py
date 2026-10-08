import os
from datetime import timedelta
from uuid import uuid4

from conftest import submit_fixture
from fastapi.testclient import TestClient
from orchestrator import workflow
from orchestrator.main import app
from research_common.database import Audit, Case, Consent, Job, engine
from research_common.web import SafeError
from research_contracts import FIXTURES, ErrorCode, ServiceProvenance, now
from sqlalchemy import select
from sqlalchemy.orm import Session

from scripts.evaluate_traces import evaluate, save_report
from tests.integration.test_submission_recovery import recovery_request  # noqa: F401
from tests.integration.test_workflow import run_job


def test_required_audit_traces(student_client, accounts, recovery_request, monkeypatch):  # noqa: F811
    client = student_client
    traces, seen = {}, set()

    def capture(name):
        with Session(engine()) as db:
            rows = db.scalars(select(Audit).order_by(Audit.created_at)).all()
            traces[name] = [
                dict(
                    event_type=r.event_type,
                    status=r.status,
                    case_id=r.case_id,
                    correlation_id=r.correlation_id,
                    created_at=r.created_at.isoformat(),
                    policy_expires_at=r.policy_expires_at.isoformat()
                    if r.policy_expires_at
                    else None,
                    service_version=r.service_version,
                    trace_id=r.trace_id,
                )
                for r in rows
                if r.id not in seen
            ]
            seen.update(r.id for r in rows)

    recovered, _, recovered_case = recovery_request()
    assert recovered.status_code == 202
    capture("recovery")
    monkeypatch.setattr(workflow, "now", now)
    client.post(f"/api/v1/cases/{recovered_case}/withdraw", json=dict(idempotency_key=str(uuid4())))
    response, body = submit_fixture(client)
    case_id = response.json()["case_id"]
    for _ in range(3):
        assert client.post("/api/v1/submissions", json=body).status_code == 202
    run_job()
    with Session(engine()) as db:
        provenance = ServiceProvenance.model_validate(db.get(Case, case_id).provenance)
        assert (
            provenance.synthetic
            and str(provenance.correlation_id) == response.json()["correlation_id"]
        )
        assert (
            len(
                db.scalars(
                    select(Audit).where(
                        Audit.event_type == "SUBMISSION_REPLAY", Audit.case_id == case_id
                    )
                ).all()
            )
            == 1
        )
    with TestClient(app, headers=client.headers) as reviewer:
        _, username, password = accounts["COUNSELLOR"]
        assert (
            reviewer.post(
                "/api/v1/auth/login", json=dict(username=username, password=password)
            ).status_code
            == 200
        )
        task = reviewer.get("/api/v1/review-tasks").json()[0]["task_id"]
        for action in ("START_REVIEW", "COMPLETE_REVIEW"):
            assert (
                reviewer.post(
                    f"/api/v1/review-tasks/{task}/actions",
                    json=dict(action=action, idempotency_key=str(uuid4())),
                ).status_code
                == 200
            )
    assert (
        client.post(
            f"/api/v1/cases/{case_id}/withdraw", json=dict(idempotency_key=str(uuid4()))
        ).status_code
        == 200
    )
    with Session(engine()) as db:
        assert db.get(Case, case_id).provenance is None
    capture("success")
    assert client.post("/api/v1/consents", json={"consent_status": "REJECTED"}).status_code == 201
    capture("rejection")
    consent = client.post("/api/v1/consents", json={"consent_status": "ACTIVE"}).json()[
        "consent_id"
    ]
    assert (
        client.post(
            f"/api/v1/consents/{consent}/withdraw", json=dict(idempotency_key=str(uuid4()))
        ).status_code
        == 200
    )
    assert (
        client.post(
            "/api/v1/submissions",
            json=dict(
                consent_id=consent,
                idempotency_key=str(uuid4()),
                fixture_id="english",
                text=FIXTURES["english"],
            ),
        ).status_code
        == 403
    )
    capture("prewithdraw")
    response, body = submit_fixture(client)
    with Session(engine()) as db, db.begin():
        expiry = now() - timedelta(seconds=1)
        db.get(Consent, body["consent_id"]).expires_at = expiry
    for _ in range(3):
        assert client.post("/api/v1/submissions", json=body).status_code == 403
    with Session(engine()) as db:
        event = db.scalar(select(Audit).where(Audit.event_type == "CONSENT_EXPIRED"))
        assert event.policy_expires_at == expiry and event.created_at > expiry
        assert (
            len(db.scalars(select(Audit).where(Audit.event_type == "CONSENT_EXPIRED")).all()) == 1
        )
    capture("expiry")
    # Cancel the expired case so retry/exhaustion scenarios have exactly one eligible job.
    client.post(
        f"/api/v1/cases/{response.json()['case_id']}/withdraw",
        json=dict(idempotency_key=str(uuid4())),
    )
    submit_fixture(client)

    def timeout(*args):
        raise SafeError(ErrorCode.DOWNSTREAM_TIMEOUT, 503)

    for _ in range(3):
        workflow.process_job(*workflow.claim_job(), adapter=timeout)
    capture("retry")
    response, _ = submit_fixture(client)
    with Session(engine()) as db, db.begin():
        job = db.scalar(select(Job).where(Job.case_id == response.json()["case_id"]))
        job.status, job.attempts, job.lease_until = "RUNNING", 3, now() - timedelta(seconds=1)
    assert workflow.claim_job() is None
    capture("exhaustion")
    response, _ = submit_fixture(client)
    with Session(engine()) as db, db.begin():
        db.get(Case, response.json()["case_id"]).expires_at = now() - timedelta(seconds=1)
    workflow.enforce_retention()
    capture("retention")
    with TestClient(app, headers=client.headers) as session_client:
        assert session_client.post("/api/v1/auth/student-session").status_code == 200
        old = session_client.cookies.get("j26_refresh")
        assert session_client.post("/api/v1/auth/refresh").status_code == 200
        session_client.cookies.clear()
        session_client.cookies.set("j26_refresh", old)
        assert session_client.post("/api/v1/auth/refresh").status_code == 401
        assert session_client.post("/api/v1/auth/logout").status_code == 204
    capture("session")
    report = evaluate(traces, prohibited=(password, old, client.cookies.get("j26_access")))
    assert report["missing_events"] == [] and report["prohibited_content_absent"]
    assert report["case_trace_links_consistent"]
    if os.getenv("C1_AUDIT_REPORT"):
        save_report(report, os.environ["C1_AUDIT_REPORT"])


def test_trace_evaluator_reports_missing_and_prohibited_content():
    report = evaluate(
        {"success": [{"event_type": "SUBMISSION", "status": "ACCEPTED", "text": "forbidden"}]}
    )
    assert report["missing_events"] and report["critical_coverage"] < 1
    assert not report["prohibited_content_absent"]
