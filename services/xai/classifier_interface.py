"""Replaceable batch prediction interface for Component 4 explainers."""

from __future__ import annotations

from typing import TYPE_CHECKING, Protocol, runtime_checkable

if TYPE_CHECKING:
    import numpy as np


@runtime_checkable
class BatchPredictionClassifier(Protocol):
    """Protocol for models providing batch probability distributions across wellbeing classes."""

    def predict_proba(self, texts: list[str]) -> np.ndarray:
        """Return probability matrix with shape [len(texts), num_classes]."""
        ...

    @property
    def class_labels(self) -> list[str]:
        """Ordered list of class label names."""
        ...

    @property
    def model_version(self) -> str:
        """Version identifier of the classifier."""
        ...

    @property
    def model_id(self) -> str:
        """Identifier of the model checkpoint."""
        ...

    @property
    def model_revision(self) -> str | None:
        """Revision or commit hash of the model checkpoint."""
        ...


_CURRENT_CLASSIFIER: BatchPredictionClassifier | None = None


def get_classifier() -> BatchPredictionClassifier | None:
    """Retrieve the currently registered classifier, or None if awaiting C3 integration."""
    return _CURRENT_CLASSIFIER


def set_classifier(classifier: BatchPredictionClassifier | None) -> None:
    """Register or clear the active classifier implementation."""
    global _CURRENT_CLASSIFIER
    _CURRENT_CLASSIFIER = classifier
