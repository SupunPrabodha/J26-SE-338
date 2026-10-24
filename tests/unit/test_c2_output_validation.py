"""Fault injection proves diagnostics inspect actual outputs, not expected fixture IDs."""

import json
from dataclasses import replace
from pathlib import Path

import pytest
from preprocessing.pipeline import PipelineInput, build_pipeline_summary, run_preprocessing_pipeline
from preprocessing.validation import RULES, build_validation_summary
from research_contracts import C2DemoValidationSummary


@pytest.fixture
def record():
    return run_preprocessing_pipeline([PipelineInput("synthetic", "I feel tired.")]).records[0]


def checks(record):
    summary = build_validation_summary((record,), strategy="regex")
    return {check["rule_id"]: check["status"] for check in summary["records"][0]["checks"]}


def test_batch_denominators_reviews_and_skips_are_explicit():
    actual = run_preprocessing_pipeline(
        [
            PipelineInput("one", "I feel tired."),
            PipelineInput("two", ""),
            PipelineInput("three", "Hi"),
            PipelineInput("four", "Reference 12345678."),
        ]
    )
    report = actual.validation_summary
    stages = {row["stage"]: row for row in report["stages"]}
    assert stages["quality"] == {
        "stage": "quality",
        "checked_records": 4,
        "passed_records": 1,
        "failed_records": 1,
        "review_records": 2,
        "not_evaluated_records": 0,
        "pass_rate_percent": 25.0,
    }
    assert stages["anonymization"]["checked_records"] == 3
    assert stages["anonymization"]["review_records"] == 1
    assert stages["anonymization"]["pass_rate_percent"] == 66.67
    assert stages["normalization"]["not_evaluated_records"] == 1
    assert stages["tokenization"]["checked_records"] == 3
    for stage in stages.values():
        assert stage["checked_records"] + stage["not_evaluated_records"] == 4
    C2DemoValidationSummary.model_validate(report)
    assert not actual.release_ready


def test_empty_batch_never_claims_one_hundred_percent():
    report = run_preprocessing_pipeline([]).validation_summary
    assert report["records_processed"] == 0
    assert all(stage["pass_rate_percent"] is None for stage in report["stages"])


def test_report_is_text_and_identifier_free_and_repeatable():
    text = "Contact private.synthetic.sentinel@example.com."
    inputs = [PipelineInput("private-input-id-sentinel", text)]
    first, second = (run_preprocessing_pipeline(inputs) for _ in range(2))
    assert first.validation_summary == second.validation_summary
    encoded = json.dumps(build_pipeline_summary(first))
    assert text not in encoded
    assert "private.synthetic.sentinel" not in encoded
    assert "private-input-id-sentinel" not in encoded
    assert first.validation_summary["accuracy_status"] == "NOT_MEASURED"


@pytest.mark.parametrize(
    "change,failed",
    [
        ({"normalized_text": "I feel  tired."}, "normalization.whitespace"),
        ({"normalized_text": "i feel tired."}, "normalization.content"),
        ({"normalized_text": "Ifeeltired."}, "normalization.content"),
        ({"normalized_text": "I feel tired. e\u0301"}, "normalization.nfc"),
        ({"tokens": ("I",)}, "tokenization.offsets"),
        ({"token_offsets": ((0, 1), (2, 6), (7, 11), (12, 13))}, "tokenization.offsets"),
        ({"tokens": ("I", "feel"), "token_offsets": ((0, 1), (2, 6))}, "tokenization.coverage"),
    ],
)
def test_corruption_is_detected_without_recomputing_outputs(record, change, failed):
    assert checks(replace(record, **change))[failed] == "FAIL"


def test_dropped_negation_fails_content_check(record):
    damaged = replace(
        record, anonymized_text="I do NOT feel well.", normalized_text="I do feel well."
    )
    assert checks(damaged)["normalization.content"] == "FAIL"


def test_grapheme_split_and_placeholder_split_fail(record):
    damaged = replace(
        record,
        anonymized_text="e\u0301",
        normalized_text="e\u0301",
        tokens=("e", "\u0301"),
        token_offsets=((0, 1), (1, 2)),
    )
    assert checks(damaged)["tokenization.graphemes"] == "FAIL"
    damaged = replace(
        record,
        anonymized_text="[PERSON]",
        normalized_text="[PERSON]",
        tokens=("[", "PERSON", "]"),
        token_offsets=((0, 1), (1, 7), (7, 8)),
    )
    assert checks(damaged)["tokenization.placeholders"] == "FAIL"
    damaged = replace(damaged, normalized_text="[LOCATION]")
    assert checks(damaged)["normalization.placeholders"] == "FAIL"


def test_attached_marks_are_preserved_as_a_single_grapheme(record):
    actual = run_preprocessing_pipeline([PipelineInput("synthetic", "Hi[PERSON]\u0301!")]).records[
        0
    ]
    assert checks(actual)["tokenization.placeholders"] == "PASS"


@pytest.mark.parametrize(
    "text,rule",
    [
        ("fixture@example.com", "anonymization.residual_email"),
        ("0771234567", "anonymization.residual_phone"),
        ("IT12345678", "anonymization.residual_student_id"),
    ],
)
def test_exposed_supported_identifiers_fail_even_with_false_safe_flag(record, text, rule):
    assert (
        checks(replace(record, anonymized_text=text, requires_privacy_review=False))[rule] == "FAIL"
    )


def test_one_failed_rule_means_whole_stage_failed(record):
    damaged = replace(record, tokens=("I",), token_offsets=((0, 1),))
    stage = build_validation_summary((damaged,), strategy="regex")["stages"][-1]
    assert stage["failed_records"] == 1
    assert stage["pass_rate_percent"] == 0


def test_every_reported_rule_has_a_real_code_location():
    import preprocessing.validation as module

    assert len({row[0] for row in RULES}) == len(RULES)
    for _, _, function in RULES:
        assert callable(getattr(module, function))
    assert Path(module.SOURCE).is_file()
