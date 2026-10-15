"""Actual casing probes and unchanged-source/location-negative regressions."""

import pytest
from preprocessing.location_case import detect_locations
from preprocessing.pipeline import PipelineInput, run_preprocessing_pipeline
from preprocessing.span_evaluation import evaluate_detection


@pytest.mark.parametrize("strategy", ["regex", "presidio", "hybrid"])
@pytest.mark.parametrize("value", ["malabe", "Malabe", "MALABE"])
def test_reported_location_case_only_difference(strategy, value):
    text = "It is in " + value
    result = run_preprocessing_pipeline([PipelineInput("case", text)], strategy=strategy)
    assert result.records[0].anonymized_text == "It is in [LOCATION]"
    assert [(s.start, s.end, s.entity_type) for s in evaluate_detection(text, strategy)] == [
        (9, 15, "LOCATION")
    ]


@pytest.mark.parametrize("place", ["Jaffna", "Nuwara Eliya", "Ampara", "New York"])
@pytest.mark.parametrize("style", ["lower", "title", "upper"])
def test_diverse_working_location_case_families(place, style):
    value = getattr(place, style)()
    text = "It is in " + value
    result = run_preprocessing_pipeline([PipelineInput("case", text)], strategy="presidio")
    assert result.records[0].anonymized_text == "It is in [LOCATION]"
    spans = evaluate_detection(text, "presidio")
    assert [(s.start, s.end, s.entity_type) for s in spans] == [(9, len(text), "LOCATION")]


@pytest.mark.parametrize(
    "value",
    [
        "trouble",
        "progress",
        "pain",
        "peace",
        "love",
        "danger",
        "control",
        "doubt",
        "a mess",
        "good shape",
        "my mind",
        "deep water",
        "school",
        "hospital",
        "red",
        "blue",
        "green",
        "fine",
        "ready",
    ],
)
def test_ordinary_locative_phrases_are_not_new_location_predictions(value):
    text = "It is in " + value
    assert detect_locations(text) == ()
    result = run_preprocessing_pipeline([PipelineInput("case", text)], strategy="presidio")
    assert result.records[0].anonymized_text == text


def test_original_unicode_context_and_spacing_are_preserved():
    text = "🙂 It\tis  in\tMALABE! මට බයයි."
    result = run_preprocessing_pipeline([PipelineInput("case", text)], strategy="presidio")
    assert result.records[0].anonymized_text == "🙂 It\tis  in\t[LOCATION]! මට බයයි."


@pytest.mark.parametrize(
    "text",
    [
        "It is in මාලබේ",
        "It is in malabe123",
        "It is in [LOCATION]",
        "It is in a very long ordinary description",
    ],
)
def test_no_partial_unicode_placeholder_or_unbounded_probe(text):
    assert detect_locations(text) == ()
