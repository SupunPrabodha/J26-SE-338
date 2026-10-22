"""Synthetic C2 annotation using real existing login and durable migrated tables."""

import secrets
from types import SimpleNamespace

import pytest
from orchestrator import auth
from orchestrator import demo as gateway
from orchestrator.c2_annotation_store import AnnotationRecord, AnnotationRevision
from preprocessing import demo
from research_common.database import Account, engine
from research_contracts import C2DemoRequest
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from tests.integration.test_c2_demo import reviewer as reviewer

ROOT = "/api/v1/c2-annotations"


def login(client, accounts, role):
    assert client.post("/api/v1/auth/logout", json={}).status_code == 204
    _, name, password = accounts[role]
    assert (
        client.post("/api/v1/auth/login", json={"username": name, "password": password}).status_code
        == 200
    )


def prepare(client):
    response = client.post(ROOT + "/prepare", json={})
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    return response.json()


def body(item, **changes):
    return {
        **{
            key: item[key]
            for key in (
                "record_version",
                "pipeline_version",
                "annotation_schema_version",
                "vocabulary_version",
            )
        },
        "expected_revision": 0,
        "status": "DRAFT",
        "labels": {
            "language": "english",
            "code_mixing": "none",
            "emotion": "neutral",
            "wellbeing": "no-clear-indicator",
        },
        **changes,
    }


def test_actual_queue_and_blocked_controls(reviewer):
    queue = prepare(reviewer)
    assert queue["vocabulary_status"] == "PROVISIONAL_DEMO_ONLY_NOT_EXPERT_APPROVED"
    assert len(queue["items"]) == 4
    for item in queue["items"]:
        actual = demo.execute(C2DemoRequest(scenario_id=item["record_id"], strategy="presidio"))
        assert item["preprocessing"] == actual.model_dump(mode="json")
        assert actual.release_ready and actual.privacy_summary.status == "PASSED"
        assert actual.records[0].quality_status == "PASS"
    for blocked in ("short", "empty", "placeholder-only", "arbitrary-participant"):
        assert reviewer.get(ROOT + "/" + blocked).status_code == 404


def test_actual_privacy_review_signal_excludes_record(reviewer, monkeypatch):
    diagnostic = "ape grp leader supun. eyge girlfriend Neluni . ey hrim npurui"
    monkeypatch.setattr(
        demo,
        "SCENARIOS",
        tuple(
            (*row[:3], (diagnostic,)) if row[0] == "english-ordinary" else row
            for row in demo.SCENARIOS
        ),
    )
    actual = demo.execute(C2DemoRequest(scenario_id="english-ordinary", strategy="presidio"))
    assert actual.records[0].requires_privacy_review
    assert not actual.release_ready
    assert "english-ordinary" not in {item["record_id"] for item in prepare(reviewer)["items"]}


def test_prepare_rejects_arbitrary_input(reviewer):
    response = reviewer.post(ROOT + "/prepare", json={"text": "PRIVATE-SENTINEL"})
    assert response.status_code == 422 and "PRIVATE-SENTINEL" not in response.text


def test_durable_revisions_blinding_and_distinct_accounts(reviewer, accounts):
    item = next(row for row in prepare(reviewer)["items"] if row["record_id"] == "english-ordinary")
    url = ROOT + "/english-ordinary"
    draft = body(item, labels={"language": "english"})
    saved = reviewer.post(url + "/revisions", json=draft)
    assert saved.status_code == 200
    assert saved.json()["annotation_status"] == "DRAFT"
    engine().dispose()  # A fresh connection must recover durable state.
    reloaded = reviewer.get(url).json()
    assert reloaded["own_history"] == saved.json()["own_history"]
    assert reloaded["own_history"][0]["labels"]["emotion"] is None
    final = body(item, status="FINAL", expected_revision=1)
    first = reviewer.post(url + "/revisions", json=final).json()
    assert len(first["own_history"]) == 2
    assert first["annotation_status"] == "SUBMITTED"
    assert first["peer_final"] is None
    assert (
        reviewer.post(url + "/revisions", json=body(item, expected_revision=2)).status_code == 409
    )
    login(reviewer, accounts, "ADMIN")
    second = reviewer.get(url).json()
    assert second["own_history"] == [] and second["peer_final"] is None
    assert second["finalized_count"] == 1
    # A deliberately different decision remains saved; no adjudication overwrites it.
    payload = body(item, status="FINAL")
    payload["labels"]["emotion"] = "uncertain"
    second = reviewer.post(url + "/revisions", json=payload).json()
    assert second["annotation_status"] == "PAIR_FINALIZED"
    assert second["peer_final"]["labels"]["emotion"] == "neutral"
    assert second["agreement_status"] == "NOT_EVALUATED"
    assert second["adjudication_status"] == "PENDING"
    login(reviewer, accounts, "COUNSELLOR")
    first = reviewer.get(url).json()
    assert first["peer_final"]["labels"]["emotion"] == "uncertain"
    assert first["own_history"][0]["labels"]["emotion"] is None
    assert first["item"] == item and first["human_release_required"]


@pytest.mark.parametrize(
    "change",
    [
        {"labels": {"emotion": "PRIVATE-SENTINEL"}},
        {"actor_id": "PRIVATE-SENTINEL"},
        {"annotation_schema_version": "wrong"},
        {"vocabulary_version": "wrong"},
        {"expected_revision": True},
        {"status": "FINAL", "labels": {}},
    ],
)
def test_safe_validation(reviewer, change):
    item = prepare(reviewer)["items"][0]
    response = reviewer.post(
        ROOT + "/" + item["record_id"] + "/revisions", json=body(item, **change)
    )
    assert response.status_code == 422
    assert "PRIVATE-SENTINEL" not in response.text


@pytest.mark.parametrize(
    "change", [{"record_version": "stale"}, {"pipeline_version": "wrong"}, {"expected_revision": 4}]
)
def test_stale_versions(reviewer, change):
    item = prepare(reviewer)["items"][0]
    assert (
        reviewer.post(
            ROOT + "/" + item["record_id"] + "/revisions", json=body(item, **change)
        ).status_code
        == 409
    )


def test_authentication_roles_expiry_and_development(reviewer, accounts, monkeypatch):
    item = prepare(reviewer)["items"][0]
    reviewer.post("/api/v1/auth/logout", json={})
    assert reviewer.get(ROOT + "/" + item["record_id"]).status_code == 401
    login(reviewer, accounts, "RESEARCHER")
    assert reviewer.post(ROOT + "/prepare", json={}).status_code == 403
    login(reviewer, accounts, "COUNSELLOR")
    with Session(engine()) as db, db.begin():
        db.get(Account, accounts["COUNSELLOR"][0]).enabled = False
    assert reviewer.get(ROOT + "/" + item["record_id"]).status_code == 401
    monkeypatch.setattr(gateway, "settings", lambda: SimpleNamespace(environment="production"))
    assert reviewer.get(ROOT + "/" + item["record_id"]).status_code == 404


def test_two_slots_and_no_peer_visibility_to_third_account(reviewer, accounts):
    item = prepare(reviewer)["items"][0]
    url = ROOT + "/" + item["record_id"]
    assert reviewer.post(url + "/revisions", json=body(item, status="FINAL")).status_code == 200
    login(reviewer, accounts, "ADMIN")
    assert reviewer.post(url + "/revisions", json=body(item, status="FINAL")).status_code == 200
    password = secrets.token_urlsafe(36)
    with Session(engine()) as db, db.begin():
        db.add(
            Account(
                username="synthetic-third",
                password_hash=auth.passwords.hash(password),
                role="COUNSELLOR",
            )
        )
    reviewer.post("/api/v1/auth/logout", json={})
    reviewer.post("/api/v1/auth/login", json={"username": "synthetic-third", "password": password})
    response = reviewer.get(url).json()
    assert response["own_history"] == [] and response["peer_final"] is None
    assert not response["can_submit"]
    assert reviewer.post(url + "/revisions", json=body(item)).status_code == 409


def test_append_only_database_and_no_label_logs(reviewer, caplog):
    item = prepare(reviewer)["items"][0]
    assert (
        reviewer.post(ROOT + "/" + item["record_id"] + "/revisions", json=body(item)).status_code
        == 200
    )
    with Session(engine()) as db:
        assert db.scalar(select(AnnotationRecord)) is not None
        assert db.scalar(select(AnnotationRevision)) is not None
        for table in ("c2_annotation_records", "c2_annotation_slots", "c2_annotation_revisions"):
            with pytest.raises(IntegrityError):
                db.execute(text(f"DELETE FROM {table}"))
            db.rollback()
    assert item["preprocessing"]["records"][0]["anonymized_text"] not in caplog.text
