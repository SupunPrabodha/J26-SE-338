"""Submission grouping, assignment fencing, gates and durable independent labels."""

import pytest
from orchestrator.c2_annotation_store import AnnotationSubmission
from orchestrator.c2_submission_import import import_pilot
from research_common.database import Account, engine
from sqlalchemy.orm import Session

from tests.integration.test_c2_annotation import body, login
from tests.integration.test_c2_demo import reviewer as reviewer

ROOT = "/api/v1/c2-annotations"


def synthetic_rows():
    rows = []
    for i in range(4):
        sid = f"SYN-test-{i}"
        answers = []
        for q in range(4, 11):
            # No gold labels or generator hints are passed to annotation.
            value = f"I feel tired after {i + 1} lectures and {q} assignments."
            if q == 10:
                value = None
            if i == 0 and q in (4, 5):
                value = "I feel worried about exams."
            if i == 1 and q == 4:
                value = "ape grp leader supun. eyge girlfriend Neluni . ey hrim npurui"
            answers.append(
                {
                    "record_id": f"{sid}-Q{q}",
                    "question_id": f"Q{q}",
                    "question_text": f"Fictional question {q}",
                    "answer_text": value,
                    "required": q != 10,
                }
            )
        rows.append(
            {
                "submission_id": sid,
                "source_type": "SYNTHETIC",
                "form_version": "test",
                "answers": answers,
            }
        )
    return rows


@pytest.fixture
def pilot(reviewer, accounts):
    with Session(engine()) as db, db.begin():
        report = import_pilot(
            db,
            synthetic_rows(),
            {
                "dataset_id": "J26-SE-338-C2-synthetic-survey-1000-v1",
                "source_file_sha256": "a" * 64,
            },
            [accounts["COUNSELLOR"][0], accounts["ADMIN"][0]],
        )
    return report


def test_pilot_order_optional_duplicates_and_privacy(reviewer, pilot):
    response = reviewer.get(ROOT + "/submissions")
    assert response.status_code == 200 and response.headers["cache-control"] == "no-store"
    rows = response.json()["submissions"]
    assert len(rows) == 4
    assert pilot["optional_unanswered"] == 4
    assert pilot["withheld"] >= 3
    first = rows[0]
    assert [a["question_id"] for a in first["answers"]] == [f"Q{q}" for q in range(4, 11)]
    assert first["answers"][-1]["annotation"] is None
    assert first["answers"][-1]["state"] == "OPTIONAL_UNANSWERED"
    assert not first["answers"][-1]["required"]
    for answer in first["answers"][:2]:
        assert answer["state"] == "WITHHELD" and answer["annotation"] is None
        assert any("duplicate" in reason for reason in answer["blocking_reasons"])
    assert not first["complete"]
    second = rows[1]
    assert second["answers"][0]["state"] == "WITHHELD"
    assert "Neluni" not in str(second)


def test_assignment_blinding_reload_final_lock_and_text(reviewer, accounts, pilot):
    rows = reviewer.get(ROOT + "/submissions").json()["submissions"]
    submission = rows[2]
    answer = next(a for a in submission["answers"] if a["annotation"])
    item = answer["annotation"]["item"]
    url = ROOT + "/" + item["record_id"]
    draft = body(item, labels={"language": "sinhala"})
    assert reviewer.post(url + "/revisions", json=draft).status_code == 200
    engine().dispose()
    restored = reviewer.get(ROOT + "/submissions/" + submission["submission_id"]).json()
    saved = next(a for a in restored["answers"] if a["source_record_id"] == item["record_id"])[
        "annotation"
    ]
    assert saved["own_history"][0]["labels"]["language"] == "sinhala"
    assert saved["item"]["preprocessing"] == item["preprocessing"]
    assert (
        reviewer.post(
            url + "/revisions", json=body(item, status="FINAL", expected_revision=1)
        ).status_code
        == 200
    )
    assert (
        reviewer.post(url + "/revisions", json=body(item, expected_revision=2)).status_code == 409
    )
    login(reviewer, accounts, "ADMIN")
    detail = reviewer.get(url).json()
    assert detail["peer_final"] is None and detail["own_history"] == []
    assert reviewer.post(url + "/revisions", json=body(item, status="FINAL")).json()["peer_final"]
    # Third authorized account cannot access the pilot or claim either answer.
    from orchestrator import auth

    password = "fictional-test-only-password-long"
    with Session(engine()) as db, db.begin():
        db.add(
            Account(
                username="third-pilot", role="ADMIN", password_hash=auth.passwords.hash(password)
            )
        )
    reviewer.post("/api/v1/auth/logout", json={})
    assert (
        reviewer.post(
            "/api/v1/auth/login", json={"username": "third-pilot", "password": password}
        ).status_code
        == 200
    )
    assert reviewer.get(ROOT + "/submissions").json()["submissions"] == []
    assert reviewer.get(ROOT + "/submissions/" + submission["submission_id"]).status_code == 404
    assert reviewer.get(url).status_code == 404
    assert reviewer.post(url + "/revisions", json=body(item)).status_code == 404


def test_import_refuses_overwrite_and_same_identity(reviewer, accounts, pilot):
    provenance = {
        "dataset_id": "J26-SE-338-C2-synthetic-survey-1000-v1",
        "source_file_sha256": "a" * 64,
    }
    with Session(engine()) as db:
        before = db.get(AnnotationSubmission, "SYN-test-0").submission_version
        with pytest.raises(ValueError, match="already imported"):
            import_pilot(
                db, synthetic_rows(), provenance, [accounts["COUNSELLOR"][0], accounts["ADMIN"][0]]
            )
        assert db.get(AnnotationSubmission, "SYN-test-0").submission_version == before
        with pytest.raises(ValueError, match="distinct"):
            import_pilot(db, synthetic_rows(), provenance, [accounts["ADMIN"][0]] * 2)


def test_required_completion_does_not_require_absent_q10(reviewer, pilot):
    sid = "SYN-test-2"
    row = reviewer.get(ROOT + "/submissions/" + sid).json()
    for answer in row["answers"]:
        if answer["annotation"]:
            item = answer["annotation"]["item"]
            assert (
                reviewer.post(
                    ROOT + "/" + item["record_id"] + "/revisions", json=body(item, status="FINAL")
                ).status_code
                == 200
            )
    complete = reviewer.get(ROOT + "/submissions/" + sid).json()
    assert complete["complete"] and complete["finalized_answers"] == 6
    assert complete["agreement_status"] == "NOT_EVALUATED" and complete["human_release_required"]


def test_missing_required_answer_never_becomes_optional(reviewer, accounts):
    rows = synthetic_rows()
    rows[2]["answers"][0]["answer_text"] = None
    with Session(engine()) as db, db.begin():
        report = import_pilot(
            db,
            rows,
            {
                "dataset_id": "J26-SE-338-C2-synthetic-survey-1000-v1",
                "source_file_sha256": "a" * 64,
            },
            [accounts["COUNSELLOR"][0], accounts["ADMIN"][0]],
        )
    assert report["missing_required"] == 1
    row = reviewer.get(ROOT + "/submissions/SYN-test-2").json()
    assert row["answers"][0]["state"] == "MISSING_REQUIRED"
    assert row["answers"][0]["annotation"] is None and not row["complete"]
