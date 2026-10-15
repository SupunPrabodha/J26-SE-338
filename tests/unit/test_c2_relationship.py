"""Reported cross-entity names, pronoun preservation and grammatical negatives."""

import pytest
from preprocessing.pipeline import PipelineInput, run_preprocessing_pipeline
from preprocessing.span_evaluation import evaluate_detection


@pytest.mark.parametrize("strategy", ["regex", "presidio", "hybrid"])
@pytest.mark.parametrize("name", ["Neluni", "neluni", "NELUNI"])
@pytest.mark.xfail(
    strict=True,
    reason="Relationship masking candidate rejected: English NER misses/mislabels names and masks pronouns; review only",
)
def test_reported_relationship_preserves_pronouns_and_types(strategy, name):
    text = "ape grp leader supun. eyge girlfriend " + name + " . ey hrim npurui"
    result = run_preprocessing_pipeline([PipelineInput("fixture", text)], strategy=strategy)
    assert (
        result.records[0].anonymized_text
        == "ape grp leader [PERSON]. eyge girlfriend [PERSON] . ey hrim npurui"
    )
    assert [(s.start, s.end, s.entity_type) for s in evaluate_detection(text, strategy)] == [
        (15, 20, "PERSON"),
        (38, 38 + len(name), "PERSON"),
    ]


@pytest.mark.parametrize("strategy", ["regex", "presidio", "hybrid"])
@pytest.mark.parametrize("name", ["Neluni", "neluni", "NELUNI"])
def test_reported_unresolved_relationship_is_review_blocked(strategy, name):
    text = "ape grp leader supun. eyge girlfriend " + name + " . ey hrim npurui"
    result = run_preprocessing_pipeline([PipelineInput("fixture", text)], strategy=strategy)
    assert result.records[0].requires_privacy_review
    assert result.records[0].quality_status == "REVIEW"
    assert result.privacy_summary["status"] == "FAILED"
    assert not result.release_ready


@pytest.mark.parametrize(
    "text",
    ["eyge girlfriend is helpful.", "My boyfriend is kind.", "her girlfriend feels worried."],
)
def test_no_contextual_mask_on_ordinary_relationship_descriptions(text):
    from preprocessing.person_context import parse_contexts

    assert parse_contexts(text)[0] == ()


def test_explicit_name_field_preserves_pronoun_and_literal_name():
    for text, expected in [
        ("eyge nama aruni", "eyge nama [PERSON]"),
        ("My name is Eyge.", "My name is [PERSON]."),
    ]:
        result = run_preprocessing_pipeline([PipelineInput("fixture", text)], strategy="presidio")
        assert result.records[0].anonymized_text == expected
