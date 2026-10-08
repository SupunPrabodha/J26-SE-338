"""Aggregate-only comparison of C2 anonymization strategies.

Metrics compare placeholder counts, not entity spans.
They must not be treated as proof that all PII was removed.
"""

import re
from collections import Counter
from collections.abc import Callable, Iterable
from dataclasses import dataclass
from typing import Protocol

from preprocessing.anonymization import anonymize_text
from preprocessing.hybrid_anonymization import anonymize_with_hybrid
from preprocessing.presidio_anonymization import anonymize_with_presidio

PLACEHOLDER_PATTERN = re.compile(r"\[(?:EMAIL|PHONE|STUDENT_ID|PERSON|LOCATION)\]")


class AnonymizationOutput(Protocol):
    @property
    def anonymized_text(self) -> str: ...

    @property
    def requires_review(self) -> bool: ...


@dataclass(frozen=True)
class ComparisonCase:
    case_id: str
    synthetic_text: str
    expected_placeholders: tuple[str, ...]


@dataclass(frozen=True)
class StrategyMetrics:
    strategy: str
    total_cases: int
    true_positives: int
    false_positives: int
    false_negatives: int
    exact_match_count: int
    precision: float
    recall: float
    f1_score: float
    exact_match_rate: float
    review_required: int


def _count_placeholders(text: str) -> Counter[str]:
    """Count every occurrence, including repeated placeholders."""
    return Counter(PLACEHOLDER_PATTERN.findall(text))


def _ratio(numerator: int, denominator: int) -> float:
    """Use 1.0 for an undefined ratio in this count-based comparison."""
    return 1.0 if denominator == 0 else numerator / denominator


def _evaluate_strategy(
    strategy: str,
    cases: Iterable[ComparisonCase],
    anonymizer: Callable[[str], AnonymizationOutput],
) -> StrategyMetrics:
    """Compare expected and observed placeholder counts."""
    case_list = list(cases)

    true_positives = 0
    false_positives = 0
    false_negatives = 0
    exact_match_count = 0
    review_required = 0

    for case in case_list:
        result = anonymizer(case.synthetic_text)

        predicted = _count_placeholders(result.anonymized_text)
        expected = Counter(case.expected_placeholders)

        correct = expected & predicted
        missed = expected - predicted
        incorrect = predicted - expected

        true_positives += sum(correct.values())
        false_negatives += sum(missed.values())
        false_positives += sum(incorrect.values())

        if predicted == expected:
            exact_match_count += 1

        if result.requires_review:
            review_required += 1

    precision = _ratio(
        true_positives,
        true_positives + false_positives,
    )
    recall = _ratio(
        true_positives,
        true_positives + false_negatives,
    )

    f1_score = 2 * precision * recall / (precision + recall) if precision + recall > 0 else 0.0

    return StrategyMetrics(
        strategy=strategy,
        total_cases=len(case_list),
        true_positives=true_positives,
        false_positives=false_positives,
        false_negatives=false_negatives,
        exact_match_count=exact_match_count,
        precision=round(precision, 4),
        recall=round(recall, 4),
        f1_score=round(f1_score, 4),
        exact_match_rate=round(
            exact_match_count / len(case_list) if case_list else 0.0,
            4,
        ),
        review_required=review_required,
    )


def compare_anonymizers(
    cases: Iterable[ComparisonCase],
) -> tuple[StrategyMetrics, ...]:
    """Evaluate all strategies using the same synthetic cases."""
    case_list = tuple(cases)

    if not case_list:
        raise ValueError("Comparison requires at least one synthetic case.")

    strategies: tuple[tuple[str, Callable[[str], AnonymizationOutput]], ...] = (
        ("regex", anonymize_text),
        ("presidio", anonymize_with_presidio),
        ("hybrid", anonymize_with_hybrid),
    )

    return tuple(_evaluate_strategy(name, case_list, anonymizer) for name, anonymizer in strategies)


def build_comparison_summary(
    metrics: Iterable[StrategyMetrics],
) -> dict[str, object]:
    """Return aggregate evidence without fixture text or detected values."""
    return {
        "evaluation_scope": "disposable_synthetic_fixtures",
        "metric_basis": "placeholder_type_and_count",
        "exact_match_definition": (
            "Expected and predicted placeholder counts match; "
            "this is not full-text or entity-span matching."
        ),
        "zero_denominator_policy": (
            "Undefined precision or recall is represented as 1.0; "
            "interpret alongside TP, FP and FN counts."
        ),
        "strategies": [
            {
                "strategy": item.strategy,
                "total_cases": item.total_cases,
                "true_positives": item.true_positives,
                "false_positives": item.false_positives,
                "false_negatives": item.false_negatives,
                "exact_match_count": item.exact_match_count,
                "precision": item.precision,
                "recall": item.recall,
                "f1_score": item.f1_score,
                "exact_match_rate": item.exact_match_rate,
                "review_required": item.review_required,
            }
            for item in metrics
        ],
        "limitations": (
            "Count matching cannot verify which text spans were masked "
            "or establish that no residual PII remains."
        ),
        "privacy_note": ("Aggregate metrics only; fixture text and detected values are excluded."),
    }
