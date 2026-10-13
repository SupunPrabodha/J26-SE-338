"""Actual runtime regressions, bounded contexts and Unicode/structured integrity."""

import unicodedata

import pytest
from preprocessing.contextual_detection import detect_contextual
from preprocessing.pipeline import PipelineInput, run_preprocessing_pipeline
from preprocessing.span_evaluation import evaluate_detection, render


def splits_boundary(text, offset):
    """Test original code-point boundaries without experimental-module dependencies."""
    return (
        offset < len(text)
        and (unicodedata.category(text[offset]).startswith("M") or text[offset] in "\u200c\u200d")
    ) or (offset > 0 and text[offset - 1] in "\u200c\u200d")


CASES = (
    ("mge nama neluni", "mge nama [PERSON]"),
    ("My name is Jane Miller.", "My name is [PERSON]."),
    ("මගේ නම නිමල් පෙරේරා.", "මගේ නම [PERSON]."),
    ("මම අද මහන්සියි.", "මම අද මහන්සියි."),
    ("මම කොළඹ ජීවත් වෙමි.", "මම [LOCATION] ජීවත් වෙමි."),
    ("My name is Elora Venn. I feel worried.", "My name is [PERSON]. I feel worried."),
    ("Mge nama adira savin. Mata exams gana dukai.", "Mge nama [PERSON]. Mata exams gana dukai."),
    ("මගෙ නම ශ්‍රියා රුවිනි. මට බයයි. 🙂", "මගෙ නම [PERSON]. මට බයයි. 🙂"),
    ("I live in New York. I feel tired.", "I live in [LOCATION]. I feel tired."),
    ("My address is 17 Cedar Road, London.", "My address is [LOCATION]."),
    ("Mage lipinaya 27 Mal Mawatha, Colombo.", "Mage lipinaya [LOCATION]."),
    ("ලිපිනය අංක 42, මල් මාවත, කොළඹ.", "ලිපිනය [LOCATION]."),
)


@pytest.mark.parametrize("text,expected", CASES)
def test_regex_explicit_contexts(text, expected):
    result = run_preprocessing_pipeline([PipelineInput("synthetic", text)], strategy="regex")
    assert result.records[0].anonymized_text == expected


@pytest.mark.parametrize("text,expected", CASES[:6])
def test_presidio_reported_contexts(text, expected):
    result = run_preprocessing_pipeline([PipelineInput("synthetic", text)], strategy="presidio")
    assert result.records[0].anonymized_text == expected


@pytest.mark.parametrize(
    "text",
    [
        "මම අද මහන්සියි.",
        "මම බයයි.",
        "මම නිදාගන්නවා.",
        "I am worried.",
        "My name is [PERSON].",
        "mge nama IT12345678",
        "my name is fixture@example.com",
        "My address is tired about exams.",
    ],
)
def test_context_does_not_treat_ordinary_self_statements_contacts_or_placeholders_as_names(text):
    assert not detect_contextual(text)


@pytest.mark.parametrize("strategy", ["regex", "presidio", "hybrid"])
def test_structured_neighbours_unicode_and_trace(strategy):
    text = "මගේ නම ශ්‍රියා රුවිනි. IT12345678; fixture@example.com, 0771234567! 🙂"
    spans = evaluate_detection(text, strategy)
    assert {"PERSON", "STUDENT_ID", "EMAIL", "PHONE"}.issubset({s.entity_type for s in spans})
    assert not any(splits_boundary(text, b) for s in spans for b in (s.start, s.end))
    result = run_preprocessing_pipeline([PipelineInput("synthetic", text)], strategy=strategy)
    assert result.records[0].anonymized_text == render(text, spans)
    assert "🙂" in result.records[0].anonymized_text


def test_name_field_limit_does_not_guess_unbounded_phrase():
    assert not detect_contextual("My name is one two three four five six.")


@pytest.mark.parametrize(
    "text",
    [
        "I live in hope.",
        "I live in peace.",
        "මම සතුටින් ජීවත් වෙමි.",
        "මම බයෙන් ජීවත් වෙමි.",
        "අමම කොළඹ ජීවත් වෙමි.",
        "අලිපිනය 42 මල් මාවත.",
    ],
)
def test_location_context_does_not_mask_adverbs_or_embedded_prefixes(text):
    assert not detect_contextual(text)
    result = run_preprocessing_pipeline([PipelineInput("synthetic", text)], strategy="regex")
    assert result.records[0].anonymized_text == text
