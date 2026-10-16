"""Component 4 Pretrained Base Encoder Adapter.

Loads the pretrained FacebookAI/xlm-roberta-base encoder without classification heads or fine-tuning.
Provides inference-only encoder representations and diagnostic metadata for C4 development testing.
"""

from __future__ import annotations

import logging
from typing import Any, cast

import torch
from research_contracts import C4EncoderCheckResponse
from transformers import AutoModel, AutoTokenizer

logger = logging.getLogger(__name__)

MODEL_ID = "FacebookAI/xlm-roberta-base"
MAX_SEQUENCE_LENGTH = 512


class XaiEncoderAdapter:
    """Pretrained base encoder wrapper for development testing."""

    def __init__(self, model_id: str = MODEL_ID) -> None:
        self.model_id = model_id
        logger.info("Loading base encoder tokenizer and weights: %s", model_id)
        self.tokenizer = AutoTokenizer.from_pretrained(model_id)
        self.model = AutoModel.from_pretrained(model_id)
        self.model.eval()
        for param in self.model.parameters():
            param.requires_grad = False

    def run_check(self, text: str) -> C4EncoderCheckResponse:
        """Run tokenizer and base encoder on input text and return diagnostic summary."""
        if not text or not text.strip():
            raise ValueError("Input text cannot be empty.")

        unclipped_tokens = self.tokenizer.encode(text, add_special_tokens=True)
        token_count = len(unclipped_tokens)
        truncated = token_count > MAX_SEQUENCE_LENGTH

        encoded = self.tokenizer(
            text,
            max_length=MAX_SEQUENCE_LENGTH,
            truncation=True,
            return_tensors="pt",
        )

        with torch.inference_mode():
            outputs = self.model(**encoded)
            last_hidden = outputs.last_hidden_state
            embedding_shape = list(last_hidden.shape)

        return C4EncoderCheckResponse(
            model_id=cast(Any, self.model_id),
            status_message="Base encoder connected — wellbeing classification unavailable.",
            encoder_executed=True,
            token_count=token_count,
            truncated=truncated,
            embedding_shape=embedding_shape,
            hidden_dimension=embedding_shape[-1] if len(embedding_shape) >= 3 else 768,
        )


_ADAPTER_INSTANCE: XaiEncoderAdapter | None = None


def get_encoder_adapter() -> XaiEncoderAdapter:
    """Singleton getter for the base encoder adapter."""
    global _ADAPTER_INSTANCE
    if _ADAPTER_INSTANCE is None:
        _ADAPTER_INSTANCE = XaiEncoderAdapter()
    return _ADAPTER_INSTANCE
