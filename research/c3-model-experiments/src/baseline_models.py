"""
Stage A Baseline Models (TF-IDF with Logistic Regression and Support Vector Machine).
Owner: C3 - Ramanayake R. H. B. D. G. (IT23164130)

Trains classical ML baselines on Dreaddit and GoEmotions 80% train splits
and evaluates on the 20% held-out test splits to establish the performance floor.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

# Add current src directory to sys.path so imports resolve both in IDE and across execution CWDs
CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

import json
from typing import Dict, Any

import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.svm import LinearSVC
from sklearn.calibration import CalibratedClassifierCV
from sklearn.pipeline import Pipeline

from data_loader import load_dreaddit_dataset, load_goemotions_dataset, EKMAN_LABELS  # type: ignore
from metrics import evaluate_predictions, save_confusion_matrix_plot  # type: ignore


def train_and_eval_pipeline(
    train_df: pd.DataFrame,
    test_df: pd.DataFrame,
    classifier_name: str,
    target_names: list[str],
    dataset_name: str,
    output_dir: Path,
) -> Dict[str, Any]:
    """Builds, trains, and evaluates a TF-IDF + Classifier pipeline."""
    output_dir.mkdir(parents=True, exist_ok=True)
    
    if classifier_name == "LogisticRegression":
        clf = LogisticRegression(max_iter=1000, C=1.0, random_state=42)
    elif classifier_name == "SVM":
        base_svc = LinearSVC(C=1.0, random_state=42)
        clf = CalibratedClassifierCV(estimator=base_svc)
    else:
        raise ValueError(f"Unknown classifier: {classifier_name}")

    pipeline = Pipeline([
        ("tfidf", TfidfVectorizer(ngram_range=(1, 2), max_features=10000, sublinear_tf=True)),
        ("clf", clf),
    ])

    print(f"Training {classifier_name} on {dataset_name} ({len(train_df)} samples)...")
    pipeline.fit(train_df["text"], train_df["label"])

    y_pred = pipeline.predict(test_df["text"])
    y_prob = pipeline.predict_proba(test_df["text"])

    metrics = evaluate_predictions(
        y_true=test_df["label"].values,
        y_pred=y_pred,
        y_prob=y_prob,
        target_names=target_names,
    )

    # Save confusion matrix figure
    cm_path = output_dir / f"cm_{dataset_name}_{classifier_name}.png"
    save_confusion_matrix_plot(
        y_true=test_df["label"].values,
        y_pred=y_pred,
        labels=target_names,
        output_path=cm_path,
        title=f"{dataset_name} - {classifier_name} Confusion Matrix",
    )

    print(f"[{dataset_name} | {classifier_name}] Test Results:")
    print(f"  Accuracy:    {metrics['accuracy']:.4f}")
    print(f"  Macro F1:    {metrics['f1_macro']:.4f}")
    print(f"  Weighted F1: {metrics['f1_weighted']:.4f}")
    if "expected_calibration_error" in metrics:
        print(f"  ECE:         {metrics['expected_calibration_error']:.4f}")
    print("-" * 50)
    
    return metrics


def run_all_baselines(output_dir: str = "results/baselines") -> Dict[str, Any]:
    """Runs all TF-IDF baselines on Dreaddit and GoEmotions."""
    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)
    
    all_results: Dict[str, Any] = {}

    # 1. Dreaddit Benchmarks
    print("\n==========================================")
    print(" 1. Running Dreaddit (Stress) Baselines")
    print("==========================================")
    d_train, d_test = load_dreaddit_dataset()
    dreaddit_targets = ["Non-Stress", "Stress"]

    all_results["dreaddit"] = {
        "LogisticRegression": train_and_eval_pipeline(
            d_train, d_test, "LogisticRegression", dreaddit_targets, "Dreaddit", out_path
        ),
        "SVM": train_and_eval_pipeline(
            d_train, d_test, "SVM", dreaddit_targets, "Dreaddit", out_path
        ),
    }

    # 2. GoEmotions Benchmarks
    print("\n==========================================")
    print(" 2. Running GoEmotions (Emotion) Baselines")
    print("==========================================")
    g_train, g_test = load_goemotions_dataset(use_ekman=True)
    goemotions_targets = [EKMAN_LABELS[i] for i in range(len(EKMAN_LABELS))]

    all_results["goemotions"] = {
        "LogisticRegression": train_and_eval_pipeline(
            g_train, g_test, "LogisticRegression", goemotions_targets, "GoEmotions", out_path
        ),
        "SVM": train_and_eval_pipeline(
            g_train, g_test, "SVM", goemotions_targets, "GoEmotions", out_path
        ),
    }

    summary_file = out_path / "baseline_summary.json"
    with open(summary_file, "w", encoding="utf-8") as f:
        json.dump(all_results, f, indent=2)

    print(f"\nAll baseline results saved to: {summary_file}")
    return all_results


if __name__ == "__main__":
    # If run directly inside src/, use parent results directory
    default_out = CURRENT_DIR.parent / "results" / "baselines"
    run_all_baselines(output_dir=str(default_out))
