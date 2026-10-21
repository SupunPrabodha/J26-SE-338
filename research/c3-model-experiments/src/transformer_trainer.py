"""
Stage A Multilingual Transformer Fine-Tuning & Evaluation.
Owner: C3 - Ramanayake R. H. B. D. G. (IT23164130)

Compares:
1. `xlm-roberta-base` (SentencePiece tokenization, 100+ languages)
2. `bert-base-multilingual-cased` (mBERT, WordPiece tokenization, 104 languages)

Trains on 80% train splits and evaluates on the exact 20% held-out test splits.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Dict, Any, List, Optional

# Add current src directory to sys.path so imports resolve both in IDE and across execution CWDs
CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

import numpy as np
import pandas as pd

from data_loader import load_dreaddit_dataset, load_goemotions_dataset, EKMAN_LABELS  # type: ignore
from metrics import evaluate_predictions, save_confusion_matrix_plot  # type: ignore


def train_transformer_candidate(
    model_name_or_path: str,
    train_df: pd.DataFrame,
    test_df: pd.DataFrame,
    num_labels: int,
    target_names: List[str],
    dataset_name: str,
    output_dir: Path | str,
    batch_size: int = 16,
    num_epochs: int = 3,
    learning_rate: float = 2e-5,
    seed: int = 42,
) -> Dict[str, Any]:
    """Fine-tunes a transformer model candidate and evaluates on the test split."""
    try:
        import torch  # type: ignore
        from datasets import Dataset  # type: ignore
        from transformers import (  # type: ignore
            AutoTokenizer,
            AutoModelForSequenceClassification,
            Trainer,
            TrainingArguments,
            DataCollatorWithPadding,
            set_seed,
        )
    except ImportError as e:
        raise ImportError(
            f"PyTorch or Transformers is not installed in the current environment ({e}).\n"
            "Please run this on Google Colab / Kaggle with GPU, or install locally using: pip install torch transformers datasets accelerate"
        ) from e

    set_seed(seed)
    out_dir = Path(output_dir)
    model_slug = model_name_or_path.replace("/", "_")
    checkpoint_dir = out_dir / f"checkpoints_{dataset_name}_{model_slug}"
    checkpoint_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n=======================================================")
    print(f" Fine-tuning {model_name_or_path} on {dataset_name}")
    print(f" Train: {len(train_df)} samples | Test: {len(test_df)} samples | Classes: {num_labels}")
    print(f"=======================================================")

    tokenizer = AutoTokenizer.from_pretrained(model_name_or_path)
    model = AutoModelForSequenceClassification.from_pretrained(
        model_name_or_path,
        num_labels=num_labels,
    )

    def tokenize_fn(batch):
        return tokenizer(batch["text"], truncation=True, max_length=256)

    train_ds = Dataset.from_pandas(train_df[["text", "label"]])
    test_ds = Dataset.from_pandas(test_df[["text", "label"]])

    train_tokenized = train_ds.map(tokenize_fn, batched=True)
    test_tokenized = test_ds.map(tokenize_fn, batched=True)

    data_collator = DataCollatorWithPadding(tokenizer=tokenizer)

    training_args = TrainingArguments(
        output_dir=str(checkpoint_dir),
        learning_rate=learning_rate,
        per_device_train_batch_size=batch_size,
        per_device_eval_batch_size=batch_size * 2,
        num_train_epochs=num_epochs,
        weight_decay=0.01,
        eval_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,
        metric_for_best_model="eval_loss",
        greater_is_better=False,
        logging_steps=50,
        seed=seed,
        fp16=torch.cuda.is_available(),
        report_to="none",
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_tokenized,
        eval_dataset=test_tokenized,
        processing_class=tokenizer,
        data_collator=data_collator,
    )

    trainer.train()

    # Predict on test set
    predictions_output = trainer.predict(test_tokenized)
    logits = predictions_output.predictions
    probabilities = torch.softmax(torch.tensor(logits), dim=-1).numpy()
    y_pred = np.argmax(probabilities, axis=1)
    y_true = test_df["label"].values

    metrics = evaluate_predictions(
        y_true=y_true,
        y_pred=y_pred,
        y_prob=probabilities,
        target_names=target_names,
    )

    # Save confusion matrix
    cm_path = out_dir / f"cm_{dataset_name}_{model_slug}.png"
    save_confusion_matrix_plot(
        y_true=y_true,
        y_pred=y_pred,
        labels=target_names,
        output_path=cm_path,
        title=f"{dataset_name} - {model_name_or_path} Confusion Matrix",
    )

    print(f"[{dataset_name} | {model_name_or_path}] Test Evaluation:")
    print(f"  Accuracy:    {metrics['accuracy']:.4f}")
    print(f"  Macro F1:    {metrics['f1_macro']:.4f}")
    print(f"  Weighted F1: {metrics['f1_weighted']:.4f}")
    if "expected_calibration_error" in metrics:
        print(f"  ECE:         {metrics['expected_calibration_error']:.4f}")

    return metrics
