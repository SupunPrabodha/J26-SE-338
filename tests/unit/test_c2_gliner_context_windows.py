"""Mechanics/protected offsets, not model accuracy or independent validation."""

import json
from pathlib import Path
from types import SimpleNamespace

import pytest
from preprocessing.gliner_context_windows import (
    augment,
    augment_locations,
    sentence_windows,
    window_predictions,
)
from preprocessing.multilingual_calibration import splits_boundary
from preprocessing.span_evaluation import EntitySpan


def test_windows_preserve_titles_email_punctuation_and_original_slices():
    text = "Dr. Liora helped. මට බයයි! Mail a@example.com. 🙂"
    slices = [text[start:end] for start, end in sentence_windows(text)]
    assert slices == ["Dr. Liora helped.", "මට බයයි!", "Mail a@example.com.", "🙂"]
    assert all(not splits_boundary(text, edge) for pair in sentence_windows(text) for edge in pair)


def test_local_offsets_map_to_original_unicode_codepoints():
    text = "🙂. Name: Liora."
    model = SimpleNamespace(
        predict_entities=lambda value, labels, **kwargs: (
            [{"start": 6, "end": 11, "text": "Liora", "label": "person name", "score": 0.8}]
            if value == "Name: Liora."
            else []
        )
    )
    assert window_predictions(text, model) == ((0.8, EntitySpan(9, 14, "PERSON")),)


def test_augmentation_retains_baseline_types_structured_entities_and_placeholders():
    text = "Name email@example.com [PERSON] Tail"
    baseline = (EntitySpan(5, 22, "EMAIL"), EntitySpan(31, 35, "PERSON"))
    predictions = (
        (0.99, EntitySpan(5, 22, "PERSON")),
        (0.99, EntitySpan(24, 29, "PERSON")),
        (0.95, EntitySpan(31, 35, "LOCATION")),
        (0.8, EntitySpan(0, 4, "PERSON")),
    )
    assert augment(text, baseline, predictions) == (EntitySpan(0, 4, "PERSON"), *baseline)


def test_unsafe_model_boundary_is_rejected_not_snapped():
    model = SimpleNamespace(
        predict_entities=lambda *args, **kwargs: [
            {"start": 0, "end": 1, "text": "ක", "label": "person name", "score": 0.9}
        ]
    )
    with pytest.raises(RuntimeError, match="Unsafe"):
        window_predictions("කි", model)


def test_location_augmentation_does_not_add_person_predictions_or_retype_baseline():
    baseline = (EntitySpan(0, 4, "PERSON"),)
    assert augment_locations(
        "Name Place Other",
        baseline,
        (
            (0.99, EntitySpan(0, 4, "LOCATION")),
            (0.8, EntitySpan(5, 10, "LOCATION")),
            (0.99, EntitySpan(11, 16, "PERSON")),
        ),
    ) == (*baseline, EntitySpan(5, 10, "LOCATION"))


@pytest.mark.parametrize(
    "filename,count,negative_count",
    [("c2-paragraph-context-v5.json", 34, 16), ("c2-paragraph-context-v5-evaluation.json", 16, 8)],
)
def test_frozen_references_have_valid_disjoint_unicode_spans(filename, count, negative_count):
    path = Path("tests/fixtures/synthetic") / filename
    cases = json.loads(path.read_text(encoding="utf-8"))
    assert len(cases) == count
    assert len({case["text"] for case in cases}) == count
    assert sum(case["negative"] for case in cases) == negative_count
    for case in cases:
        previous = 0
        for span in sorted(case["gold"], key=lambda item: item["start"]):
            assert previous <= span["start"] < span["end"] <= len(case["text"])
            assert not any(splits_boundary(case["text"], span[key]) for key in ("start", "end"))
            previous = span["end"]
