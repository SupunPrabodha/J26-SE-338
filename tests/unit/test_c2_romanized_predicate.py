"""Actual inference plus conservative role abstention; no gold-driven runtime."""

from types import SimpleNamespace

import pytest
from preprocessing.contextual_detection import ContextSpan
from preprocessing.pipeline import PipelineInput, run_preprocessing_pipeline
from preprocessing.romanized_predicate import select_without_predicates
from presidio_analyzer import RecognizerResult


@pytest.mark.parametrize(
    "text,expected",
    [
        ("Mata exams gana dukai.", "Mata exams gana dukai."),
        (
            "Mage nama Nimal Perera. Mata exams gana dukai.",
            "Mage nama [PERSON]. Mata exams gana dukai.",
        ),
        ("Mata met Gana Dukai.", "Mata met [PERSON]."),
        ("mata met gana dukai.", "mata met [PERSON]."),
        ("Mata Jane Miller gana dukai.", "Mata [PERSON] gana dukai."),
    ],
)
def test_real_presidio_inference(text, expected):
    result = run_preprocessing_pipeline([PipelineInput("synthetic", text)], strategy="presidio")
    assert result.records[0].anonymized_text == expected


@pytest.mark.parametrize("strategy", ["regex", "presidio", "hybrid"])
def test_strategies_and_contacts_preserved(strategy):
    text = "Mage nama Nimal Perera. Mata exams gana dukai. sample@example.com; 0771234567; IT12345678! 🙂"
    result = run_preprocessing_pipeline([PipelineInput("synthetic", text)], strategy=strategy)
    assert (
        result.records[0].anonymized_text
        == "Mage nama [PERSON]. Mata exams gana dukai. [EMAIL]; [PHONE]; [STUDENT_ID]! 🙂"
    )


def test_no_engine_no_filter_and_explicit_name_overlap():
    text = "Mata exams gana dukai."
    candidate = RecognizerResult(
        "PERSON", 11, 21, 0.85, recognition_metadata={"recognizer_name": "SpacyRecognizer"}
    )
    assert select_without_predicates(text, SimpleNamespace(), [candidate], ()) == [candidate]
    from preprocessing.presidio_anonymization import _get_engines

    analyzer, _ = _get_engines()
    assert select_without_predicates(
        text, analyzer, [candidate], (ContextSpan(11, 21, "PERSON", 0),)
    ) == [candidate]
    unknown = SimpleNamespace(entity_type="PERSON", start=11, end=21, score=0.85)
    assert select_without_predicates(text, analyzer, [unknown], ()) == [unknown]


@pytest.mark.parametrize(
    "label,recognizer,start,end",
    [
        ("PERSON", "CustomRecognizer", 11, 21),
        ("LOCATION", "SpacyRecognizer", 11, 21),
        ("PERSON", "SpacyRecognizer", 5, 21),
        ("PERSON", "SpacyRecognizer", 5, 10),
    ],
)
def test_other_sources_types_broader_spans_and_neighbours_remain(label, recognizer, start, end):
    from preprocessing.presidio_anonymization import _get_engines

    analyzer, _ = _get_engines()
    candidate = RecognizerResult(
        label, start, end, 0.85, recognition_metadata={"recognizer_name": recognizer}
    )
    assert select_without_predicates("Mata exams gana dukai.", analyzer, [candidate], ()) == [
        candidate
    ]
