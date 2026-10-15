"""Actual v3 inference, scoped overlap correction and surviving review signals."""

import pytest
from preprocessing.person_context import parse_contexts
from preprocessing.pipeline import PipelineInput, run_preprocessing_pipeline
from preprocessing.presidio_anonymization import _get_engines
from preprocessing.role_kinship_regressions import development, unresolved
from preprocessing.span_evaluation import evaluate_detection, render, select_presidio
from presidio_analyzer import RecognizerResult

from tests.unit.test_c2_contextual_detection import splits_boundary


@pytest.mark.parametrize("fixture", development(), ids=lambda c: c.case_id)
def test_name_only_actual_presidio_offsets(fixture):
    spans = evaluate_detection(fixture.text, "presidio")
    for expected in fixture.gold:
        if expected.entity_type == "PERSON":
            assert expected in spans
    assert not any(splits_boundary(fixture.text, b) for s in spans for b in (s.start, s.end))
    result = run_preprocessing_pipeline(
        [PipelineInput("fixture", fixture.text)], strategy="presidio"
    )
    assert result.records[0].anonymized_text == render(fixture.text, spans)


@pytest.mark.parametrize("strategy", ["regex", "presidio", "hybrid"])
@pytest.mark.parametrize("fixture", development()[:2], ids=lambda c: c.case_id)
def test_reported_outputs_preserve_introductions_exactly(strategy, fixture):
    result = run_preprocessing_pipeline([PipelineInput("fixture", fixture.text)], strategy=strategy)
    assert result.records[0].anonymized_text == render(fixture.text, fixture.gold)
    assert result.records[0].quality_status == "PASS"
    assert not result.records[0].requires_privacy_review
    assert result.privacy_summary["status"] == "PASSED"
    assert result.release_ready  # Automated prerequisites only.


@pytest.mark.parametrize("strategy", ["regex", "presidio", "hybrid"])
def test_title_role_tabs_and_spaces_survive(strategy):
    fixture = development()[2]
    result = run_preprocessing_pipeline([PipelineInput("fixture", fixture.text)], strategy=strategy)
    assert result.records[0].anonymized_text == render(fixture.text, fixture.gold)


@pytest.mark.parametrize("strategy", ["regex", "presidio", "hybrid"])
@pytest.mark.parametrize("fixture", unresolved(), ids=lambda c: c.case_id)
def test_original_unresolved_signal_blocks_even_if_ner_erases_intro(strategy, fixture):
    result = run_preprocessing_pipeline([PipelineInput("fixture", fixture.text)], strategy=strategy)
    assert result.records[0].requires_privacy_review
    assert result.records[0].quality_status == "REVIEW"
    assert result.privacy_summary["status"] == "FAILED"
    assert not result.release_ready
    assert "privacy_review_required" in result.blocking_reasons


@pytest.mark.parametrize(
    "fixture",
    [
        pytest.param(
            c,
            marks=pytest.mark.xfail(
                strict=True,
                reason="Baseline spaCy false mask remains; no parsed name licenses model removal",
            ),
        )
        if c.case_id
        in {
            "new-negative-2",
            "new-negative-3",
            "new-negative-4",
            "new-negative-5",
            "new-negative-6",
            "new-negative-7",
        }
        else c
        for c in development()
        if c.category == "negative"
    ],
    ids=lambda c: c.case_id,
)
def test_ordinary_descriptions_and_placeholders(fixture):
    assert evaluate_detection(fixture.text, "presidio") == ()


@pytest.mark.parametrize("reverse", [False, True])
def test_erroneous_intro_ner_is_trimmed_only_inside_parsed_context(monkeypatch, reverse):
    text = "Oliver Reed. ape supervisior ms avira."
    analyzer, _ = _get_engines()
    raw = [RecognizerResult("PERSON", 0, 11, 0.85), RecognizerResult("PERSON", 17, 32, 0.85)]
    monkeypatch.setattr(
        analyzer, "analyze", lambda **kwargs: list(reversed(raw)) if reverse else raw
    )
    spans = select_presidio(text)
    assert [(r.start, r.end, r.entity_type) for r in spans] == [
        (0, 11, "PERSON"),
        (32, 37, "PERSON"),
    ]
    assert parse_contexts(text)[0] == ((32, 37, 13),)


def test_unresolved_predicate_is_review_not_successful_contextual_mask():
    for text in ("mge nngi hondai", "mage nangi harima hondai", "mge nngi ruvai"):
        found, uncertain = parse_contexts(text)
        assert not found
        assert uncertain


@pytest.mark.xfail(
    strict=True,
    reason="Existing predicate grammar excludes unpunctuated mt clauses; new name itself is masked correctly",
)
def test_unpunctuated_wellbeing_tail_known_false_mask_remains_visible():
    text = "mge nngi navira perera mt exams gana dukai."
    result = run_preprocessing_pipeline([PipelineInput("fixture", text)], strategy="presidio")
    assert result.records[0].anonymized_text == "mge nngi [PERSON] mt exams gana dukai."


def test_neighbouring_genuine_names_and_predicate_guards_remain_distinct():
    text = "My name is Jane Miller. Mata met Gana Dukai."
    spans = evaluate_detection(text, "presidio")
    assert any(text[s.start : s.end] == "Gana Dukai" for s in spans)
