"""Unit tests for Component 4 LIME and SHAP explainers."""

from __future__ import annotations

import numpy as np
import pytest
from fastapi.testclient import TestClient
from research_common.service_auth import service_token
from research_contracts import C4ExplanationRequest
from xai.classifier_interface import set_classifier
from xai.lime_explainer import explain_with_lime
from xai.main import app
from xai.shap_explainer import explain_with_shap


class FictionalInputDependentTestDouble:
    """Test-only classifier double providing deterministic batch probabilities.

    Confined strictly to unit tests; never presents findings as real model predictions.
    """

    def __init__(self) -> None:
        self.class_labels = ["Low Pressure", "Academic Pressure"]
        self.model_version = "test-double-c4-0.1.0"

    def predict_proba(self, texts: list[str]) -> np.ndarray:
        res = []
        for t in texts:
            t_lower = t.lower()
            # Input-dependent probability calculation
            score = 0.2
            if "exam" in t_lower or "deadlines" in t_lower or "pressure" in t_lower or "විභාගය" in t:
                score += 0.4
            if "fatigue" in t_lower or "stress" in t_lower or "අපහසුයි" in t:
                score += 0.3
            score = min(max(score, 0.05), 0.95)
            res.append([1.0 - score, score])
        return np.array(res)


@pytest.fixture(autouse=True)
def mock_service_redis(monkeypatch):
    """Mock Redis and XAI service secret for unit test authentication."""
    import secrets

    from research_common import service_auth
    from research_common.config import settings

    class SimpleRedis:
        def __init__(self):
            self.data = {}

        def get(self, k):
            return self.data.get(k)

        def set(self, k, v, **kw):
            self.data[k] = v

        def delete(self, k):
            self.data.pop(k, None)

    cache = SimpleRedis()
    monkeypatch.setattr(service_auth, "redis_client", lambda: cache)
    monkeypatch.setenv("SERVICE_NAME", "xai")
    monkeypatch.setenv("XAI_SECRET", secrets.token_urlsafe(48))
    settings.cache_clear()
    yield cache
    settings.cache_clear()


@pytest.fixture(autouse=True)
def clean_classifier_registry():
    """Ensure classifier registry is reset before and after each test."""
    set_classifier(None)
    yield
    set_classifier(None)


def test_awaiting_classifier_connection_without_classifier():
    """Verify that without a classifier, the explainer returns 'Awaiting classifier connection'."""
    client = TestClient(app)

    headers = {"Authorization": f"Bearer {service_token('xai')}"}
    for method in ["LIME", "SHAP"]:
        payload = C4ExplanationRequest(
            text="I have two coursework deadlines and an upcoming exam.",
            method=method,  # type: ignore[arg-type]
        ).model_dump(mode="json")

        resp = client.post("/internal/v1/dev/explain", json=payload, headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["method"] == method
        assert data["status"] == "AWAITING_CLASSIFIER_CONNECTION"
        assert data["status_message"] == "Awaiting classifier connection"
        assert data["model_version"] is None
        assert data["target_class"] is None
        assert data["contributions"] == []


def test_lime_explainer_execution_and_unicode_preservation():
    """Verify real LIME execution, bounded computation, and Sinhala Unicode preservation."""
    double = FictionalInputDependentTestDouble()
    set_classifier(double)

    # 1. English execution
    eng_text = "I have upcoming exam deadlines with extreme academic pressure."
    res_eng = explain_with_lime(eng_text, double, target_class="Academic Pressure", num_samples=60)
    assert res_eng.method == "LIME"
    assert res_eng.status == "READY"
    assert res_eng.target_class == "Academic Pressure"
    assert res_eng.model_version == double.model_version
    assert len(res_eng.contributions) > 0
    assert any(c.token.lower() in ["exam", "deadlines", "pressure"] for c in res_eng.contributions)
    assert res_eng.computation_bounds["num_samples"] == 60

    # 2. Sinhala Unicode execution
    si_text = "මේ සතියේ ප්‍රධාන විභාගය සඳහා සූදානම් වීමට කාලය කළමනාකරණය අපහසුයි."
    res_si = explain_with_lime(si_text, double, target_class="Academic Pressure", num_samples=60)
    assert res_si.status == "READY"
    assert len(res_si.contributions) > 0
    # Assert Sinhala tokens are intact (not destroyed or converted to ascii)
    si_tokens = [c.token for c in res_si.contributions]
    assert any("විභාගය" in tok or "අපහසුයි" in tok for tok in si_tokens)


def test_shap_explainer_execution_and_waterfall_properties():
    """Verify real SHAP execution with text masker, base_value, and Unicode preservation."""
    double = FictionalInputDependentTestDouble()
    set_classifier(double)

    # 1. English execution
    eng_text = "Coursework exam deadlines with stress."
    res_eng = explain_with_shap(eng_text, double, target_class="Academic Pressure", max_evals=60)
    assert res_eng.method == "SHAP"
    assert res_eng.status == "READY"
    assert res_eng.target_class == "Academic Pressure"
    assert res_eng.base_value is not None
    assert res_eng.output_value is not None
    assert len(res_eng.contributions) > 0
    assert len(res_eng.tokens) == len(res_eng.weights)
    assert res_eng.computation_bounds["max_evals"] == 60

    # 2. Sinhala Unicode execution
    si_text = "විභාගය සඳහා සූදානම් වීම අපහසුයි."
    res_si = explain_with_shap(si_text, double, target_class="Academic Pressure", max_evals=60)
    assert res_si.status == "READY"
    assert len(res_si.contributions) > 0
    si_tokens = [c.token for c in res_si.contributions]
    assert any("විභාගය" in tok or "අපහසුයි" in tok for tok in si_tokens)


def test_dev_explain_endpoint_with_classifier():
    """Verify the /internal/v1/dev/explain endpoint produces consistent target classes."""
    double = FictionalInputDependentTestDouble()
    set_classifier(double)
    client = TestClient(app)

    text = "Balancing exam deadlines and sleep schedule."

    # LIME via endpoint
    lime_req = C4ExplanationRequest(
        text=text,
        method="LIME",
        target_class="Academic Pressure",
    ).model_dump(mode="json")
    headers = {"Authorization": f"Bearer {service_token('xai')}"}
    lime_resp = client.post("/internal/v1/dev/explain", json=lime_req, headers=headers)
    assert lime_resp.status_code == 200
    lime_data = lime_resp.json()
    assert lime_data["method"] == "LIME"
    assert lime_data["status"] == "READY"
    assert lime_data["target_class"] == "Academic Pressure"

    # SHAP via endpoint on the same target class
    shap_req = C4ExplanationRequest(
        text=text,
        method="SHAP",
        target_class="Academic Pressure",
    ).model_dump(mode="json")
    shap_resp = client.post("/internal/v1/dev/explain", json=shap_req, headers=headers)
    assert shap_resp.status_code == 200
    shap_data = shap_resp.json()
    assert shap_data["method"] == "SHAP"
    assert shap_data["status"] == "READY"
    assert shap_data["target_class"] == "Academic Pressure"
    assert shap_data["base_value"] is not None
