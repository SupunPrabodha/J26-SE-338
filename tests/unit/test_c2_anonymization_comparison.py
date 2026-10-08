import json
from types import SimpleNamespace

from preprocessing.anonymization_comparison import (
    ComparisonCase,
    _count_placeholders,
    _evaluate_strategy,
    build_comparison_summary,
    compare_anonymizers,
)


def test_counts_repeated_placeholders():
    assert _count_placeholders("[EMAIL] and [EMAIL]")["[EMAIL]"] == 2


def test_completely_wrong_detection_has_zero_f1():
    cases = (ComparisonCase("wrong", "synthetic", ("[EMAIL]",)),)

    def wrong_anonymizer(text):
        return SimpleNamespace(
            anonymized_text="[PHONE]",
            requires_review=False,
        )

    result = _evaluate_strategy("stub", cases, wrong_anonymizer)

    assert result.true_positives == 0
    assert result.false_positives == 1
    assert result.false_negatives == 1
    assert result.f1_score == 0.0


def test_comparison_runs_all_strategies_on_same_cases():
    cases = (
        ComparisonCase(
            "email",
            "Contact synthetic.student@example.com today.",
            ("[EMAIL]",),
        ),
        ComparisonCase(
            "phone",
            "Call 0771234567.",
            ("[PHONE]",),
        ),
    )

    results = compare_anonymizers(iter(cases))

    assert tuple(item.strategy for item in results) == (
        "regex",
        "presidio",
        "hybrid",
    )
    assert all(item.total_cases == 2 for item in results)
    assert all(0 <= item.f1_score <= 1 for item in results)


def test_summary_excludes_fixture_text_and_values():
    text = "Contact synthetic.student@example.com today."
    results = compare_anonymizers((ComparisonCase("private-fixture-id", text, ("[EMAIL]",)),))

    summary = build_comparison_summary(results)
    serialized = json.dumps(summary)

    assert len(summary["strategies"]) == 3
    assert text not in serialized
    assert "synthetic.student@example.com" not in serialized
    assert "private-fixture-id" not in serialized
