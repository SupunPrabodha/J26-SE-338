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


# Documented numerical tolerance for SHAP efficiency (additivity) property under sampling
ADDITIVITY_TOLERANCE = 1e-4


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

    # Determine probabilities for all classes using the bounded batch classifier
    probs = classifier.predict_proba([text])[0]
    prob_dict = {labels[i]: float(probs[i]) for i in range(len(labels))}
    predicted_idx = int(probs.argmax())
    predicted_class = labels[predicted_idx]

    # Resolve target_class (case-insensitive lookup across checkpoint labels)
    target_idx = None
    if target_class:
        for idx, lbl in enumerate(labels):
            if lbl.lower() == target_class.lower():
                target_idx = idx
                target_class = lbl
                break

    if target_idx is None:
        target_idx = predicted_idx
        target_class = predicted_class

    target_prob = float(probs[target_idx])

    # Text-compatible masker preserving Unicode words
    masker = shap.maskers.Text(r"\s+")
    explainer = shap.Explainer(
        classifier.predict_proba,
        masker,
        output_names=labels,
    )

    shap_values = explainer([text], max_evals=max_evals)

    # Extract base value for target class; do not default to zero if missing
    base_val: float | None = None
    if hasattr(shap_values, "base_values") and shap_values.base_values is not None:
        bv = shap_values.base_values
        try:
            if isinstance(bv, np.ndarray):
                if bv.ndim == 2:
                    base_val = float(bv[0, target_idx])
                elif bv.ndim == 1:
                    base_val = float(bv[0])
                else:
                    base_val = float(bv.item(0))
            elif isinstance(bv, (int, float)):
                base_val = float(bv)
        except Exception as exc:
            logger.warning("Malformed SHAP base_values: %s", exc)
            base_val = None

    # Extract tokens and values for target class
    raw_tokens: list[str] = []
    if hasattr(shap_values, "data") and len(shap_values.data) > 0:
        raw_tokens = [str(t) for t in shap_values.data[0]]

    raw_values: list[float] = []
    if hasattr(shap_values, "values") and len(shap_values.values) > 0:
        try:
            vals = shap_values.values[0]
            if isinstance(vals, np.ndarray):
                if vals.ndim == 2:
                    raw_values = [float(v) for v in vals[:, target_idx]]
                else:
                    raw_values = [float(v) for v in vals]
            elif isinstance(vals, (list, tuple)):
                raw_values = [float(v) for v in vals]
        except Exception as exc:
            logger.warning("Malformed SHAP values: %s", exc)
            raw_values = []

    model_id = getattr(classifier, "model_id", classifier.model_version)
    model_rev = getattr(classifier, "model_revision", None)

    token_count = len(text.split())
    truncated = False
    if hasattr(classifier, "tokenizer"):
        token_ids = classifier.tokenizer.encode(text, add_special_tokens=True)
        token_count = len(token_ids)
        truncated = token_count > 512

    # If required SHAP values are missing or malformed, report an unavailable result rather than defaulting to zero
    if base_val is None or not raw_values:
        return C4ExplanationResponse(
            method="SHAP",
            status="UNAVAILABLE",
            status_message="SHAP explanation unavailable: required base_values or attribution values are missing or malformed.",
            model_id=model_id,
            model_version=classifier.model_version,
            model_revision=model_rev,
            predicted_class=predicted_class,
            probabilities=prob_dict,
            token_count=token_count,
            truncated=truncated,
            target_class=target_class,
            target_class_probability=target_prob,
            base_value=None,
            output_value=target_prob,
            contributions=[],
            tokens=[],
            weights=[],
            computation_bounds={"max_evals": max_evals},
        )

    # Preserve all contributions, including whitespace or punctuation, for correct accounting
    contributions: list[FeatureContribution] = []
    tokens: list[str] = []
    weights: list[float] = []

    for t, w in zip(raw_tokens, raw_values, strict=False):
        tok_str = str(t)
        weight_val = float(w)
        tokens.append(tok_str)
        weights.append(weight_val)
        contributions.append(
            FeatureContribution(
                token=tok_str,
                weight=weight_val,
                direction="supports" if weight_val >= 0 else "opposes",
                abs_weight=abs(weight_val),
            )
        )

    # Return actual selected-class probability on the probability scale as output_value
    output_val = float(target_prob)

    # Separately calculate reconstructed_output = base_value + sum(all SHAP contributions)
    reconstructed_output = float(base_val + sum(c.weight for c in contributions))

    # Calculate additivity residual on the probability scale
    additivity_residual = float(output_val - reconstructed_output)

    # Compare using documented numerical tolerance (absolute residual <= 1e-4)
    additivity_within_tolerance = bool(abs(additivity_residual) <= ADDITIVITY_TOLERANCE)

    discrepancy_msg = (
        f"Additivity residual ({additivity_residual:+.4f}) exceeds numerical tolerance (±{ADDITIVITY_TOLERANCE:.0e}). Model output: {output_val:.4f}, Reconstructed: {reconstructed_output:.4f}."
        if not additivity_within_tolerance
        else None
    )

    return C4ExplanationResponse(
        method="SHAP",
        status="READY",
        status_message="SHAP additive explanation generated successfully.",
        model_id=model_id,
        model_version=classifier.model_version,
        model_revision=model_rev,
        predicted_class=predicted_class,
        probabilities=prob_dict,
        token_count=token_count,
        truncated=truncated,
        target_class=target_class,
        target_class_probability=target_prob,
        base_value=base_val,
        output_value=output_val,
        contributions=contributions,
        tokens=tokens,
        weights=weights,
        computation_bounds={
            "max_evals": max_evals,
        },
        reconstructed_output=reconstructed_output,
        additivity_residual=additivity_residual,
        additivity_within_tolerance=additivity_within_tolerance,
        additivity_discrepancy_message=discrepancy_msg,
    )
