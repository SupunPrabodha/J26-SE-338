"""Demo-boundary integration mechanics, not new model accuracy evidence."""

from types import SimpleNamespace

import pytest
from preprocessing import gliner_demo
from preprocessing.demo import execute_custom
from preprocessing.pipeline import PipelineInput, run_preprocessing_pipeline
from preprocessing.span_evaluation import EntitySpan
from research_common.web import SafeError
from research_contracts import C2CustomDemoRequest, C2DemoRequest


def test_experimental_strategy_cannot_enter_generic_pipeline():
    with pytest.raises(ValueError, match="development demo boundary"):
        run_preprocessing_pipeline([], strategy="gliner")
    assert (
        run_preprocessing_pipeline([PipelineInput("id", "I feel tired.")])
        .records[0]
        .transformations
        == ()
    )


def test_custom_default_uses_actual_gliner_spans_and_blocks_release(monkeypatch):
    text = "Name: Dalen. Contact test@example.com"
    model = SimpleNamespace(
        detect=lambda value: (EntitySpan(6, 11, "PERSON"), EntitySpan(21, len(text), "EMAIL"))
    )
    monkeypatch.setattr(gliner_demo, "load_candidate", lambda: model)
    monkeypatch.setattr(gliner_demo, "combine", lambda value, spans: spans)
    body = C2CustomDemoRequest(text=text)
    assert body.strategy == "gliner"
    assert C2DemoRequest(scenario_id="english").strategy == "regex"
    response = execute_custom(body)
    assert response.strategy == "gliner"
    assert response.anonymization_configuration == gliner_demo.VERSION
    assert response.records[0].anonymized_text == "Name: [PERSON]. Contact [EMAIL]"
    assert not response.release_ready
    assert "experimental_anonymizer_not_release_validated" in response.blocking_reasons


def test_loading_failure_has_no_fallback_or_text_leak(monkeypatch):
    def broken():
        raise RuntimeError("PRIVATE-SENTINEL")

    monkeypatch.setattr(gliner_demo, "load_candidate", broken)
    with pytest.raises(SafeError) as error:
        execute_custom(C2CustomDemoRequest(text="fictional", strategy="gliner"))
    assert "PRIVATE-SENTINEL" not in str(error.value)


def test_runtime_keeps_preceding_whole_text_configuration_without_window_calls(monkeypatch):
    from preprocessing import gliner_context_windows

    calls = []

    def detect(text):
        calls.append(text)
        return (EntitySpan(11, 16, "PERSON"),)

    def forbidden(*args, **kwargs):
        pytest.fail("Rejected sentence-context experiment entered active inference")

    model = SimpleNamespace(detect=detect)
    monkeypatch.setattr(gliner_context_windows, "window_predictions", forbidden)
    monkeypatch.setattr(gliner_context_windows, "augment_locations", forbidden)
    monkeypatch.setattr(gliner_demo, "load_candidate", lambda: model)
    monkeypatch.setattr(gliner_demo, "combine", lambda text, spans: spans)
    result = gliner_demo.anonymize_gliner_demo("My name is Taria. I live in Elgin.")
    assert result.anonymized_text == "My name is [PERSON]. I live in Elgin."
    assert calls == ["My name is Taria. I live in Elgin."]
    assert gliner_demo.VERSION == "gliner-name-labels-v4-context-demo-v1"


def test_loader_disabled_without_explicit_switch(monkeypatch):
    from research_common import config

    # This isolated unit test must not depend on the developer's private .env.
    monkeypatch.setattr(config, "settings", lambda: SimpleNamespace(environment="development"))
    monkeypatch.delenv("C2_GLINER_DEMO_ENABLED", raising=False)
    gliner_demo.load_candidate.cache_clear()
    with pytest.raises(RuntimeError, match="unavailable"):
        gliner_demo.load_candidate()


def test_unsafe_combining_mark_boundaries_fail_closed(monkeypatch):
    monkeypatch.setattr(
        gliner_demo,
        "load_candidate",
        lambda: SimpleNamespace(detect=lambda text: (EntitySpan(0, 1, "PERSON"),)),
    )
    monkeypatch.setattr(gliner_demo, "combine", lambda text, spans: spans)
    with pytest.raises(RuntimeError, match="Unsafe"):
        gliner_demo.anonymize_gliner_demo("කි")
