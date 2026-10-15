"""Authenticated container demo checks; never print credentials or response bodies."""

import subprocess
from pathlib import Path

import httpx
from dotenv import dotenv_values


def main():
    environment = dotenv_values(Path(__file__).resolve().parents[1] / ".env")
    headers = {"Origin": "http://localhost:3001", "X-Requested-With": "j26-browser"}
    root = "http://localhost:3001/api/v1"
    with httpx.Client(headers=headers, timeout=30, trust_env=False) as client:
        assert client.get(root + "/c2-demo/scenarios").status_code == 401
        response = client.post(
            root + "/auth/login",
            json={
                "username": environment["DEV_COUNSELLOR_USERNAME"],
                "password": environment["DEV_COUNSELLOR_PASSWORD"],
            },
        )
        assert response.status_code == 200
        response = client.get(root + "/c2-demo/scenarios")
        assert response.status_code == 200
        catalogue = response.json()
        count = 0
        texts = set()
        for hint in ["sinhala", "english", "romanized-si", "code-mixed", "unsure"]:
            for text, expected_status in [
                ("Fictional practice@example.com about exams.", "PASS"),
                ("", "REJECT"),
            ]:
                custom = client.post(
                    root + "/c2-demo/custom-runs",
                    json={"text": text, "language_hint": hint, "strategy": "presidio"},
                )
                assert custom.status_code == 200
                assert custom.headers["cache-control"] == "no-store"
                data = custom.json()
                assert data["language_hint"] == hint
                assert data["records"][0]["quality_status"] == expected_status
                assert data["records"][0]["original_text"] == text
                if text:
                    assert "[EMAIL]" in data["records"][0]["anonymized_text"]
                    texts.add(text)
                else:
                    assert not data["release_ready"]
        invalid = client.post(
            root + "/c2-demo/custom-runs",
            json={"text": "PRIVATE-SENTINEL", "language_hint": "unsure", "unexpected": True},
        )
        assert invalid.status_code == 422 and "PRIVATE-SENTINEL" not in invalid.text
        for strategy in catalogue["strategies"]:
            for scenario in catalogue["scenarios"]:
                response = client.post(
                    root + "/c2-demo/runs",
                    json={
                        "scenario_id": scenario["scenario_id"],
                        "strategy": strategy,
                    },
                )
                assert response.status_code == 200
                assert response.headers["cache-control"] == "no-store"
                data = response.json()
                assert data["scenario"]["scenario_id"] == scenario["scenario_id"]
                assert data["strategy"] == strategy
                assert len(data["records"]) == scenario["record_count"]
                texts.update(
                    row["original_text"] for row in data["records"] if len(row["original_text"]) > 3
                )
                assert (
                    data["human_release_required"] and not data["independent_research_validation"]
                )
                if scenario["scenario_id"] in {
                    "short",
                    "empty",
                    "placeholder-only",
                    "duplicate",
                    "masking-collision",
                    "empty-batch",
                }:
                    assert not data["release_ready"] and data["blocking_reasons"]
                count += 1
        assert (
            client.post(
                root + "/c2-demo/runs",
                json={"scenario_id": "english", "text": "synthetic-rejected"},
            ).status_code
            == 422
        )
        assert client.post(root + "/auth/logout", json={}).status_code == 204
        assert client.get(root + "/c2-demo/scenarios").status_code == 401
    logs = subprocess.check_output(
        ["docker", "compose", "logs", "--no-color", "orchestrator", "preprocessing"], text=True
    )
    assert all(value not in logs for value in texts)
    assert all(
        value not in logs
        for key, value in environment.items()
        if value and ("PASSWORD" in key or "SECRET" in key)
    )
    print(
        f"C2 Docker demo PASS: authenticated catalogue, {count} live executions, strict input, logout and log privacy checks."
    )


if __name__ == "__main__":
    try:
        main()
    except Exception:
        raise SystemExit(
            "C2 Docker demo FAILED; no response bodies or credentials printed."
        ) from None
