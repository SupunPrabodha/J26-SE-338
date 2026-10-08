"""Configurable quality gate for aggregate anonymization metrics."""

from dataclasses import dataclass

from preprocessing.anonymization_evaluation import EvaluationMetrics


@dataclass(frozen=True)
class EvaluationThresholds:
    minimum_precision: float
    minimum_recall: float
    minimum_f1_score: float
    minimum_exact_match_rate: float
    maximum_residual_pii: int

    def __post_init__(self) -> None:
        rates = (
            self.minimum_precision,
            self.minimum_recall,
            self.minimum_f1_score,
            self.minimum_exact_match_rate,
        )

        if any(rate < 0 or rate > 1 for rate in rates):
            raise ValueError("Rate thresholds must be between 0 and 1.")

        if self.maximum_residual_pii < 0:
            raise ValueError("Maximum residual PII must be zero or greater.")


@dataclass(frozen=True)
class EvaluationGateResult:
    passed: bool
    checks: dict[str, bool]
    failed_checks: tuple[str, ...]


def assess_evaluation_gate(
    metrics: EvaluationMetrics,
    thresholds: EvaluationThresholds,
) -> EvaluationGateResult:
    """Compare aggregate metrics with explicitly supplied thresholds."""
    checks = {
        "minimum_precision": (metrics.precision >= thresholds.minimum_precision),
        "minimum_recall": (metrics.recall >= thresholds.minimum_recall),
        "minimum_f1_score": (metrics.f1_score >= thresholds.minimum_f1_score),
        "minimum_exact_match_rate": (
            metrics.exact_match_rate >= thresholds.minimum_exact_match_rate
        ),
        "maximum_residual_pii": (metrics.false_negatives <= thresholds.maximum_residual_pii),
        "non_empty_evaluation": metrics.total_cases > 0,
    }

    failed_checks = tuple(name for name, passed in checks.items() if not passed)

    return EvaluationGateResult(
        passed=not failed_checks,
        checks=checks,
        failed_checks=failed_checks,
    )


def build_gate_summary(
    result: EvaluationGateResult,
    metrics: EvaluationMetrics,
    thresholds: EvaluationThresholds,
) -> dict[str, object]:
    """Build aggregate gate evidence without evaluated text."""
    return {
        "pipeline_stage": "anonymization_evaluation_gate",
        "status": "PASSED" if result.passed else "FAILED",
        "checks": result.checks,
        "failed_checks": list(result.failed_checks),
        "metrics": {
            "total_cases": metrics.total_cases,
            "precision": metrics.precision,
            "recall": metrics.recall,
            "f1_score": metrics.f1_score,
            "exact_match_rate": metrics.exact_match_rate,
            "residual_pii_count": metrics.false_negatives,
        },
        "thresholds": {
            "minimum_precision": thresholds.minimum_precision,
            "minimum_recall": thresholds.minimum_recall,
            "minimum_f1_score": thresholds.minimum_f1_score,
            "minimum_exact_match_rate": (thresholds.minimum_exact_match_rate),
            "maximum_residual_pii": (thresholds.maximum_residual_pii),
        },
        "governance_note": (
            "Threshold values must be approved and documented before "
            "release; this module does not invent research results."
        ),
    }
