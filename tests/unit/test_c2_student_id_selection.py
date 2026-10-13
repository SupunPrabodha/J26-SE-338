"""Narrow PERSON/valid-ID precedence; preserve original masking coverage."""

from itertools import permutations
from types import SimpleNamespace

import pytest
from preprocessing.presidio_anonymization import anonymize_with_presidio
from preprocessing.span_evaluation import evaluate_detection, select_presidio
from presidio_analyzer import RecognizerResult


def result(label, start, end, score=0.85):
    return RecognizerResult(label, start, end, score)


def selected(monkeypatch, text, candidates):
    monkeypatch.setattr(
        "preprocessing.presidio_anonymization._get_engines",
        lambda: (SimpleNamespace(analyze=lambda **_: candidates), None),
    )
    return select_presidio(text)


def signature(rows):
    return [(r.start, r.end, r.entity_type) for r in rows]


@pytest.mark.parametrize("scores", [(0.85, 0.85), (0.99, 0.85), (0.5, 0.85)])
def test_exact_valid_id_prefers_specific_type_independent_of_order(monkeypatch, scores):
    candidates = [result("PERSON", 0, 10, scores[0]), result("STUDENT_ID", 0, 10, scores[1])]
    for order in permutations(candidates):
        assert signature(selected(monkeypatch, "IT12345678", list(order))) == [
            (0, 10, "STUDENT_ID")
        ]


@pytest.mark.parametrize(
    "text,end",
    [
        ("IT1234567", 9),
        ("IT123456789", 11),
        ("IT12345678X", 10),
        ("_IT12345678", 11),
        ("IT12X45678", 10),
    ],
)
def test_invalid_or_near_match_does_not_gain_id_precedence(monkeypatch, text, end):
    assert signature(
        selected(monkeypatch, text, [result("PERSON", 0, end), result("STUDENT_ID", 0, end)])
    ) == [(0, end, "PERSON")]


def test_broader_person_keeps_prefix_suffix_and_neighbour(monkeypatch):
    text = "Jane IT12345678 Miller Alex"
    candidates = [result("PERSON", 0, 21), result("STUDENT_ID", 5, 15), result("PERSON", 22, 26)]
    for order in permutations(candidates):
        rows = selected(monkeypatch, text, list(order))
        assert signature(rows) == [
            (0, 5, "PERSON"),
            (5, 15, "STUDENT_ID"),
            (15, 21, "PERSON"),
            (22, 26, "PERSON"),
        ]
        assert {i for r in rows for i in range(r.start, r.end)} == set(range(21)) | set(
            range(22, 26)
        )
    assert candidates[0].end == 21  # Analyzer results never mutated.


def test_partial_overlap_preserves_and_completes_id_coverage(monkeypatch):
    rows = selected(
        monkeypatch, "Jane IT12345678", [result("PERSON", 0, 10), result("STUDENT_ID", 5, 15)]
    )
    assert signature(rows) == [(0, 5, "PERSON"), (5, 15, "STUDENT_ID")]
    assert {i for r in rows for i in range(r.start, r.end)} >= set(range(10))


def test_placeholder_and_other_entity_conflicts_are_unchanged(monkeypatch):
    text = "[PERSON] IT12345678"
    rows = selected(
        monkeypatch,
        text,
        [result("PERSON", 0, 18), result("PERSON", 9, 19), result("STUDENT_ID", 9, 19)],
    )
    assert signature(rows) == [(9, 19, "STUDENT_ID")]
    assert signature(
        selected(
            monkeypatch,
            "IT12345678",
            [
                result("EMAIL_ADDRESS", 0, 10, 1),
                result("PERSON", 0, 10),
                result("STUDENT_ID", 0, 10),
            ],
        )
    ) == [(0, 10, "EMAIL_ADDRESS")]


@pytest.mark.parametrize("strategy", ["regex", "presidio", "hybrid"])
def test_same_runtime_evaluation_and_transformation_selection(monkeypatch, strategy):
    text = "IT12345678"
    selected(monkeypatch, text, [result("PERSON", 0, 10), result("STUDENT_ID", 0, 10)])
    spans = evaluate_detection(text, strategy)
    assert [(r.start, r.end, r.entity_type) for r in spans] == [(0, 10, "STUDENT_ID")]
    if strategy == "presidio":
        output = anonymize_with_presidio(text)
        assert output.anonymized_text == "[STUDENT_ID]"
        assert output.entity_counts == (("STUDENT_ID", 1),)
        assert output.transformations == ("presidio:student-id",)
