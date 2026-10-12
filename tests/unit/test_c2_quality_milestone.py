import json
import unicodedata
from dataclasses import asdict
from pathlib import Path

import pytest
from preprocessing.data_quality import (
    DEFAULT_QUALITY_POLICY,
    QualityPolicy,
    QualityRecord,
    assess_records,
    build_quality_summary,
    text_comparison_key,
)
from preprocessing.pipeline import PipelineInput, build_pipeline_summary, run_preprocessing_pipeline
from preprocessing.privacy_gate import assess_release
from preprocessing.quality_report import run_synthetic_checks


def test_documented_regressions_match_all_expected_statuses_issues_and_gates():
    evidence = run_synthetic_checks()
    assert evidence["failed_executions"] == 0
    assert evidence["matched_executions"] == evidence["execution_count"]
    assert {row["strategy"] for row in evidence["outcomes"]} == {
        "quality_only",
        "regex",
        "presidio",
        "hybrid",
    }
    assert set(evidence["scenario_language_counts"]) == {
        "english",
        "sinhala",
        "romanized",
        "code_mixed",
    }


@pytest.mark.parametrize("strategy", ["regex", "presidio", "hybrid"])
def test_unresolved_review_blocks_without_privacy_flag(strategy):
    result = run_preprocessing_pipeline([PipelineInput("disposable", "ok")], strategy=strategy)
    assert result.records[0].quality_status == "REVIEW"
    assert not result.records[0].requires_privacy_review
    assert result.blocking_reasons == ("data_quality_review_required",)
    assert not result.release_ready
    assert result.quality_summary["data_quality_gate"] == "FAILED"
    assert result.privacy_summary["status"] == "PASSED"
    assert build_pipeline_summary(result)["human_release_required"] is True


@pytest.mark.parametrize("strategy", ["regex", "presidio", "hybrid"])
def test_empty_and_combined_batch_reasons_are_deterministic(strategy):
    empty = run_preprocessing_pipeline([], strategy=strategy)
    assert empty.blocking_reasons == ("empty_batch", "release_privacy_gate_failed")
    mixed = run_preprocessing_pipeline(
        [PipelineInput("one", "ok"), PipelineInput(None, "I feel tired.")], strategy=strategy
    )
    assert mixed.blocking_reasons == (
        "data_quality_rejected",
        "data_quality_review_required",
        "release_privacy_gate_failed",
    )
    assert not mixed.release_ready


def test_comparison_normalizes_only_keys_and_preserves_marks_joiners():
    text = "  මට\tකෝපයි. ක්\u200dර ක\u200cම 👩\u200d👩!\n"
    decomposed = unicodedata.normalize("NFD", text)
    assert text_comparison_key(text) == text_comparison_key(decomposed)
    assert "\u200d" in text_comparison_key(text)
    assert "\u200c" in text_comparison_key(text)
    records = [QualityRecord("one", text), QualityRecord("two", decomposed)]
    results = assess_records(records)
    assert all(row.issues == ("duplicate_text",) for row in results)
    assert records[0].anonymized_text == text
    assert records[1].anonymized_text == decomposed
    pipeline = run_preprocessing_pipeline([PipelineInput("one", text)])
    assert pipeline.records[0].anonymized_text == text


def test_id_semantics_are_trimmed_case_sensitive_without_nfc():
    rows = assess_records(
        [
            QualityRecord("café", "I feel tired."),
            QualityRecord("cafe\u0301", "I need support."),
            QualityRecord("Case", "Mata dukai."),
            QualityRecord("case", "විභාග නිසා බයයි."),
        ]
    )
    assert all(row.status == "PASS" for row in rows)
    duplicate = assess_records(
        [QualityRecord(" same ", "I feel tired."), QualityRecord("same", "I need support.")]
    )
    assert all(row.issues == ("duplicate_record_id",) for row in duplicate)


@pytest.mark.parametrize("strategy", ["regex", "presidio", "hybrid"])
def test_masking_collision_blocks_and_keeps_both_records(strategy):
    result = run_preprocessing_pipeline(
        [
            PipelineInput("one", "Contact fixture.one@example.com."),
            PipelineInput("two", "Contact fixture.two@example.com."),
        ],
        strategy=strategy,
    )
    assert len(result.records) == 2
    assert result.records[0].anonymized_text == result.records[1].anonymized_text
    assert all(row.quality_issues == ("duplicate_text",) for row in result.records)
    assert result.blocking_reasons == ("data_quality_review_required",)


@pytest.mark.parametrize("strategy", ["regex", "presidio", "hybrid"])
@pytest.mark.parametrize("bad_text", [None, 123, False, [], {}, b"synthetic", "bad\ud800"])
def test_pipeline_invalid_text_is_rejected_without_crashing(strategy, bad_text):
    result = run_preprocessing_pipeline([PipelineInput(None, bad_text)], strategy=strategy)
    assert not result.release_ready
    assert result.records[0].quality_status == "REJECT"
    assert result.records[0].record_id == result.records[0].anonymized_text == ""


def test_bad_record_objects_and_error_messages_are_safe(caplog):
    class UnsafeString:
        def __str__(self):
            raise AssertionError("Submitted object was coerced to text")

    result = run_preprocessing_pipeline([None, {}, PipelineInput(UnsafeString(), UnsafeString())])
    assert all(row.quality_status == "REJECT" for row in result.records)
    privacy = assess_release(
        ("record_id", "anonymized_text"),
        [None, {"record_id": UnsafeString(), "anonymized_text": UnsafeString()}],
    )
    assert not privacy.passed
    assert "invalid_record_id" in privacy.issues
    assert "invalid_anonymized_text" in privacy.issues
    with pytest.raises(ValueError, match="iterable of records") as error:
        run_preprocessing_pipeline("disposable-private-text")
    assert "disposable-private-text" not in str(error.value)
    assert "disposable-private-text" not in caplog.text


@pytest.mark.parametrize("threshold", [0, -1, True, 3.5, "3", None])
def test_policy_rejects_invalid_thresholds(threshold):
    with pytest.raises(ValueError, match="positive integer"):
        QualityPolicy(short_text_review_below=threshold)


def test_policy_is_explicit_and_validated():
    config = json.loads(Path("research/c2-dataset-pipeline/config/quality-policy.json").read_text())
    assert config == asdict(DEFAULT_QUALITY_POLICY)
    assert (
        json.loads(Path("research/c2-dataset-pipeline/config/release-policy.json").read_text())[
            "human_release_required"
        ]
        is True
    )
    with pytest.raises(ValueError, match="boolean"):
        QualityPolicy(comparison_case_insensitive="false")
    rows = [QualityRecord("one", "Hello!"), QualityRecord("two", "hello!")]
    assert all(
        row.status == "PASS"
        for row in assess_records(rows, policy=QualityPolicy(comparison_case_insensitive=False))
    )
    assert (
        assess_records(
            [QualityRecord("one", "ok")], policy=QualityPolicy(short_text_review_below=1)
        )[0].status
        == "PASS"
    )
    with pytest.raises(ValueError, match="validated"):
        run_preprocessing_pipeline([], quality_policy={})


def test_combined_issue_precedence_and_short_text_policy():
    record = QualityRecord("", "x\ufffd\u0000", requires_privacy_review=True)
    result = assess_records([record])[0]
    assert result.status == "REJECT"
    assert result.issues == (
        "missing_record_id",
        "replacement_character",
        "suspicious_control_character",
        "privacy_review_required",
    )
    assert build_quality_summary([result])["data_quality_gate"] == "FAILED"
    review = assess_records([QualityRecord("one", "😔")])[0]
    assert review.status == "REVIEW"
    assert review.issues == ("very_short_text",)


def test_omitted_fields_are_reported_as_missing():
    quality = assess_records([QualityRecord()])[0]
    assert quality.issues == ("missing_record_id", "missing_text")
    pipeline = run_preprocessing_pipeline([PipelineInput()])
    assert pipeline.records[0].quality_issues == quality.issues
    assert not pipeline.release_ready


@pytest.mark.parametrize("strategy", ["regex", "presidio", "hybrid"])
@pytest.mark.parametrize(
    "text,signal",
    [
        ("I feel \ufffd tired.", "replacement_character"),
        ("I feel\u0000 tired.", "suspicious_control_character"),
    ],
)
def test_input_character_signals_pass_through_every_strategy(strategy, text, signal):
    result = run_preprocessing_pipeline([PipelineInput("one", text)], strategy=strategy)
    assert signal in result.records[0].quality_issues
    assert not result.release_ready


def test_anonymization_cannot_erase_input_review_signals(monkeypatch):
    from types import SimpleNamespace

    monkeypatch.setattr(
        "preprocessing.pipeline.anonymize_text",
        lambda _: SimpleNamespace(
            anonymized_text="Safe masked sentence.", transformations=(), requires_review=False
        ),
    )
    result = run_preprocessing_pipeline([PipelineInput("one", "\ufffd\u0000")])
    assert result.records[0].quality_issues == (
        "replacement_character",
        "suspicious_control_character",
    )
    assert result.blocking_reasons == ("data_quality_review_required",)


def test_aggregate_evidence_has_no_input_text_or_record_identifiers():
    result = run_synthetic_checks()
    serialized = json.dumps(result)
    for forbidden in (
        "fixture.one@example.com",
        "synthetic-valid",
        "I feel tired.",
        "විභාග නිසා බයයි.",
        "record_id",
        "anonymized_text",
        "synthetic_text",
    ):
        assert (
            forbidden not in serialized
            if forbidden not in {"record_id", "anonymized_text"}
            else f'"{forbidden}"' not in serialized
        )
    assert result["independent_research_validation"] is False
