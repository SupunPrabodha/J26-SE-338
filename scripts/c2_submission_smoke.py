"""Real local C2 submission smoke; synthetic decisions, never human gold labels."""

import argparse
import json
from pathlib import Path

import httpx
from dotenv import dotenv_values


def checked(response, expected=200):
    if response.status_code != expected:
        raise RuntimeError(
            f"Safe submission smoke failure: HTTP {response.status_code}, expected {expected}"
        )
    if response.headers.get("cache-control") != "no-store":
        raise RuntimeError("Missing no-store")
    return response.json() if expected != 204 else None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        raise SystemExit("Refusing to overwrite evidence")
    private = dotenv_values(".env")
    root = "http://localhost:3001/api/v1"
    headers = {"Origin": "http://localhost:3001", "X-Requested-With": "j26-browser"}
    with (
        httpx.Client(base_url=root, headers=headers, trust_env=False, timeout=30) as a,
        httpx.Client(base_url=root, headers=headers, trust_env=False, timeout=30) as b,
    ):
        accounts = []
        for client, role in ((a, "COUNSELLOR"), (b, "ADMIN")):
            accounts.append(
                checked(
                    client.post(
                        "/auth/login",
                        json={
                            "username": private[f"DEV_{role}_USERNAME"],
                            "password": private[f"DEV_{role}_PASSWORD"],
                        },
                    )
                )["account_id"]
            )
        assert accounts[0] != accounts[1]
        first = checked(a.get("/c2-annotations/submissions"))
        second = checked(b.get("/c2-annotations/submissions"))
        assert len(first["submissions"]) == 4
        assert [(r["submission_id"], r["submission_version"]) for r in first["submissions"]] == [
            (r["submission_id"], r["submission_version"]) for r in second["submissions"]
        ]
        assert all(
            [r["question_id"] for r in row["answers"]] == [f"Q{q}" for q in range(4, 11)]
            for row in first["submissions"]
        )
        assert any(
            answer["state"] == "OPTIONAL_UNANSWERED" and answer["annotation"] is None
            for row in first["submissions"]
            for answer in row["answers"]
        )
        selected = next(
            (row, answer)
            for row in first["submissions"]
            for answer in row["answers"]
            if answer["annotation"] and not answer["annotation"]["own_history"]
        )
        submission, answer = selected
        item = answer["annotation"]["item"]
        url = "/c2-annotations/" + item["record_id"]
        payload = {
            key: item[key]
            for key in (
                "record_version",
                "pipeline_version",
                "annotation_schema_version",
                "vocabulary_version",
            )
        }
        payload.update(expected_revision=0, status="DRAFT", labels={"language": "uncertain"})
        saved = checked(a.post(url + "/revisions", json=payload))
        assert checked(a.get(url))["own_history"] == saved["own_history"]
        assert checked(a.get(url))["item"] == item
        assert (
            checked(b.get(url))["own_history"] == [] and checked(b.get(url))["peer_final"] is None
        )
        payload.update(
            expected_revision=1,
            status="FINAL",
            labels={
                "language": "uncertain",
                "code_mixing": "uncertain",
                "emotion": "uncertain",
                "wellbeing": "uncertain",
            },
        )
        checked(a.post(url + "/revisions", json=payload))
        assert checked(b.get(url))["peer_final"] is None
        checked(a.post(url + "/revisions", json={**payload, "expected_revision": 2}), 409)
        checked(b.post(url + "/revisions", json={**payload, "expected_revision": 0}))
        assert checked(a.get(url))["peer_final"] is not None
        final = checked(a.get("/c2-annotations/submissions/" + submission["submission_id"]))
        assert (
            final["agreement_status"] == "NOT_EVALUATED"
            and final["adjudication_status"] == "PENDING"
            and final["human_release_required"]
        )
        for client in (a, b):
            checked(client.post("/auth/logout", json={}), 204)
        checked(a.get("/c2-annotations/submissions"), 401)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(
            {
                "status": "PASS",
                "submissions": 4,
                "positions": 28,
                "same_frozen_assignment": True,
                "draft_reload": True,
                "independent_visibility": True,
                "unchanged_answer": True,
                "immutable_final": True,
                "optional_q10": True,
                "human_independence_verified": False,
                "decisions": "automated_synthetic_smoke_not_human_gold",
                "consumed_record": item["record_id"],
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    print(
        "PASS: four assigned submissions; persistence, text integrity, visibility, finals and optional Q10"
    )


if __name__ == "__main__":
    main()
