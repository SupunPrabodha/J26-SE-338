"""Active name-label adapter mechanics; accuracy evidence is separate."""

import pytest
from preprocessing.name_label_candidate_v4 import NameLabelModel, candidate
from preprocessing.span_evaluation import EntitySpan


class Model:
    def __init__(self, predictions):
        self.predictions = predictions
        self.calls = []

    def predict_entities(self, text, labels, **kwargs):
        self.calls.append((text, labels, kwargs))
        return self.predictions


def test_name_prompt_mapping_preserves_text_offsets_scores_and_structured_priority():
    text = "Dr. ශ්‍රියා 🙂 IT12345678"
    start, end = 4, 4 + len("ශ්‍රියා")
    id_start = text.index("IT")
    model = Model(
        [
            dict(start=start, end=end, text=text[start:end], label="person name", score=0.94),
            dict(
                start=id_start, end=len(text), text=text[id_start:], label="person name", score=0.99
            ),
        ]
    )
    spans = candidate(
        model, structured=lambda _: (EntitySpan(id_start, len(text), "STUDENT_ID"),)
    ).detect(text)
    assert spans == (
        EntitySpan(start, end, "PERSON"),
        EntitySpan(id_start, len(text), "STUDENT_ID"),
    )
    assert model.calls == [
        (text, ["person name", "location name"], dict(threshold=0.7, flat_ner=True))
    ]
    assert model.predictions[0]["label"] == "person name"  # Original metadata not overwritten.


def test_no_score_inflation_or_placeholder_masking():
    text = "[PERSON] X"
    model = Model(
        [
            dict(start=0, end=8, text="[PERSON]", label="person name", score=0.99),
            dict(start=9, end=10, text="X", label="location name", score=0.69),
        ]
    )
    assert candidate(model, structured=lambda _: ()).detect(text) == ()


def test_unexpected_labels_fail_safely_and_bad_original_offsets_are_rejected():
    with pytest.raises(RuntimeError, match="Unexpected experimental model label"):
        NameLabelModel(Model([dict(label="emotion")])).predict_entities("X", ["person", "location"])
    model = Model([dict(start=0, end=2, text="wrong", label="person name", score=0.9)])
    with pytest.raises(RuntimeError, match="invalid original-text"):
        candidate(model, structured=lambda _: ()).detect("XX")
