"""Synthetic persisted annotation smoke; existing accounts only, no payload logs."""

import argparse
import json
import subprocess
import time
from pathlib import Path

import httpx
from dotenv import dotenv_values

ROOT = "http://localhost:3001/api/v1"


def checked(response, status=200):
    if response.status_code != status:
        raise RuntimeError("Safe annotation endpoint failure")
    assert response.headers["cache-control"] == "no-store"
    return response.json() if status != 204 else None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        raise SystemExit("Refusing to overwrite evidence")
    environment = dotenv_values(".env")
    headers = {"Origin": "http://localhost:3001", "X-Requested-With": "j26-browser"}
    with (
        httpx.Client(base_url=ROOT, headers=headers, trust_env=False, timeout=30) as first,
        httpx.Client(base_url=ROOT, headers=headers, trust_env=False, timeout=30) as second,
    ):
        accounts = []
        for client, role in ((first, "COUNSELLOR"), (second, "ADMIN")):
            username, password = (
                environment.get(f"DEV_{role}_USERNAME"),
                environment.get(f"DEV_{role}_PASSWORD"),
            )
            if not username or not password:
                raise RuntimeError("Existing second development identity unavailable")
            accounts.append(
                checked(
                    client.post("/auth/login", json={"username": username, "password": password})
                )["account_id"]
            )
        assert accounts[0] != accounts[1]
        queue = checked(first.post("/c2-annotations/prepare", json={}))
        selected = None
        for item in queue["items"]:
            before = checked(first.get("/c2-annotations/" + item["record_id"]))
            other = checked(second.get("/c2-annotations/" + item["record_id"]))
            if (
                before["can_submit"]
                and other["can_submit"]
                and not before["own_history"]
                and not other["own_history"]
            ):
                selected = item
                break
        if selected is None:
            raise RuntimeError("No unused synthetic pair; preserve existing finals")
        url = "/c2-annotations/" + selected["record_id"]
        fields = (
            "record_version",
            "pipeline_version",
            "annotation_schema_version",
            "vocabulary_version",
        )
        payload = {
            **{key: selected[key] for key in fields},
            "expected_revision": 0,
            "status": "DRAFT",
            "labels": {"language": "uncertain"},
        }
        draft = checked(first.post(url + "/revisions", json=payload))
        assert len(draft["own_history"]) == 1
        assert checked(second.get(url))["own_history"] == []
        assert checked(second.get(url))["peer_final"] is None
        invalid = first.post(
            url + "/revisions", json={**payload, "labels": {"emotion": "PRIVATE-SENTINEL"}}
        )
        assert invalid.status_code == 422 and "PRIVATE-SENTINEL" not in invalid.text
        # Restart only the affected gateway process; PostgreSQL volume is retained.
        subprocess.run(
            ["docker", "compose", "restart", "orchestrator"],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        restored = None
        for _ in range(60):
            try:
                response = first.get(url)
                if response.status_code == 200:
                    restored = checked(response)
                    break
            except httpx.HTTPError:
                pass
            time.sleep(0.5)
        assert restored and restored["own_history"] == draft["own_history"]
        final_labels = {
            "language": "uncertain",
            "code_mixing": "uncertain",
            "emotion": "uncertain",
            "wellbeing": "uncertain",
        }
        first_final = checked(
            first.post(
                url + "/revisions",
                json={**payload, "expected_revision": 1, "status": "FINAL", "labels": final_labels},
            )
        )
        assert first_final["annotation_status"] == "SUBMITTED" and first_final["peer_final"] is None
        assert checked(second.get(url))["peer_final"] is None
        second_final = checked(
            second.post(
                url + "/revisions",
                json={
                    **payload,
                    "status": "FINAL",
                    "labels": {
                        **final_labels,
                        "emotion": "neutral",
                        "wellbeing": "no-clear-indicator",
                    },
                },
            )
        )
        assert second_final["annotation_status"] == "PAIR_FINALIZED"
        assert second_final["peer_final"]["labels"]["emotion"] == "uncertain"
        restored = checked(first.get(url))
        assert restored["peer_final"]["labels"]["emotion"] == "neutral"
        assert restored["item"] == selected
        assert first.post(url + "/revisions", json=payload).status_code == 409
        assert (
            restored["agreement_status"] == "NOT_EVALUATED" and restored["human_release_required"]
        )
        logs = subprocess.check_output(
            ["docker", "compose", "logs", "--no-color", "orchestrator"], text=True
        )
        assert selected["preprocessing"]["records"][0]["anonymized_text"] not in logs
        assert all(
            value not in logs
            for key, value in environment.items()
            if value and ("PASSWORD" in key or "SECRET" in key)
        )
        report = {
            "result": "PASS",
            "record_id": selected["record_id"],
            "eligible_records": len(queue["items"]),
            "distinct_authenticated_accounts": True,
            "draft_persisted_after_gateway_restart": True,
            "peer_labels_blind_until_both_final": True,
            "immutable_finals_and_disagreements_preserved": True,
            "agreement": "NOT_EVALUATED",
            "human_independence_verified": False,
            "test_decisions": "automated_synthetic_smoke_not_human_gold",
            "no_text_or_secrets_in_logs": True,
        }
        for client in (first, second):
            checked(client.post("/auth/logout", json={}), 204)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        raise SystemExit(
            "C2 annotation smoke FAILED; no payloads/credentials printed; inspect availability and existing account prerequisites."
        ) from None
