"""Component 4 LIME Text Explainer Module.

Uses official lime.lime_text.LimeTextExplainer with bounded computation and Unicode preservation.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from lime.lime_text import LimeTextExplainer
from research_contracts import C4ExplanationResponse, FeatureContribution

if TYPE_CHECKING:
    from xai.classifier_interface import BatchPredictionClassifier

logger = logging.getLogger(__name__)

DEFAULT_NUM_FEATURES = 15
DEFAULT_NUM_SAMPLES = 100


def explain_with_lime(
    text: str,
    classifier: BatchPredictionClassifier,
    target_class: str | None = None,
    num_features: int = DEFAULT_NUM_FEATURES,
    num_samples: int = DEFAULT_NUM_SAMPLES,
) -> C4ExplanationResponse:
    """Generate LIME feature attributions for input text using the provided classifier."""
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

    # Instantiate LimeTextExplainer with whitespace splitting to preserve full Unicode tokens
    explainer = LimeTextExplainer(
        split_expression=r"\s+",
        class_names=labels,
        bow=False,
    )

    exp = explainer.explain_instance(
        text,
        classifier.predict_proba,
        labels=[target_idx],
        num_features=num_features,
        num_samples=num_samples,
    )

    raw_list = exp.as_list(label=target_idx)
    contributions: list[FeatureContribution] = []
    tokens: list[str] = []
    weights: list[float] = []

    for token, weight in raw_list:
        token_str = str(token).strip()
        weight_flt = float(weight)
        tokens.append(token_str)
        weights.append(weight_flt)
        contributions.append(
            FeatureContribution(
                token=token_str,
                weight=weight_flt,
                direction="supports" if weight_flt >= 0 else "opposes",
                abs_weight=abs(weight_flt),
            )
        )

    # Compute token count and truncation metadata if tokenizer is available
    token_count = len(text.split())
    truncated = False
    if hasattr(classifier, "tokenizer"):
        token_ids = classifier.tokenizer.encode(text, add_special_tokens=True)
        token_count = len(token_ids)
        truncated = token_count > 512

    model_id = getattr(classifier, "model_id", classifier.model_version)
    model_rev = getattr(classifier, "model_revision", None)

    import math
    base_val = (
        float(exp.intercept[target_idx])
        if hasattr(exp, "intercept") and target_idx in exp.intercept
        else None
    )
    if not math.isfinite(target_prob) or not all(math.isfinite(w) for w in weights) or (base_val is not None and not math.isfinite(base_val)):
        return C4ExplanationResponse(
            method="LIME",
            status="UNAVAILABLE",
            status_message="LIME explanation unavailable: non-finite numerical values in attributions.",
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
            output_value=target_prob,
            contributions=[],
            tokens=[],
            weights=[],
            computation_bounds={
                "num_features": num_features,
                "num_samples": num_samples,
            },
        )

    return C4ExplanationResponse(
        method="LIME",
        status="READY",
        status_message="LIME local explanation generated successfully.",
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
        output_value=target_prob,
        contributions=contributions,
        tokens=tokens,
        weights=weights,
        computation_bounds={
            "num_features": num_features,
            "num_samples": num_samples,
        },
    )
