"""Exercise real containers using disposable fixtures; print no credentials or payloads."""

import json
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from uuid import uuid4

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
            assert reviewer.post("/api/v1/auth/login", json=login).status_code == 200
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
            assert (
                student.post(
                    f"/api/v1/cases/{case}/withdraw", json={"idempotency_key": str(uuid4())}
                ).status_code
                == 200
            )
            assert reviewer.get(f"/api/v1/review-tasks/{task['task_id']}").status_code == 404
            assert reviewer.post("/api/v1/auth/logout").status_code == 204
            assert reviewer.get("/api/v1/auth/me").status_code == 401
    for port in () if "--backend-only" in sys.argv else (3000, 3001):
        response = httpx.get(f"http://localhost:{port}", trust_env=False, timeout=15)
        assert response.status_code == 200 and "DEVELOPMENT ONLY" in response.text
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
                    "assigned review",
                    "human action",
                    "withdrawal access revocation",
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
