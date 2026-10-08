import json
from dataclasses import replace

import pytest
from preprocessing.anonymization_evaluation import EvaluationMetrics
from preprocessing.evaluation_gate import (
    EvaluationThresholds,
    assess_evaluation_gate,
    build_gate_summary,
)


def make_metrics() -> EvaluationMetrics:
    return EvaluationMetrics(
        total_cases=20,
        true_positives=18,
        false_positives=0,
        false_negatives=0,
        exact_matches=19,
        review_required=0,
        precision=1.0,
        recall=1.0,
        f1_score=1.0,
        exact_match_rate=0.95,
        error_counts={},
    )


def make_thresholds() -> EvaluationThresholds:
    return EvaluationThresholds(
        minimum_precision=0.80,
        minimum_recall=0.90,
        minimum_f1_score=0.85,
        minimum_exact_match_rate=0.70,
        maximum_residual_pii=0,
    )


def test_metrics_passing_all_thresholds_pass_gate():
    result = assess_evaluation_gate(
        make_metrics(),
        make_thresholds(),
    )

    assert result.passed is True
    assert result.failed_checks == ()
    assert all(result.checks.values())


@pytest.mark.parametrize(
    ("changed_metrics", "expected_failed_check"),
    [
        (
            {"precision": 0.79},
            "minimum_precision",
        ),
        (
            {"recall": 0.89},
            "minimum_recall",
        ),
        (
            {"f1_score": 0.84},
            "minimum_f1_score",
        ),
        (
            {"exact_match_rate": 0.69},
            "minimum_exact_match_rate",
        ),
        (
            {"false_negatives": 1},
            "maximum_residual_pii",
        ),
        (
            {"total_cases": 0},
            "non_empty_evaluation",
        ),
    ],
)
def test_failed_metric_blocks_gate(
    changed_metrics,
    expected_failed_check,
):
    metrics = replace(
        make_metrics(),
        **changed_metrics,
    )

    result = assess_evaluation_gate(
        metrics,
        make_thresholds(),
    )

    assert result.passed is False
    assert expected_failed_check in result.failed_checks


@pytest.mark.parametrize(
    ("field_name", "invalid_value"),
    [
        ("minimum_precision", -0.01),
        ("minimum_precision", 1.01),
        ("minimum_recall", -0.01),
        ("minimum_f1_score", 1.01),
        ("minimum_exact_match_rate", 1.01),
    ],
)
def test_invalid_rate_threshold_is_rejected(
    field_name,
    invalid_value,
):
    values = {
        "minimum_precision": 0.80,
        "minimum_recall": 0.90,
        "minimum_f1_score": 0.85,
        "minimum_exact_match_rate": 0.70,
        "maximum_residual_pii": 0,
    }
    values[field_name] = invalid_value

    with pytest.raises(
        ValueError,
        match="Rate thresholds must be between 0 and 1",
    ):
        EvaluationThresholds(**values)


def test_negative_residual_threshold_is_rejected():
    with pytest.raises(
        ValueError,
        match="Maximum residual PII",
    ):
        EvaluationThresholds(
            minimum_precision=0.80,
            minimum_recall=0.90,
            minimum_f1_score=0.85,
            minimum_exact_match_rate=0.70,
            maximum_residual_pii=-1,
        )


def test_gate_summary_contains_aggregate_evidence_only():
    metrics = make_metrics()
    thresholds = make_thresholds()
    result = assess_evaluation_gate(metrics, thresholds)

    summary = build_gate_summary(
        result,
        metrics,
        thresholds,
    )
    serialized = json.dumps(summary)

    assert summary["status"] == "PASSED"
    assert summary["metrics"]["total_cases"] == 20
    assert summary["metrics"]["residual_pii_count"] == 0
    assert "synthetic_text" not in serialized
    assert "detected_values" not in serialized
    assert "original_text" not in serialized
