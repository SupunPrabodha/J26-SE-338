"""Component 4 SHAP Text Explainer Module.

Uses official shap.Explainer with shap.maskers.Text, bounded evaluations, and Unicode preservation.
No TreeExplainer is used.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

import numpy as np
import shap
from research_contracts import C4ExplanationResponse, FeatureContribution

if TYPE_CHECKING:
    from xai.classifier_interface import BatchPredictionClassifier

logger = logging.getLogger(__name__)

DEFAULT_MAX_EVALS = 100


def explain_with_shap(
    text: str,
    classifier: BatchPredictionClassifier,
    target_class: str | None = None,
    max_evals: int = DEFAULT_MAX_EVALS,
) -> C4ExplanationResponse:
    """Generate SHAP additive feature attributions for input text using a text masker."""
    if not text or not text.strip():
        raise ValueError("Input text cannot be empty.")

    labels = classifier.class_labels
    if not labels:
        raise ValueError("Classifier must define non-empty class labels.")

    # Determine probabilities for target class selection
    probs = classifier.predict_proba([text])[0]

    if target_class and target_class in labels:
        target_idx = labels.index(target_class)
    else:
        target_idx = int(probs.argmax())
        target_class = labels[target_idx]

    target_prob = float(probs[target_idx])

    # Text-compatible masker preserving Unicode words
    masker = shap.maskers.Text(r"\s+")
    explainer = shap.Explainer(
        classifier.predict_proba,
        masker,
        output_names=labels,
    )

    shap_values = explainer([text], max_evals=max_evals)

    # Extract base value for target class
    base_val = 0.0
    if hasattr(shap_values, "base_values"):
        bv = shap_values.base_values
        if isinstance(bv, np.ndarray):
            if bv.ndim == 2:
                base_val = float(bv[0, target_idx])
            elif bv.ndim == 1:
                base_val = float(bv[0])
            else:
                base_val = float(bv.item(0))
        elif isinstance(bv, (int, float)):
            base_val = float(bv)

    # Extract tokens and values for target class
    raw_tokens: list[str] = []
    if hasattr(shap_values, "data") and len(shap_values.data) > 0:
        raw_tokens = [str(t) for t in shap_values.data[0]]

    raw_values: list[float] = []
    if hasattr(shap_values, "values") and len(shap_values.values) > 0:
        vals = shap_values.values[0]
        if vals.ndim == 2:
            raw_values = [float(v) for v in vals[:, target_idx]]
        else:
            raw_values = [float(v) for v in vals]

    contributions: list[FeatureContribution] = []
    tokens: list[str] = []
    weights: list[float] = []

    for t, w in zip(raw_tokens, raw_values, strict=False):
        t_clean = t.strip()
        if not t_clean:
            continue
        tokens.append(t_clean)
        weights.append(w)
        contributions.append(
            FeatureContribution(
                token=t_clean,
                weight=w,
                direction="supports" if w >= 0 else "opposes",
                abs_weight=abs(w),
            )
        )

    # Calculated output value = base_value + sum(weights)
    calculated_output = base_val + sum(raw_values)

    return C4ExplanationResponse(
        method="SHAP",
        status="READY",
        status_message="SHAP additive explanation generated successfully.",
        model_version=classifier.model_version,
        target_class=target_class,
        target_class_probability=target_prob,
        base_value=base_val,
        output_value=calculated_output,
        contributions=contributions,
        tokens=tokens,
        weights=weights,
        computation_bounds={
            "max_evals": max_evals,
        },
    )
