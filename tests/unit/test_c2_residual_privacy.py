"""Actual-output fault injection; labels are never substituted into responses."""

import json
from dataclasses import replace
from pathlib import Path

import pytest
from preprocessing.pipeline import PipelineInput, run_preprocessing_pipeline
from preprocessing.privacy_gate import assess_release
from preprocessing.residual_privacy import assess_output
from preprocessing.validation import check_residual_output
from research_contracts import C2CustomDemoRequest, C2CustomDemoResponse, C2DemoValidationSummary


@pytest.mark.parametrize(
    "text,rule,status",
    [
        ("Name: Alina Rowan", "person_field", "FAIL"),
        ("Full\tName: සඳලි පෙරේරා", "person_field", "FAIL"),
        ("Location: Kegalle", "location_field", "FAIL"),
        ("ලිපිනය: 42 නව පාර", "location_field", "FAIL"),
        ("Name: [PERSON] Ellison", "person_field", "FAIL"),
        ("My name is [PERSON] Ellison.", "person_context", "REVIEW"),
        ("mge nama kavindi", "person_context", "REVIEW"),
        ("මගේ නම දිල්කි", "person_context", "REVIEW"),
        ("It is in balangoda", "location_context", "REVIEW"),
        ("මම කෑගල්ල ජීවත් වෙමි", "location_context", "REVIEW"),
        ("Name: [LOCATION]", "placeholder_type", "REVIEW"),
        ("My name is [LOCATION].", "placeholder_type", "REVIEW"),
        ("fixture@example.com", "email", "FAIL"),
        ("0771234567", "phone", "FAIL"),
        ("IT12345678", "student_id", "FAIL"),
    ],
)
def test_output_signals_and_direct_gate_block_even_with_false_safe_flag(text, rule, status):
    assert any(s.rule_id == rule and s.status == status for s in assess_output(text))
    gate = assess_release(
        ("record_id", "anonymized_text"),
        [dict(record_id="synthetic", anonymized_text=text, requires_privacy_review=False)],
    )
    assert not gate.passed


@pytest.mark.parametrize(
    "text",
    [
        "Name: [PERSON]; Location: [LOCATION]",
        "My name is [PERSON]. I feel tired.",
        "mage nama [PERSON] mt exam gna byi",
        "මම [LOCATION] ජීවත් වෙමි.",
        "මම අද මහන්සියි.",
        "Mata exams gana dukai.",
        "Our supervisor is helpful.",
        "[PERSON] 🙂 [LOCATION]",
    ],
)
def test_protected_outputs_no_signal_not_verified_anonymity(text):
    assert assess_output(text) == ()


def test_actual_pipeline_blocks_regex_missed_field_without_changing_masking_or_quality():
    run = run_preprocessing_pipeline([PipelineInput("synthetic", "Name: Elara Voss")])
    record = run.records[0]
    assert record.anonymized_text == "Name: Elara Voss"
    assert record.quality_status == "PASS"
    assert record.requires_privacy_review
    assert not run.release_ready
    assert "residual_person_field" in run.privacy_summary["issues"]
    assert run.validation_summary["release_policy_unchanged"] is False
    rules = {c["rule_id"]: c["status"] for c in run.validation_summary["records"][0]["checks"]}
    assert rules["anonymization.person_field"] == "FAIL"
    assert rules["normalization.content"] == rules["tokenization.coverage"] == "PASS"


def test_auditor_uses_actual_output_not_requires_review_or_original_spans():
    record = run_preprocessing_pipeline([PipelineInput("synthetic", "I feel tired.")]).records[0]
    damaged = replace(
        record, anonymized_text="Location: [LOCATION] Colombo", requires_privacy_review=False
    )
    checks = {c["rule_id"]: c for c in check_residual_output(damaged)}
    assert checks["anonymization.location_field"]["status"] == "FAIL"
    assert (
        "lexical_residue_in_explicit_identifying_field"
        in checks["anonymization.location_field"]["reasons"]
    )


def test_unrestricted_names_and_fully_masked_wrong_types_are_not_verified():
    # These genuine limitations remain visible, never manufacture a detector pass.
    assert assess_output("I met Dalen beside Keswick.") == ()
    assert assess_output("[LOCATION] called today.") == ()
    assert any(s.status == "REVIEW" for s in assess_output("I live in hope."))  # Known false alarm.


def test_historical_validation_v1_remains_compatible():
    historical = json.loads(
        Path("tests/fixtures/synthetic/c2-output-validation.json").read_text(encoding="utf-8")
    )
    assert C2DemoValidationSummary.model_validate(historical).method == "c2-output-validation-v1"


def test_current_response_and_older_response_without_optional_report_are_compatible():
    from preprocessing.demo import execute_custom

    response = execute_custom(C2CustomDemoRequest(strategy="presidio", text="I feel tired."))
    assert response.validation_summary.release_policy_unchanged is False
    older = response.model_dump(mode="json")
    older.pop("validation_summary")
    assert C2CustomDemoResponse.model_validate(older).validation_summary is None
