"""Reference-score arithmetic, explicit missing labels and safe CLI evidence."""

import json
import subprocess
import sys
from pathlib import Path

import pytest
from preprocessing.validation_evaluation import evaluate_cases, validate_cases

FIXTURE = Path("tests/fixtures/synthetic/c2-validation-benchmark.json")


def test_hand_counted_scores_include_a_miss_and_abstention():
    report = evaluate_cases(
        json.loads(FIXTURE.read_text(encoding="utf-8"))["cases"], strategy="regex"
    )
    pii, language = report["anonymization"], report["language_id"]
    assert report["records_processed"] == 6
    assert (pii["tp"], pii["fp"], pii["fn"]) == (1, 0, 1)
    assert pii["f1"] == pytest.approx(2 / 3)
    assert pii["recall"] == 0.5
    assert pii["exact_record_match_rate"] == 0.8
    assert pii["entirely_exposed_entities"] == 1
    assert pii["by_language"]["romanized-si"]["fn"] == 1
    assert pii["by_language"]["english"]["f1"] == 1
    assert (language["labelled_records"], language["correct_records"], language["abstentions"]) == (
        5,
        4,
        1,
    )
    assert language["accuracy"] == 0.8
    assert language["by_language"]["romanized-si"]["f1"] == 0
    assert pii["unlabelled_records"] == language["unlabelled_records"] == 1
    assert report["records"][-1] == {
        "record_index": 6,
        "pii_evaluated": False,
        "language_evaluated": False,
    }


def test_missing_gold_never_becomes_a_correct_negative():
    report = evaluate_cases([{"text": "No explicit references here."}], strategy="regex")
    assert report["anonymization"]["status"] == report["language_id"]["status"] == "NOT_MEASURED"
    assert report["anonymization"]["f1"] is None
    assert report["anonymization"]["exact_record_match_rate"] is None
    assert report["language_id"]["accuracy"] is None


def test_explicit_negative_has_no_defined_entity_f1():
    report = evaluate_cases([{"text": "I feel tired.", "gold_pii": []}], strategy="regex")
    assert report["anonymization"]["labelled_records"] == 1
    assert report["anonymization"]["exact_record_match_rate"] == 1
    assert report["anonymization"]["f1"] is None


def test_incorrect_entity_type_is_not_counted_as_correct():
    report = evaluate_cases(
        [
            {
                "text": "My name is Nimal.",
                "gold_pii": [{"start": 11, "end": 16, "entity_type": "LOCATION"}],
            }
        ],
        strategy="regex",
    )
    assert (
        report["anonymization"]["tp"],
        report["anonymization"]["fp"],
        report["anonymization"]["fn"],
    ) == (0, 1, 1)
    assert report["anonymization"]["f1"] == 0


@pytest.mark.parametrize(
    "cases",
    [
        [],
        [{"text": "fixture", "gold_pii": None}],
        [{"text": "fixture", "gold_pii": [{"start": 0, "end": 999, "entity_type": "PERSON"}]}],
        [{"text": "fixture", "gold_pii": [{"start": True, "end": 3, "entity_type": "PERSON"}]}],
        [{"text": "fixture", "gold_language": "unsupported"}],
        [{"text": "private-input-sentinel", "participant_id": "private-id-sentinel"}],
    ],
)
def test_invalid_references_fail_without_echoing_text(cases):
    with pytest.raises(ValueError) as caught:
        validate_cases(cases)
    assert "private-input-sentinel" not in str(caught.value)
    assert "private-id-sentinel" not in str(caught.value)


def test_runtime_trace_mismatch_refuses_a_score(monkeypatch):
    monkeypatch.setattr("preprocessing.validation_evaluation.evaluate_detection", lambda *_: ())
    with pytest.raises(ValueError, match="Runtime/trace mismatch"):
        evaluate_cases([{"text": "My name is Nimal.", "gold_pii": []}], strategy="regex")


def test_cli_emits_text_free_report_and_refuses_overwrite(tmp_path):
    output = tmp_path / "fresh-report"
    command = [
        sys.executable,
        "scripts/run.py",
        "scripts.c2_validate_outputs",
        "--input",
        str(FIXTURE),
        "--output-dir",
        str(output),
        "--strategy",
        "regex",
    ]
    first = subprocess.run(command, capture_output=True, text=True)
    assert first.returncode == 0, first.stderr
    raw = (output / "report.json").read_text(encoding="utf-8")
    report = json.loads(raw)
    assert report["provenance"]["reference_status"] == "unreviewed"
    assert len(report["provenance"]["input_sha256"]) == 64
    assert "services/preprocessing/validation.py" in report["provenance"]["source_sha256"]
    for case in json.loads(FIXTURE.read_text(encoding="utf-8"))["cases"]:
        assert case["text"] not in raw + first.stdout
    assert "## Rule locations" in (output / "report.md").read_text(encoding="utf-8")
    second = subprocess.run(command, capture_output=True, text=True)
    assert second.returncode == 2
    assert (output / "report.json").read_text(encoding="utf-8") == raw
