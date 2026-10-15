"""Actual title/role inference and independent residual-privacy routing."""

import pytest
from preprocessing.person_context import grammatical_suffix, parse_contexts
from preprocessing.person_context_regressions import development
from preprocessing.pipeline import PipelineInput, run_preprocessing_pipeline
from preprocessing.privacy_gate import assess_release
from preprocessing.span_evaluation import evaluate_detection, render

from tests.unit.test_c2_contextual_detection import splits_boundary


@pytest.mark.parametrize(
    "fixture",
    [
        pytest.param(
            c,
            marks=pytest.mark.xfail(
                strict=True,
                reason="Existing spaCy false mask in malformed title surface; not caused by augmentation",
            ),
        )
        if c.case_id in {"negative-8", "negative-9"}
        else c
        for c in development()
    ],
    ids=lambda c: c.case_id,
)
def test_actual_presidio_name_offsets_and_negatives(fixture):
    spans = evaluate_detection(fixture.text, "presidio")
    assert spans == fixture.gold
    result = run_preprocessing_pipeline(
        [PipelineInput("fixture", fixture.text)], strategy="presidio"
    )
    assert result.records[0].anonymized_text == render(fixture.text, fixture.gold)
    assert not any(splits_boundary(fixture.text, b) for s in spans for b in (s.start, s.end))


@pytest.mark.parametrize("strategy", ["regex", "presidio", "hybrid"])
def test_reported_case_and_protected_name(strategy):
    text = "ape supervisor MS. Aprna . Ape group leader supun"
    result = run_preprocessing_pipeline([PipelineInput("fixture", text)], strategy=strategy)
    assert (
        result.records[0].anonymized_text
        == "ape supervisor MS. [PERSON] . Ape group leader [PERSON]"
    )
    assert result.records[0].quality_status == "PASS"
    assert not result.records[0].requires_privacy_review
    assert result.privacy_summary["status"] == "PASSED"
    result = run_preprocessing_pipeline(
        [PipelineInput("fixture", "mage nama neluni mt exam gna byi")], strategy=strategy
    )
    assert result.records[0].anonymized_text == "mage nama [PERSON] mt exam gna byi"


@pytest.mark.parametrize("strategy", ["regex", "presidio", "hybrid"])
def test_unresolved_malformed_name_signal_quarantines(strategy):
    result = run_preprocessing_pipeline(
        [PipelineInput("fixture", "Our supervisor avira123.")], strategy=strategy
    )
    assert result.records[0].requires_privacy_review
    assert result.records[0].quality_status == "REVIEW"  # Existing policy routing.
    assert "privacy_review_required" in result.records[0].quality_issues
    assert result.privacy_summary["status"] == "FAILED"
    assert result.privacy_summary["issue_counts"]["privacy_review_required"] == 1
    assert not result.release_ready
    assert "privacy_review_required" in result.blocking_reasons
    assert "release_privacy_gate_failed" in result.blocking_reasons


@pytest.mark.parametrize(
    "text,issue",
    [
        ("Our supervisor avira.", "privacy_review_required"),
        ("Ms. nilara123.", "privacy_review_required"),
        ("sample@example.com", "residual_email"),
        ("0771234567", "residual_phone"),
        ("IT12345678", "residual_student_id"),
        ("", "empty_anonymized_text"),
        (None, "invalid_anonymized_text"),
    ],
)
def test_release_gate_detects_residuals_independently(text, issue):
    gate = assess_release(
        ("record_id", "anonymized_text"), [{"record_id": "test", "anonymized_text": text}]
    )
    assert not gate.passed
    assert issue in gate.issues


def test_review_flag_is_honoured_and_validated_not_coerced():
    for flag, issue in [
        (True, "privacy_review_required"),
        ("false", "invalid_privacy_review_flag"),
    ]:
        gate = assess_release(
            ("record_id", "anonymized_text"),
            [
                {
                    "record_id": "x",
                    "anonymized_text": "I feel worried about exams.",
                    "requires_privacy_review": flag,
                }
            ],
        )
        assert issue in gate.issues
        assert not gate.passed


def test_empty_duplicate_and_placeholders_keep_existing_gates():
    assert not run_preprocessing_pipeline([]).release_ready
    assert not run_preprocessing_pipeline([None]).release_ready
    duplicate = run_preprocessing_pipeline(
        [
            PipelineInput("a", "I feel worried about exams."),
            PipelineInput("b", "I feel worried about exams."),
        ]
    )
    assert all(r.quality_status == "REVIEW" for r in duplicate.records)
    assert not duplicate.release_ready
    text = "Ms. [PERSON]. Our group leader [PERSON]. [EMAIL] [PHONE] [STUDENT_ID]"
    assert parse_contexts(text) == ((), ())
    assert assess_release(
        ("record_id", "anonymized_text"), [{"record_id": "a", "anonymized_text": text}]
    ).passed


def test_boundary_trim_cannot_discard_a_neighbouring_name():
    assert grammatical_suffix("dR avira feels tired", 8, 20)
    assert not grammatical_suffix("dR avira met Oliver Reed", 8, 23)
    assert not grammatical_suffix("dR avira ශ්‍රියා", 8, 15)
    assert parse_contexts("Our supervisor aravin selora navin devara kelora.")[1]


@pytest.mark.parametrize(
    "text",
    [
        "My name is aravin selora navin devara kelora.",
        "My name is [PERSON] devara kelora.",
        "Ms. [PERSON] selora.",
    ],
)
def test_unresolved_partial_or_unbounded_introductions_block_release(text):
    assert not assess_release(
        ("record_id", "anonymized_text"), [{"record_id": "a", "anonymized_text": text}]
    ).passed


@pytest.mark.parametrize("strategy", ["regex", "presidio", "hybrid"])
def test_unresolved_relative_name_statement_requires_review_without_fake_masking(
    strategy, monkeypatch
):
    from preprocessing import person_context

    text = "Mge nngige nama senali eyt ghuwa kiyl mt supun bnna"
    with monkeypatch.context() as baseline:
        baseline.setattr(person_context, "requires_context_review", lambda text: False)
        previous = run_preprocessing_pipeline([PipelineInput("fixture", text)], strategy=strategy)
    result = run_preprocessing_pipeline([PipelineInput("fixture", text)], strategy=strategy)
    # Existing NER masks a broader phrase containing Supun, but misses Senali.
    # The review correction must not invent a successful name mask.
    assert result.records[0].anonymized_text == previous.records[0].anonymized_text
    assert result.records[0].requires_privacy_review
    assert result.privacy_summary["status"] == "FAILED"
    assert not result.release_ready


def test_role_copula_name_like_signal_is_review_only_not_ordinary_description():
    exposed = "Our supervisor is avira."
    assert not assess_release(
        ("record_id", "anonymized_text"), [{"record_id": "a", "anonymized_text": exposed}]
    ).passed
    ordinary = "Our supervisor is helpful."
    assert assess_release(
        ("record_id", "anonymized_text"), [{"record_id": "a", "anonymized_text": ordinary}]
    ).passed
