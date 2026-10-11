import json
from types import SimpleNamespace

import pytest
from preprocessing.anonymization_evaluation import EvaluationCase, evaluate_anonymizer
from preprocessing.pipeline import PipelineInput, run_preprocessing_pipeline
from preprocessing.span_evaluation import (
    EntitySpan,
    evaluate_detection,
    render,
    score_spans,
    select_presidio,
)
from preprocessing.synthetic_benchmark import build_benchmark


def test_completely_incorrect_count_detection(monkeypatch):
    monkeypatch.setattr(
        "preprocessing.anonymization_evaluation.anonymize_text",
        lambda _: SimpleNamespace(anonymized_text="[PHONE]", requires_review=False),
    )
    result = evaluate_anonymizer([EvaluationCase("wrong", "synthetic", "[EMAIL]")])
    assert result.precision == result.recall == result.f1_score == 0


def test_empty_count_evaluation_is_explicit():
    result = evaluate_anonymizer([])
    assert result.total_cases == 0
    assert result.precision == result.recall == result.f1_score == result.exact_match_rate == 1


def test_coverage_distinguishes_missed_partial_and_unnecessary():
    gold = (EntitySpan(0, 5, "PERSON"), EntitySpan(8, 10, "EMAIL"))
    result = score_spans(gold, (EntitySpan(0, 3, "PERSON"), EntitySpan(11, 13, "PERSON")))
    assert result["tp"] == 0
    assert result["f1"] == 0
    assert result["missed_gold_pii"] == 1
    assert result["partial_masking"] == 1
    assert result["unnecessary_masked_characters"] == 2
    assert result["unmasked_gold_characters"] == 4


def test_overlapping_gold_coverage_counts_characters_once():
    result = score_spans(
        (EntitySpan(0, 4, "PERSON"), EntitySpan(2, 6, "LOCATION")), (EntitySpan(0, 6, "PERSON"),)
    )
    assert result["gold_characters"] == 6
    assert result["partial_masking"] == result["missed_gold_pii"] == 0
    assert score_spans((), ())["f1"] == 1


@pytest.mark.parametrize("strategy", ["regex", "presidio", "hybrid"])
def test_repeated_email_and_existing_placeholder(strategy):
    text = "[EMAIL] fixture@example.com and fixture@example.com [PERSON]"
    spans = evaluate_detection(text, strategy)
    email_spans = [s for s in spans if s.entity_type == "EMAIL"]
    assert len(email_spans) == 2
    assert email_spans[0].start == text.index("fixture@example.com")
    assert email_spans[1].start == text.rindex("fixture@example.com")
    assert all(s.start >= len("[EMAIL] ") for s in spans)


def test_hybrid_maps_offsets_after_variable_length_masks():
    text = "Email long.synthetic.fixture@example.com. Alice studies in Colombo."
    spans = evaluate_detection(text, "hybrid")
    location = next(s for s in spans if s.entity_type == "LOCATION")
    assert (location.start, location.end) == (text.index("Colombo"), text.index("Colombo") + 7)
    from preprocessing.hybrid_anonymization import anonymize_with_hybrid

    assert render(text, spans) == anonymize_with_hybrid(text).anonymized_text


def test_overlap_resolution_and_placeholder_protection(monkeypatch):
    candidates = [
        SimpleNamespace(start=0, end=6, entity_type="PERSON", score=0.8),
        SimpleNamespace(start=1, end=4, entity_type="LOCATION", score=0.7),
        SimpleNamespace(start=7, end=15, entity_type="PERSON", score=0.99),
    ]
    monkeypatch.setattr(
        "preprocessing.presidio_anonymization._get_engines",
        lambda: (SimpleNamespace(analyze=lambda **_: candidates), None),
    )
    selected = select_presidio("Alice! [PERSON]")
    assert len(selected) == 1
    assert selected[0].start == 0


def test_template_families_do_not_leak_between_splits():
    cases = build_benchmark()
    assert {c.language for c in cases} == {"english", "sinhala", "romanized", "code_mixed"}
    assert {c.split for c in cases} == {"development", "heldout"}
    assert all(
        len({c.split for c in cases if c.family == family}) == 1
        for family in {c.family for c in cases}
    )
    assert all(0 <= s.start < s.end <= len(c.text) for c in cases for s in c.gold)


@pytest.mark.parametrize("strategy", ["regex", "presidio", "hybrid"])
def test_each_pipeline_strategy_runs_quality_and_privacy_gates(strategy):
    masked = run_preprocessing_pipeline(
        [PipelineInput("synthetic", "Contact fixture@example.com.")], strategy=strategy
    )
    assert masked.release_ready
    assert "[EMAIL]" in masked.records[0].anonymized_text
    review = run_preprocessing_pipeline(
        [PipelineInput("synthetic", "Unresolved marker @.")], strategy=strategy
    )
    assert not review.release_ready
    assert "privacy_review_required" in review.blocking_reasons
    duplicate = run_preprocessing_pipeline(
        [PipelineInput("same", "Safe sentence."), PipelineInput("same", "Other safe sentence.")],
        strategy=strategy,
    )
    assert {"data_quality_rejected", "release_privacy_gate_failed"} <= set(
        duplicate.blocking_reasons
    )
    assert "fixture@example.com" not in json.dumps(masked.privacy_summary)


def test_invalid_pipeline_strategy_fails():
    with pytest.raises(ValueError, match="Unknown"):
        run_preprocessing_pipeline([], strategy="unknown")


def test_missing_model_fails_without_downloading(monkeypatch):
    import spacy
    from preprocessing.presidio_anonymization import _get_engines

    monkeypatch.setattr(spacy.util, "is_package", lambda _: False)
    with pytest.raises(RuntimeError, match="Required English spaCy model"):
        _get_engines.__wrapped__()


def test_email_domain_validation_never_fetches_suffix_lists(monkeypatch):
    import requests
    from preprocessing.presidio_anonymization import _OfflineEmailRecognizer

    def forbidden_fetch(*args, **kwargs):
        raise AssertionError("Email validation attempted network access")

    monkeypatch.setattr(requests.Session, "get", forbidden_fetch)
    recognizer = _OfflineEmailRecognizer()
    assert recognizer.validate_result("fixture@example.com")
    assert not recognizer.validate_result("fixture@invalid.invalidsuffix")


@pytest.mark.parametrize("strategy", ["regex", "presidio", "hybrid"])
def test_release_gate_catches_false_safe_result(monkeypatch, strategy):
    modules = {
        "regex": "preprocessing.pipeline.anonymize_text",
        "presidio": "preprocessing.presidio_anonymization.anonymize_with_presidio",
        "hybrid": "preprocessing.hybrid_anonymization.anonymize_with_hybrid",
    }
    monkeypatch.setattr(
        modules[strategy],
        lambda text: SimpleNamespace(
            anonymized_text=text, transformations=(), requires_review=False
        ),
    )
    result = run_preprocessing_pipeline(
        [PipelineInput("synthetic", "Contact fixture@example.com.")], strategy=strategy
    )
    assert not result.release_ready
    assert "release_privacy_gate_failed" in result.blocking_reasons
