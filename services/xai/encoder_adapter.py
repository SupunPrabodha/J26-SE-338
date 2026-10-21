"""Component 4 Temporary Sentiment Classifier Adapter.

Loads cardiffnlp/twitter-xlm-roberta-base-sentiment with its trained classification head
as a temporary sentiment classifier for C4 development until Member 3's final model is available.
Provides bounded batch probability prediction conforming to BatchPredictionClassifier.
"""

from __future__ import annotations

import logging
from typing import Any, cast

import numpy as np
import torch
from research_contracts import C4EncoderCheckResponse
from transformers import AutoModel, AutoModelForSequenceClassification, AutoTokenizer

from xai.classifier_interface import BatchPredictionClassifier, set_classifier

logger = logging.getLogger(__name__)

MODEL_ID = "cardiffnlp/twitter-xlm-roberta-base-sentiment"
MAX_SEQUENCE_LENGTH = 512
DEFAULT_BATCH_SIZE = 32


def preprocess_text(text: str) -> str:
    """Preprocess input text following CardiffNLP model card (mentions -> @user, URLs -> http)."""
    tokens = []
    for token in text.split(" "):
        if token.startswith("@") and len(token) > 1:
            tokens.append("@user")
        elif token.startswith("http://") or token.startswith("https://") or token.startswith("http"):
            tokens.append("http")
        else:
            tokens.append(token)
    return " ".join(tokens)


class SentimentClassifierAdapter(BatchPredictionClassifier):
    """Temporary sentiment classifier wrapper for Component 4 development."""

    def __init__(self, model_id: str = MODEL_ID) -> None:
        self._model_id = model_id
        logger.info("Loading sentiment classifier tokenizer and weights: %s", model_id)
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.tokenizer = AutoTokenizer.from_pretrained(model_id)
        self.model = AutoModelForSequenceClassification.from_pretrained(model_id)
        self.model.eval()
        self.model.to(self.device)
        for param in self.model.parameters():
            param.requires_grad = False

        # Read class labels in fixed checkpoint order: {0: 'negative', 1: 'neutral', 2: 'positive'}
        id2label = self.model.config.id2label
        self._class_labels = [id2label[i].capitalize() for i in range(len(id2label))]
        self._revision = getattr(self.model.config, "_commit_hash", None) or "main"

    @property
    def class_labels(self) -> list[str]:
        """Ordered list of class label names: ['Negative', 'Neutral', 'Positive']."""
        return list(self._class_labels)

    @property
    def model_id(self) -> str:
        """Identifier of the model checkpoint."""
        return self._model_id

    @property
    def model_version(self) -> str:
        """Version identifier of the classifier."""
        return self._model_id

    @property
    def model_revision(self) -> str | None:
        """Revision or commit hash of the model checkpoint."""
        return self._revision

    def predict_proba(self, texts: list[str] | np.ndarray) -> np.ndarray:
        """Return probability matrix with shape [len(texts), 3] in fixed checkpoint label order.

        Bounded batch execution to prevent memory exhaustion during LIME/SHAP perturbations.
        """
        if texts is None or len(texts) == 0:
            return np.empty((0, len(self._class_labels)), dtype=np.float32)

        # Convert numpy array or iterable to list of strings
        if isinstance(texts, np.ndarray):
            texts_list = [str(t) for t in texts.flatten()]
        else:
            texts_list = [str(t) for t in texts]

        # Preprocess all texts identically following the model card
        preprocessed = [preprocess_text(t) if t and t.strip() else "" for t in texts_list]

        results: list[np.ndarray] = []
        batch_size = DEFAULT_BATCH_SIZE

        for i in range(0, len(preprocessed), batch_size):
            batch_texts = preprocessed[i : i + batch_size]
            encoded = self.tokenizer(
                batch_texts,
                padding=True,
                truncation=True,
                max_length=MAX_SEQUENCE_LENGTH,
                return_tensors="pt",
            )
            encoded = {k: v.to(self.device) for k, v in encoded.items()}

            with torch.inference_mode():
                outputs = self.model(**encoded)
                logits = outputs.logits
                probs = torch.softmax(logits, dim=-1).cpu().numpy()
                results.append(probs)

        return np.vstack(results)

    def predict_single(self, text: str) -> dict[str, Any]:
        """Diagnostic & prediction evaluation for a single input text."""
        if not text or not text.strip():
            raise ValueError("Input text cannot be empty.")

        unclipped_tokens = self.tokenizer.encode(text, add_special_tokens=True)
        token_count = len(unclipped_tokens)
        truncated = token_count > MAX_SEQUENCE_LENGTH

        probs = self.predict_proba([text])[0]
        pred_idx = int(np.argmax(probs))
        predicted_sentiment = self._class_labels[pred_idx]

        prob_dict = {
            label: float(probs[idx]) for idx, label in enumerate(self._class_labels)
        }

        return {
            "model_id": self.model_id,
            "model_version": self.model_id,
            "model_revision": self._revision,
            "predicted_sentiment": predicted_sentiment,
            "confidence": float(probs[pred_idx]),
            "probabilities": prob_dict,
            "token_count": token_count,
            "truncated": truncated,
            "max_sequence_length": MAX_SEQUENCE_LENGTH,
        }


class XaiEncoderAdapter:
    """Pretrained base encoder wrapper for development testing."""

    def __init__(self, model_id: str = "FacebookAI/xlm-roberta-base") -> None:
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


_CLASSIFIER_INSTANCE: SentimentClassifierAdapter | None = None
_ENCODER_INSTANCE: XaiEncoderAdapter | None = None


def get_classifier_adapter() -> SentimentClassifierAdapter:
    """Singleton getter for the sentiment classifier adapter."""
    global _CLASSIFIER_INSTANCE
    if _CLASSIFIER_INSTANCE is None:
        _CLASSIFIER_INSTANCE = SentimentClassifierAdapter()
        set_classifier(_CLASSIFIER_INSTANCE)
    return _CLASSIFIER_INSTANCE


def get_encoder_adapter() -> XaiEncoderAdapter:
    """Singleton getter for the base encoder adapter."""
    global _ENCODER_INSTANCE
    if _ENCODER_INSTANCE is None:
        _ENCODER_INSTANCE = XaiEncoderAdapter()
    return _ENCODER_INSTANCE
