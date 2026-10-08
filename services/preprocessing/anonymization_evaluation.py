"""Privacy-safe evaluation for anonymization on synthetic fixtures."""

import re
from collections import Counter
from collections.abc import Iterable
from dataclasses import dataclass

from preprocessing.anonymization import anonymize_text

PLACEHOLDER_PATTERN = re.compile(r"\[(EMAIL|PHONE|STUDENT_ID|PERSON|LOCATION)\]")


@dataclass(frozen=True)
class EvaluationCase:
    case_id: str
    synthetic_text: str
    expected_anonymized_text: str


@dataclass(frozen=True)
class EvaluationMetrics:
    total_cases: int
    true_positives: int
    false_positives: int
    false_negatives: int
    exact_matches: int
    review_required: int
    precision: float
    recall: float
    f1_score: float
    exact_match_rate: float
    error_counts: dict[str, int]


def _placeholder_counts(text: str) -> Counter[str]:
    return Counter(PLACEHOLDER_PATTERN.findall(text))


def _safe_ratio(numerator: int, denominator: int) -> float:
    if denominator == 0:
        return 1.0
    return numerator / denominator


def evaluate_anonymizer(
    cases: Iterable[EvaluationCase],
) -> EvaluationMetrics:
    """Evaluate synthetic cases and return aggregate metrics only."""
    case_list = list(cases)

    true_positives = 0
    false_positives = 0
    false_negatives = 0
    exact_matches = 0
    review_required = 0
    error_counts: Counter[str] = Counter()

    for case in case_list:
        result = anonymize_text(case.synthetic_text)

        expected = _placeholder_counts(case.expected_anonymized_text)
        predicted = _placeholder_counts(result.anonymized_text)

        correct = expected & predicted
        missed = expected - predicted
        incorrect = predicted - expected

        true_positives += sum(correct.values())
        false_negatives += sum(missed.values())
        false_positives += sum(incorrect.values())

        if result.anonymized_text == case.expected_anonymized_text:
            exact_matches += 1
        else:
            error_counts["output_mismatch"] += 1

        if missed:
            error_counts["missed_entity"] += 1

        if incorrect:
            error_counts["false_detection"] += 1

        if result.requires_review:
            review_required += 1
            error_counts["privacy_review_required"] += 1

    precision = _safe_ratio(
        true_positives,
        true_positives + false_positives,
    )
    recall = _safe_ratio(
        true_positives,
        true_positives + false_negatives,
    )
    f1_score = _safe_ratio(
        2 * precision * recall,
        precision + recall,
    )
    exact_match_rate = _safe_ratio(
        exact_matches,
        len(case_list),
    )

    return EvaluationMetrics(
        total_cases=len(case_list),
        true_positives=true_positives,
        false_positives=false_positives,
        false_negatives=false_negatives,
        exact_matches=exact_matches,
        review_required=review_required,
        precision=round(precision, 4),
        recall=round(recall, 4),
        f1_score=round(f1_score, 4),
        exact_match_rate=round(exact_match_rate, 4),
        error_counts=dict(sorted(error_counts.items())),
    )


def build_evaluation_summary(
    metrics: EvaluationMetrics,
) -> dict[str, object]:
    """Create aggregate evidence without synthetic or detected text."""
    return {
        "evaluation_scope": "disposable_synthetic_fixtures",
        "total_cases": metrics.total_cases,
        "true_positives": metrics.true_positives,
        "false_positives": metrics.false_positives,
        "false_negatives": metrics.false_negatives,
        "residual_pii_count": metrics.false_negatives,
        "exact_matches": metrics.exact_matches,
        "review_required": metrics.review_required,
        "precision": metrics.precision,
        "recall": metrics.recall,
        "f1_score": metrics.f1_score,
        "exact_match_rate": metrics.exact_match_rate,
        "error_counts": metrics.error_counts,
        "privacy_note": ("Aggregate metrics only; fixture text and detected values are excluded."),
    }
