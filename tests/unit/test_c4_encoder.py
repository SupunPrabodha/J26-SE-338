"""Unit tests for Component 4 pretrained base encoder connection."""

import pytest
from fastapi.testclient import TestClient
from research_contracts import C4EncoderCheckRequest
from xai.encoder_adapter import get_encoder_adapter
from xai.main import app


def test_base_encoder_adapter_evaluation_mode():
    """Verify that the base encoder adapter loads in eval mode without trainable parameters."""
    adapter = get_encoder_adapter()
    assert adapter.model.training is False
    assert not any(param.requires_grad for param in adapter.model.parameters())
    assert adapter.model_id == "FacebookAI/xlm-roberta-base"


def test_base_encoder_adapter_execution():
    """Verify inference execution, token count, and embedding shape without classification."""
    adapter = get_encoder_adapter()
    text = "Balancing exam deadlines and sleep schedule."
    result = adapter.run_check(text)

    assert result.model_id == "FacebookAI/xlm-roberta-base"
    assert result.status_message == "Base encoder connected — wellbeing classification unavailable."
    assert result.encoder_executed is True
    assert result.token_count > 0
    assert result.truncated is False
    assert len(result.embedding_shape) == 3
    assert result.embedding_shape[0] == 1
    assert result.embedding_shape[1] == result.token_count
    assert result.embedding_shape[2] == 768
    assert result.hidden_dimension == 768


def test_base_encoder_adapter_empty_text_rejected():
    """Verify that empty or whitespace-only inputs are rejected."""
    adapter = get_encoder_adapter()
    with pytest.raises(ValueError):
        adapter.run_check("")
    with pytest.raises(ValueError):
        adapter.run_check("   \n\t   ")


def test_dev_encoder_check_api_endpoint(monkeypatch):
    """Verify the /internal/v1/dev/encoder-check FastAPI endpoint."""
    client = TestClient(app)

    # Valid request in development
    payload = C4EncoderCheckRequest(
        text="I am feeling overwhelmed by coursework deadlines this week.",
        language="English",
    ).model_dump(mode="json")

    response = client.post("/internal/v1/dev/encoder-check", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["model_id"] == "FacebookAI/xlm-roberta-base"
    assert data["status_message"] == "Base encoder connected — wellbeing classification unavailable."
    assert data["encoder_executed"] is True
    assert data["token_count"] > 0
    assert data["embedding_shape"][0] == 1
    assert data["hidden_dimension"] == 768

    # Empty text rejection
    empty_payload = {"text": "   "}
    err_resp = client.post("/internal/v1/dev/encoder-check", json=empty_payload)
    assert err_resp.status_code in (400, 422)
