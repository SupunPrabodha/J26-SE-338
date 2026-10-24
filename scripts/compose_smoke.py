"""Exercise real containers using disposable fixtures; print no credentials or payloads."""

import json
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from uuid import UUID, uuid4

import httpx
from dotenv import dotenv_values


def container_python(service, code):
    result = subprocess.run(
        ["docker", "compose", "exec", "-T", service, "python", "-c", code],
        capture_output=True,
        text=True,
    )
    if result.returncode:
        raise RuntimeError(f"Container probe failed: {service}")
    return result.stdout.strip()


def main():
    environment = dotenv_values(Path(__file__).resolve().parents[1] / ".env")
    for name in ("orchestrator", "preprocessing", "nlp", "xai"):
        for endpoint in ("health", "ready", "version"):
            container_python(
                name,
                f"import urllib.request,json; r=json.load(urllib.request.urlopen('http://127.0.0.1:8000/{endpoint}')); assert r['development_only'] and r['synthetic']",
            )
    container_python(
        "orchestrator",
        "from research_common.database import engine; from sqlalchemy import text; c=engine().connect(); assert c.scalar(text('SELECT 1'))==1",
    )
    container_python(
        "worker",
        "from research_common.web import redis_client; r=redis_client(); assert r.ping(); r.set('j26:worker:probe','synthetic',ex=60)",
    )
    for _ in range(30):
        result = container_python(
            "worker",
            "from research_common.web import redis_client; print(redis_client().get('j26:worker:probe-result') or '')",
        )
        if result == "synthetic-task-complete":
            break
        time.sleep(1)
    else:
        raise RuntimeError("Worker probe did not complete")
    headers = {"Origin": "http://localhost:3000", "X-Requested-With": "j26-browser"}
    with httpx.Client(
        base_url="http://localhost:8000", headers=headers, timeout=10, trust_env=False
    ) as student:
        assert student.post("/api/v1/auth/student-session").status_code == 200
        consent = student.post("/api/v1/consents", json={"consent_status": "ACTIVE"}).json()
        fixtures = student.get("/api/v1/fixtures").json()["fixtures"]
        payload = {
            "consent_id": consent["consent_id"],
            "fixture_id": "mixed",
            "text": fixtures["mixed"],
            "idempotency_key": str(uuid4()),
        }
        with ThreadPoolExecutor(max_workers=2) as executor:
            responses = list(
                executor.map(lambda _: student.post("/api/v1/submissions", json=payload), range(2))
            )
        assert all(response.status_code == 202 for response in responses)
        case = responses[0].json()["case_id"]
        assert all(response.json()["case_id"] == case for response in responses)
        assert student.post("/api/v1/submissions", json=payload).json()["case_id"] == case
        for _ in range(45):
            state = student.get(f"/api/v1/cases/{case}/status").json()["processing_status"]
            if state == "READY_FOR_REVIEW":
                break
            time.sleep(1)
        else:
            raise RuntimeError("Synthetic workflow did not become reviewable")
        with httpx.Client(
            base_url="http://localhost:8000", headers=headers, timeout=10, trust_env=False
        ) as reviewer:
            login = {
                "username": environment["DEV_COUNSELLOR_USERNAME"],
                "password": environment["DEV_COUNSELLOR_PASSWORD"],
            }
            logged_in = reviewer.post("/api/v1/auth/login", json=login)
            assert logged_in.status_code == 200
            with httpx.Client(
                base_url="http://localhost:8000", headers=headers, timeout=10, trust_env=False
            ) as administrator:
                assert (
                    administrator.post(
                        "/api/v1/auth/login",
                        json={
                            "username": environment["DEV_ADMIN_USERNAME"],
                            "password": environment["DEV_ADMIN_PASSWORD"],
                        },
                    ).status_code
                    == 200
                )
                summary = administrator.get("/api/v1/admin/cases", params={"q": case}).json()[
                    "items"
                ][0]
                if (
                    administrator.get("/api/v1/admin/overview").json()["assignment_policy"]
                    == "MANUAL"
                ):
                    assert summary["assignment_state"] == "AWAITING_ASSIGNMENT"
                    assert not any(
                        t["case"]["case_id"] == case
                        for t in reviewer.get("/api/v1/review-tasks").json()
                    )
                    assert (
                        administrator.post(
                            f"/api/v1/admin/cases/{case}/assignment",
                            json={
                                "counsellor_id": logged_in.json()["account_id"],
                                "expected_version": summary["assignment_version"],
                            },
                        ).status_code
                        == 200
                    )
                aggregates = administrator.get("/api/v1/admin/analytics", params={"q": case}).json()
                assert (
                    aggregates["total_cases"]
                    == sum(row["cases"] for row in aggregates["statuses"])
                    == 1
                )
                assert sum(row["cases"] for row in aggregates["submissions"]) == 1
            tasks = reviewer.get("/api/v1/review-tasks").json()
            task = next(t for t in tasks if t["case"]["case_id"] == case)
            assert task["explanation"]["reliability_status"] == "NOT_EVALUATED"
            for action in ("START_REVIEW", "COMPLETE_REVIEW"):
                assert (
                    reviewer.post(
                        f"/api/v1/review-tasks/{task['task_id']}/actions",
                        json={"action": action, "idempotency_key": str(uuid4())},
                    ).status_code
                    == 200
                )
                if action == "START_REVIEW":
                    record_path = f"/api/v1/review-tasks/{task['task_id']}/record"
                    record_body = {
                        "interpretation": "SYNTHETIC: Smoke review privacy marker.",
                        "follow_up": "DISCUSSION_OFFERED",
                        "idempotency_key": str(uuid4()),
                    }
                    saved = reviewer.post(record_path, json=record_body)
                    assert saved.status_code == 200
                    assert reviewer.get(record_path).json() == saved.json()
                    assert reviewer.post(record_path, json=record_body).json() == saved.json()
                    evidence = student.get(f"/api/v1/demo/runs/{consent['consent_id']}")
                    assert evidence.json()["review_record_saved_at"]
                    assert record_body["interpretation"] not in evidence.text
            # Expire only this synthetic case while its owner session remains valid.
            # This tests retention-before-withdrawal without waiting for the default TTL.
            case = str(UUID(case))
            container_python(
                "orchestrator",
                f"""
from datetime import timedelta
from sqlalchemy.orm import Session
from research_common.database import Case, engine
from research_contracts import now
from orchestrator.workflow import enforce_retention
with Session(engine()) as db, db.begin():
    db.get(Case, '{case}').expires_at = now() - timedelta(seconds=1)
enforce_retention()
""",
            )
            assert (
                student.get(f"/api/v1/cases/{case}/status").json()["processing_status"]
                == "WITHDRAWN"
            )
            assert reviewer.get(f"/api/v1/review-tasks/{task['task_id']}").status_code == 404
            assert reviewer.get(record_path).status_code == 404
            container_python(
                "orchestrator",
                f"""
from sqlalchemy import select
from sqlalchemy.orm import Session
from research_common.database import Review, ReviewRecord, engine
with Session(engine()) as db:
    task = db.scalar(select(Review).where(Review.case_id == '{case}'))
    assert db.scalar(select(ReviewRecord).where(ReviewRecord.task_id == task.id)) is None
""",
            )
            with ThreadPoolExecutor(max_workers=2) as executor:
                withdrawals = list(
                    executor.map(
                        lambda _: student.post(
                            f"/api/v1/cases/{case}/withdraw",
                            json={"idempotency_key": str(uuid4())},
                        ),
                        range(2),
                    )
                )
            assert all(response.status_code == 200 for response in withdrawals)
            assert withdrawals[0].json() == withdrawals[1].json()
            assert (
                student.get(f"/api/v1/consents/{consent['consent_id']}").json()["consent_status"]
                == "WITHDRAWN"
            )
            assert student.post("/api/v1/submissions", json=payload).status_code == 403
            container_python(
                "orchestrator",
                f"""
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from research_common.database import Audit, Retention, Withdrawal, engine
with Session(engine()) as db:
    for model in (Withdrawal, Retention):
        assert db.scalar(select(func.count()).select_from(model).where(model.case_id == '{case}')) == 1
    for event in ('WITHDRAWAL', 'RETENTION'):
        assert db.scalar(select(func.count()).select_from(Audit).where(Audit.case_id == '{case}', Audit.event_type == event)) == 1
""",
            )
            assert reviewer.get(f"/api/v1/review-tasks/{task['task_id']}").status_code == 404
            assert reviewer.post("/api/v1/auth/logout").status_code == 204
            assert reviewer.get("/api/v1/auth/me").status_code == 401
    for port in () if "--backend-only" in sys.argv else (3000, 3001):
        response = httpx.get(f"http://localhost:{port}", trust_env=False, timeout=15)
        assert response.status_code == 200
        assert "Screening support only" in response.text and "Mock data" in response.text
        response = httpx.get(
            f"http://localhost:{port}/api/v1/fixtures", trust_env=False, timeout=15
        )
        assert response.status_code == 200 and response.json()["synthetic"]
    logs = subprocess.run(
        [
            "docker",
            "compose",
            "logs",
            "--no-color",
            "orchestrator",
            "preprocessing",
            "nlp",
            "xai",
            "worker",
        ],
        capture_output=True,
        text=True,
        check=True,
    ).stdout
    assert all(value not in logs for value in fixtures.values())
    assert "SYNTHETIC: Smoke review privacy marker." not in logs
    assert all(
        value not in logs
        for key, value in environment.items()
        if value and ("PASSWORD" in key or "SECRET" in key)
    )
    print(
        json.dumps(
            {
                "result": "PASS",
                "checks": [
                    "four-service health/ready/version",
                    "PostgreSQL",
                    "Redis",
                    "worker synthetic task",
                    "C1-C2-C3-C4",
                    "concurrent idempotency",
                    "configured assignment policy and admin chart/table totals",
                    "assigned review",
                    "human action",
                    "review record save/read/replay and safe receipt",
                    "review content disposal and log exclusion",
                    "withdrawal access revocation",
                    "retention before concurrent owner withdrawals",
                    "single withdrawal receipt and audit event",
                    "logout",
                    "frontend checks skipped"
                    if "--backend-only" in sys.argv
                    else "two frontend HTTP/proxy responses",
                    "container log privacy",
                ],
            }
        )
    )


if __name__ == "__main__":
    main()
