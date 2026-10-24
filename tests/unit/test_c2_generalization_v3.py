"""Active context-merge and metric regressions, not rejected model experiments."""

from preprocessing.contextual_detection import ContextSpan
from preprocessing.generalization_v3 import combine, summarize
from preprocessing.span_evaluation import EntitySpan


def test_context_typing_preserves_adjacent_entities_and_structure():
    text = "intro abcd email@example.com next"
    predicted = (
        EntitySpan(0, 10, "LOCATION"),
        EntitySpan(11, 28, "EMAIL"),
        EntitySpan(29, 33, "PERSON"),
    )
    result = combine(text, predicted, (ContextSpan(6, 10, "PERSON", 0),))
    assert result == (EntitySpan(6, 10, "PERSON"), *predicted[1:])
    assert combine(text, predicted, (ContextSpan(6, 28, "PERSON", 0),)) == predicted


def test_placeholder_protection_and_review_never_counts_as_detection():
    assert not combine("[PERSON]", (), (ContextSpan(0, 8, "PERSON", 0),))
    result = summarize(
        [
            dict(
                text="abcd",
                language="romanized",
                gold=(EntitySpan(0, 4, "PERSON"),),
                predicted=(),
                review=True,
            )
        ]
    )
    assert result["overall"]["tp"] == 0
    assert result["overall"]["fn"] == 1
    assert result["overall"]["missed_gold_pii"] == 1


def test_wrong_entity_type_not_success_despite_complete_masking():
    result = summarize(
        [
            dict(
                text="abcd",
                language="mixed",
                gold=(EntitySpan(0, 4, "PERSON"),),
                predicted=(EntitySpan(0, 4, "LOCATION"),),
            )
        ]
    )
    assert result["overall"]["tp"] == 0
    assert result["overall"]["fn"] == result["overall"]["fp"] == 1
    assert result["overall"]["missed_gold_pii"] == 0
    assert result["incorrect_type_exact_boundary"] == 1
