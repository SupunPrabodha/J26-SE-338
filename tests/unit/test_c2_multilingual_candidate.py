"""Active adapter mechanics; real inference evidence is separate."""

import math

import pytest
from preprocessing.multilingual_candidate import MultilingualCandidate, structured_spans
from preprocessing.span_evaluation import EntitySpan


class Predictor:
    def __init__(self, predictions):
        self.predictions, self.calls = predictions, []

    def predict_entities(self, text, labels, **options):
        self.calls.append((labels, options))
        return self.predictions


def test_english_false_mask_is_not_union_added():
    model = Predictor([])
    candidate = MultilingualCandidate(model, structured=lambda text: ())
    text = "Mata exams gana dukai."
    unchanged = candidate.anonymize(text).anonymized_text == text
    assert unchanged
    assert model.calls == [(["person", "location"], {"threshold": 0.5, "flat_ner": True})]


def test_original_unicode_offsets_preserve_marks_joiners_punctuation_and_emoji():
    text = "🙂 ශ්‍රියා කතා කළා! 🌿"
    name = "ශ්‍රියා"
    start = text.index(name)
    model = Predictor(
        [{"start": start, "end": start + len(name), "label": "person", "score": 0.9, "text": name}]
    )
    candidate = MultilingualCandidate(model, structured=lambda text: ())
    result = candidate.anonymize(text)
    assert result.spans == (EntitySpan(start, start + len(name), "PERSON"),)
    preserved = result.anonymized_text == text[:start] + "[PERSON]" + text[start + len(name) :]
    assert preserved


def test_unsafe_raw_unicode_span_is_scored_but_never_rendered():
    text = "X\u0301 practice"
    model = Predictor([{"start": 0, "end": 1, "label": "person", "score": 0.9, "text": "X"}])
    candidate = MultilingualCandidate(model, structured=lambda text: ())
    assert candidate.detect(text) == (EntitySpan(0, 1, "PERSON"),)
    with pytest.raises(RuntimeError, match="split a Unicode mark"):
        candidate.anonymize(text)


def test_structured_recognizers_remain_actual_and_take_precedence():
    text = "fixture@example.com 0771234567 IT12345678"
    spans = structured_spans(text)
    assert {span.entity_type for span in spans} == {"EMAIL", "PHONE", "STUDENT_ID"}
    model = Predictor(
        [{"start": 0, "end": len(text), "label": "person", "score": 1.0, "text": text}]
    )
    assert MultilingualCandidate(model).detect(text) == spans


def test_builtin_international_phone_recognizer_is_preserved():
    text = "Use +1 202-555-0143 for this fictional example."
    spans = structured_spans(text)
    assert any(span.entity_type == "PHONE" for span in spans)


def test_existing_placeholders_are_protected():
    text = "[PERSON] practice"
    model = Predictor([{"start": 0, "end": 8, "label": "person", "score": 0.9, "text": "[PERSON]"}])
    assert not MultilingualCandidate(model, structured=lambda text: ()).detect(text)


@pytest.mark.parametrize(
    "changes",
    [
        {"label": "emotion"},
        {"start": -1},
        {"end": 100},
        {"start": True},
        {"score": math.nan},
        {"score": 1.1},
        {"text": "mismatch"},
    ],
)
def test_invalid_or_non_pii_metadata_rejected(changes):
    item = {"start": 0, "end": 3, "label": "person", "score": 0.9, "text": "Ada", **changes}
    with pytest.raises(RuntimeError, match="invalid original-text entity metadata"):
        MultilingualCandidate(Predictor([item]), structured=lambda text: ()).detect("Ada practice")


def test_fixed_threshold_and_no_silent_fallback():
    model = Predictor([{"start": 0, "end": 3, "label": "person", "score": 0.49, "text": "Ada"}])
    assert not MultilingualCandidate(model, structured=lambda text: ()).detect("Ada practice")

    class Broken:
        def predict_entities(self, *args, **kwargs):
            raise RuntimeError("synthetic-model-failure")

    with pytest.raises(RuntimeError, match="synthetic-model-failure"):
        MultilingualCandidate(Broken(), structured=lambda text: ()).detect("synthetic")


def test_missing_or_unpinned_assets_cannot_load(tmp_path):
    with pytest.raises(RuntimeError, match="incomplete"):
        MultilingualCandidate.from_local(tmp_path)
    (tmp_path / "model.safetensors").write_bytes(b"disposable-invalid-weights")
    (tmp_path / "gliner_config.json").write_text("{}")
    with pytest.raises(RuntimeError, match="integrity"):
        MultilingualCandidate.from_local(tmp_path)
