import json

import pytest
from preprocessing.anonymization_evaluation import (
    EvaluationCase,
    build_evaluation_summary,
    evaluate_anonymizer,
)


def perfect_cases() -> list[EvaluationCase]:
    return [
        EvaluationCase(
            case_id="SYN-EMAIL",
            synthetic_text="Contact synthetic.student@example.com.",
            expected_anonymized_text="Contact [EMAIL].",
        ),
        EvaluationCase(
            case_id="SYN-PHONE",
            synthetic_text="Call 0771234567.",
            expected_anonymized_text="Call [PHONE].",
        ),
        EvaluationCase(
            case_id="SYN-STUDENT-ID",
            synthetic_text="My identifier is IT23123456.",
            expected_anonymized_text="My identifier is [STUDENT_ID].",
        ),
        EvaluationCase(
            case_id="SYN-ENGLISH-NAME",
            synthetic_text="My name is Nimal.",
            expected_anonymized_text="My name is [PERSON].",
        ),
        EvaluationCase(
            case_id="SYN-SINHALA-NAME",
            synthetic_text="මගේ නම කමල්.",
            expected_anonymized_text="මගේ නම [PERSON].",
        ),
        EvaluationCase(
            case_id="SYN-ROMANIZED-NAME",
            synthetic_text="Mage nama Kasun.",
            expected_anonymized_text="Mage nama [PERSON].",
        ),
        EvaluationCase(
            case_id="SYN-LOCATION",
            synthetic_text="I live in Kandy.",
            expected_anonymized_text="I live in [LOCATION].",
        ),
        EvaluationCase(
            case_id="SYN-MIXED",
            synthetic_text=("My name is Kavindu, email kavindu@example.com and call 0751234567."),
            expected_anonymized_text=("My name is [PERSON], email [EMAIL] and call [PHONE]."),
        ),
    ]


def test_perfect_synthetic_holdout_metrics():
    metrics = evaluate_anonymizer(perfect_cases())

    assert metrics.total_cases == 8
    assert metrics.true_positives == 10
    assert metrics.false_positives == 0
    assert metrics.false_negatives == 0
    assert metrics.exact_matches == 8
    assert metrics.precision == 1.0
    assert metrics.recall == 1.0
    assert metrics.f1_score == 1.0
    assert metrics.exact_match_rate == 1.0
    assert metrics.error_counts == {}


@pytest.mark.parametrize(
    "case",
    [
        EvaluationCase(
            case_id="SYN-SINHALA",
            synthetic_text="මම නිමලි.",
            expected_anonymized_text="මම [PERSON].",
        ),
        EvaluationCase(
            case_id="SYN-ROMANIZED",
            synthetic_text="Mage nama Saman.",
            expected_anonymized_text="Mage nama [PERSON].",
        ),
        EvaluationCase(
            case_id="SYN-ENGLISH",
            synthetic_text="I'm Perera.",
            expected_anonymized_text="I'm [PERSON].",
        ),
    ],
)
def test_language_varieties_exact_match(case):
    metrics = evaluate_anonymizer([case])

    assert metrics.exact_matches == 1
    assert metrics.false_negatives == 0


def test_missed_entity_is_aggregated_without_pii_value():
    case = EvaluationCase(
        case_id="SYN-MISSED",
        synthetic_text="Synthetic sentence without an identifier.",
        expected_anonymized_text=("Synthetic sentence without [STUDENT_ID]."),
    )

    metrics = evaluate_anonymizer([case])

    assert metrics.false_negatives == 1
    assert metrics.recall == 0.0
    assert metrics.error_counts["missed_entity"] == 1
    assert metrics.error_counts["output_mismatch"] == 1


def test_false_detection_is_aggregated():
    case = EvaluationCase(
        case_id="SYN-FALSE-POSITIVE",
        synthetic_text="Contact synthetic@example.com.",
        expected_anonymized_text="Contact synthetic@example.com.",
    )

    metrics = evaluate_anonymizer([case])

    assert metrics.false_positives == 1
    assert metrics.error_counts["false_detection"] == 1


def test_residual_risk_increases_review_count():
    case = EvaluationCase(
        case_id="SYN-REVIEW",
        synthetic_text="Synthetic reference 12345678.",
        expected_anonymized_text="Synthetic reference 12345678.",
    )

    metrics = evaluate_anonymizer([case])

    assert metrics.review_required == 1
    assert metrics.error_counts["privacy_review_required"] == 1


def test_summary_contains_aggregate_metrics_only():
    sensitive_synthetic_text = "Contact synthetic.student@example.com."
    case = EvaluationCase(
        case_id="SYN-PRIVATE",
        synthetic_text=sensitive_synthetic_text,
        expected_anonymized_text="Contact [EMAIL].",
    )

    metrics = evaluate_anonymizer([case])
    summary = build_evaluation_summary(metrics)
    serialized = json.dumps(summary)

    assert summary["evaluation_scope"] == "disposable_synthetic_fixtures"
    assert summary["residual_pii_count"] == 0
    assert sensitive_synthetic_text not in serialized
    assert "synthetic_text" not in serialized
    assert "expected_anonymized_text" not in serialized
