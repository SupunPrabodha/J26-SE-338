import json
from uuid import uuid4

import httpx
import pytest
from conftest import submit_fixture
from fastapi.testclient import TestClient
from orchestrator import workflow
from research_common.database import Audit, Case, Job, Review, engine
from research_common.mocks import context
from research_common.web import SafeError, create_app
from research_contracts import FIXTURES, ErrorCode, PreprocessRequest, PreprocessResponse
from sqlalchemy import select, text
from sqlalchemy.exc import DatabaseError
from sqlalchemy.orm import Session


@pytest.mark.parametrize(
    "problem", ["timeout", "http_failure", "malformed_json", "invalid_schema", "wrong_context"]
)
def test_actual_adapter_response_validation(platform, monkeypatch, problem):
    request = PreprocessRequest(
        case_id=uuid4(), correlation_id=uuid4(), idempotency_key=uuid4(), text=FIXTURES["english"]
    )

    def transport(req):
        if problem == "timeout":
            raise httpx.ReadTimeout("sensitive-sentinel", request=req)
        if problem == "http_failure":
            return httpx.Response(503, text="sensitive-sentinel")
        if problem == "malformed_json":
            return httpx.Response(200, text="not JSON sensitive-sentinel")
        payload = PreprocessResponse(
            **context(request),
            anonymized_text=request.text,
            normalized_text=request.text,
            language="en",
            tokens=[],
            token_offsets=[],
            transformations=[],
        ).model_dump(mode="json")
        if problem == "invalid_schema":
            payload["schema_version"] = "7.0.0"
        else:
            payload["case_id"] = str(uuid4())
        return httpx.Response(200, json=payload)

    original = httpx.Client
    monkeypatch.setattr(
        workflow.httpx,
        "Client",
        lambda **kwargs: original(transport=httpx.MockTransport(transport), **kwargs),
    )
    with pytest.raises(SafeError) as error:
        workflow.call_service(
            "preprocessing", "/internal/v1/preprocess", request, PreprocessResponse
        )
    assert error.value.code in {
        ErrorCode.DOWNSTREAM_TIMEOUT,
        ErrorCode.DOWNSTREAM_FAILED,
        ErrorCode.CONTRACT_INVALID,
    }
    assert "sensitive-sentinel" not in str(error.value)


def test_logs_never_serialize_exception_or_path(platform, caplog):
    caplog.set_level("INFO", logger="research.safe")
    app = create_app("safe-probe")

    @app.get("/probe")
    def fail():
        raise RuntimeError("PRIVATE-TEXT-AND-TOKEN-SENTINEL")

    response = TestClient(app, raise_server_exceptions=False).get(
        "/probe?secret=PRIVATE-QUERY-SENTINEL"
    )
    assert response.status_code == 500
    assert "PRIVATE" not in response.text and "PRIVATE" not in caplog.text
    assert response.json()["correlation_id"] == response.headers["x-correlation-id"]
    for record in caplog.records:
        if record.name == "research.safe":
            assert set(json.loads(record.message)) == {
                "timestamp",
                "service_name",
                "service_version",
                "correlation_id",
                "event_type",
                "status",
                "duration_ms",
                "error_code",
            }


def test_audit_append_only(student_client):
    with Session(engine()) as db:
        assert db.scalar(select(Audit))
        with pytest.raises(DatabaseError):
            db.execute(text("UPDATE audit_events SET status='CHANGED'"))
        db.rollback()
        with pytest.raises(DatabaseError):
            db.execute(text("DELETE FROM audit_events"))


def test_consent_rechecked_between_services(student_client, monkeypatch):
    from tests.integration.test_workflow import adapter

    submit_fixture(student_client)
    original = workflow.check_case_consent
    checks = []
    calls = []

    def guard(db, case):
        checks.append(case.status)
        consent = original(db, case)
        if len(checks) == 3:
            consent.status = "WITHDRAWN"
            workflow.active_consent(consent)
        return consent

    def tracked(*args):
        calls.append(args[0])
        return adapter(*args)

    monkeypatch.setattr(workflow, "check_case_consent", guard)
    workflow.process_job(*workflow.claim_job(), adapter=tracked)
    assert calls == ["preprocessing"]
    with Session(engine()) as db:
        assert db.scalar(select(Case)).status == "FAILED"
        assert db.scalar(select(Review)) is None


def test_crashed_attempt_exhaustion(student_client):
    from datetime import timedelta

    from research_contracts import now

    submit_fixture(student_client)
    with Session(engine()) as db, db.begin():
        job = db.scalar(select(Job))
        job.status, job.attempts, job.lease_until = "RUNNING", 3, now() - timedelta(seconds=1)
    assert workflow.claim_job() is None
    with Session(engine()) as db:
        assert db.scalar(select(Job)).status == "DEAD_LETTER"
        assert db.scalar(select(Case)).error_code == "RETRY_EXHAUSTED"


def test_changed_payload_same_idempotency_key(student_client):
    response, body = submit_fixture(student_client)
    assert response.status_code == 202
    body["fixture_id"], body["text"] = "mixed", FIXTURES["mixed"]
    assert student_client.post("/api/v1/submissions", json=body).status_code == 409
