"""
Standardized Evaluation Metrics for Stage A & Stage B Experiments.
Owner: C3 - Ramanayake R. H. B. D. G. (IT23164130)

Computes:
- Macro & Weighted F1-score (Primary metric)
- Macro Precision & Recall
- Accuracy
- Expected Calibration Error (ECE) and Brier Score
- Confusion Matrix generation & visualization
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, Any, List, Optional

import matplotlib.pyplot as plt
import numpy as np
from sklearn.metrics import (
    accuracy_score,
    precision_recall_fscore_support,
    classification_report,
    confusion_matrix,
    brier_score_loss,
)


def compute_expected_calibration_error(
    y_true: np.ndarray,
    y_prob: np.ndarray,
    n_bins: int = 10,
) -> float:
    """
    Computes Expected Calibration Error (ECE).
    
    Args:
        y_true: Ground truth class indices of shape (N,).
        y_prob: Predicted class probabilities of shape (N, num_classes).
        n_bins: Number of confidence bins.
    """
    confidences = np.max(y_prob, axis=1)
    predictions = np.argmax(y_prob, axis=1)
    accuracies = predictions == y_true

    ece = 0.0
    bin_boundaries = np.linspace(0, 1, n_bins + 1)

    for i in range(n_bins):
        bin_lower, bin_upper = bin_boundaries[i], bin_boundaries[i + 1]
        in_bin = (confidences > bin_lower) & (confidences <= bin_upper)
        prop_in_bin = np.mean(in_bin)

        if prop_in_bin > 0:
            accuracy_in_bin = np.mean(accuracies[in_bin])
            avg_confidence_in_bin = np.mean(confidences[in_bin])
            ece += np.abs(avg_confidence_in_bin - accuracy_in_bin) * prop_in_bin

    return float(ece)


def evaluate_predictions(
    y_true: np.ndarray | List[int],
    y_pred: np.ndarray | List[int],
    y_prob: Optional[np.ndarray] = None,
    target_names: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Computes full evaluation suite for classification models.
    """
    y_true_arr = np.array(y_true)
    y_pred_arr = np.array(y_pred)

    acc = accuracy_score(y_true_arr, y_pred_arr)
    p_macro, r_macro, f1_macro, _ = precision_recall_fscore_support(
        y_true_arr, y_pred_arr, average="macro", zero_division=0
    )
    p_weighted, r_weighted, f1_weighted, _ = precision_recall_fscore_support(
        y_true_arr, y_pred_arr, average="weighted", zero_division=0
    )

    metrics: Dict[str, Any] = {
        "accuracy": round(float(acc), 4),
        "f1_macro": round(float(f1_macro), 4),
        "precision_macro": round(float(p_macro), 4),
        "recall_macro": round(float(r_macro), 4),
        "f1_weighted": round(float(f1_weighted), 4),
        "precision_weighted": round(float(p_weighted), 4),
        "recall_weighted": round(float(r_weighted), 4),
    }

    if y_prob is not None:
        try:
            ece = compute_expected_calibration_error(y_true_arr, y_prob)
            metrics["expected_calibration_error"] = round(float(ece), 4)
            # Binary Brier Score if 2 classes
            if y_prob.shape[1] == 2:
                metrics["brier_score"] = round(float(brier_score_loss(y_true_arr, y_prob[:, 1])), 4)
        except Exception as e:
            metrics["calibration_error_note"] = str(e)

    metrics["classification_report"] = classification_report(
        y_true_arr, y_pred_arr, target_names=target_names, output_dict=True, zero_division=0
    )

    return metrics


def save_confusion_matrix_plot(
    y_true: np.ndarray | List[int],
    y_pred: np.ndarray | List[int],
    labels: List[str],
    output_path: Path | str,
    title: str = "Confusion Matrix",
) -> None:
    """Renders and saves a confusion matrix visualization."""
    cm = confusion_matrix(y_true, y_pred)
    
    fig, ax = plt.subplots(figsize=(6, 5))
    im = ax.imshow(cm, interpolation="nearest", cmap=plt.cm.Blues)
    ax.figure.colorbar(im, ax=ax)
    
    ax.set(
        xticks=np.arange(cm.shape[1]),
        yticks=np.arange(cm.shape[0]),
        xticklabels=labels,
        yticklabels=labels,
        title=title,
        ylabel="True Label",
        xlabel="Predicted Label",
    )
    plt.setp(ax.get_xticklabels(), rotation=45, ha="right", rotation_mode="anchor")

    # Annotate values inside cells
    thresh = cm.max() / 2.0
    for i in range(cm.shape[0]):
        for j in range(cm.shape[1]):
            ax.text(
                j, i, format(cm[i, j], "d"),
                ha="center", va="center",
                color="white" if cm[i, j] > thresh else "black"
            )
            
    fig.tight_layout()
    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)
    plt.savefig(output_file, dpi=300, bbox_inches="tight")
    plt.close()
