"""
Domain-Adaptive Pre-Training (DAPT) for XLM-RoBERTa (Phase 4).
Target Architecture: xlm-roberta-base (125M parameters)
Task Objective: Masked Language Modeling (MLM) with dynamic 15% token masking
Project: J26-SE-338 / c3-model-experiments
Author: C3 - Ramanayake R. H. B. D. G. (IT23164130) / Research Team.

Scientific & Implementation Specifications:
1. Dual-Variant Ablation Study:
   - Variant 1 (packed): Full-sentence packing up to max_seq_length (256) separated by </s></s> (0% padding waste).
   - Variant 2 (dynamic): Dynamic length-grouped batching (group_by_length=True; complete sentence isolation).
2. Scientific Baseline Benchmark (PPL_0):
   - Supports --eval_baseline_only to evaluate vanilla xlm-roberta-base zero-shot on dapt_val.txt.
   - Calculates baseline loss, perplexity (exp(eval_loss)), and Top-1/Top-5 token prediction accuracy.
3. Training Safeguards against Catastrophic Forgetting:
   - Conservative learning rate: 2.5e-5 with 10% linear warmup and cosine decay.
   - AdamW with weight decay 0.01.
   - Early stopping (patience=3 evaluation steps).
4. Memory-Safe Metrics Accumulation:
   - Uses preprocess_logits_for_metrics on GPU to reduce 250k vocab logits before host transfer,
     preventing host/device OOM on 6,400+ evaluation sentences.
5. Qualitative Probe:
   - Evaluates and saves Top-5 masked token fill-in predictions across representative code-mixed probe sentences.
"""

from __future__ import annotations

import argparse
import datetime
import json
import math
import os
import random
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# Configure PyTorch CUDA memory management to eliminate fragmentation on Colab T4
os.environ["PYTORCH_CUDA_ALLOC_CONF"] = "expandable_segments:True"

# Ensure UTF-8 console output
if sys.platform.startswith('win') and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Qualitative domain probe sentences for evaluating masked token recovery
DEFAULT_PROBE_SENTENCES = [
    "mata stress eka wadi wela night <mask> ganna ba, full depressed inne.",
    "oya mata help karanna <mask> puluwanda mee assignment eka karanna.",
    "campus eke exam eka thiyena nisa mata <mask> wadi wela thiyenne.",
    "mage yaaluwa mata godak <mask> kara mama dukin inna welawata.",
    "hithata hari na wage, kawuruth na mata <mask> karanna.",
    "doctor gen <mask> ekak ganna one mata thiyena depression ekata.",
    "ada lecture eka cut karala gedara hitiya, kisi <mask> na.",
    "api okkoma ekathu wela me prashneta <mask> ekak hoyamu.",
    "මට හරිම <mask>, කිසිම දෙයක් කරගන්න හිතෙන්නෙ නෑ.",
    "campus eke friends la ekka katha karama <mask> adu wenawa."
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Phase 4: Domain-Adaptive Pre-Training (DAPT / MLM) on XLM-RoBERTa"
    )

    # Data & Paths
    parser.add_argument(
        "--train_file",
        type=str,
        default="data/adaptation/dapt_train.txt",
        help="Path to training corpus partition (plain text, one sentence per line)."
    )
    parser.add_argument(
        "--val_file",
        type=str,
        default="data/adaptation/dapt_val.txt",
        help="Path to validation corpus partition."
    )
    parser.add_argument(
        "--model_name_or_path",
        type=str,
        default="xlm-roberta-base",
        help="Hugging Face model identifier or local checkpoint path."
    )
    parser.add_argument(
        "--output_dir",
        type=str,
        default=None,
        help="Output directory for saved model checkpoints (defaults to models/xlm-roberta-dapt-{strategy})."
    )
    parser.add_argument(
        "--results_dir",
        type=str,
        default="results/dapt",
        help="Directory to save metric reports, loss curves, and evaluation JSONs."
    )

    # Strategy & Architecture
    parser.add_argument(
        "--strategy",
        type=str,
        choices=["packed", "dynamic"],
        default="packed",
        help="DAPT tokenization & batching strategy: 'packed' (RoBERTa </s></s> buffer) or 'dynamic' (length-grouped isolated sentences)."
    )
    parser.add_argument(
        "--max_seq_length",
        type=int,
        default=256,
        help="Maximum sequence length (tokens). Default: 256 (covers 97.85%% of corpus)."
    )
    parser.add_argument(
        "--mlm_probability",
        type=float,
        default=0.15,
        help="Ratio of tokens to dynamically mask for MLM objective (default: 0.15)."
    )

    # Training Hyperparameters
    parser.add_argument(
        "--per_device_train_batch_size",
        type=int,
        default=8,
        help="Train mini-batch size per device (default: 8 for Colab T4 15GB VRAM to avoid 250k vocab logits OOM)."
    )
    parser.add_argument(
        "--per_device_eval_batch_size",
        type=int,
        default=8,
        help="Evaluation batch size per device (default: 8)."
    )
    parser.add_argument(
        "--gradient_accumulation_steps",
        type=int,
        default=8,
        help="Number of update steps to accumulate before performing backward pass (effective batch size: 8 * 8 = 64)."
    )
    parser.add_argument(
        "--learning_rate",
        type=float,
        default=2.5e-5,
        help="Initial peak learning rate for AdamW (conservative rate to prevent catastrophic forgetting)."
    )
    parser.add_argument(
        "--weight_decay",
        type=float,
        default=0.01,
        help="Weight decay for AdamW optimizer."
    )
    parser.add_argument(
        "--num_train_epochs",
        type=float,
        default=3.0,
        help="Total number of training epochs."
    )
    parser.add_argument(
        "--warmup_ratio",
        type=float,
        default=0.10,
        help="Fraction of total training steps used for linear warmup."
    )
    parser.add_argument(
        "--logging_steps",
        type=int,
        default=100,
        help="Log training metrics every N steps."
    )
    parser.add_argument(
        "--eval_steps",
        type=int,
        default=500,
        help="Run evaluation on dapt_val.txt every N steps."
    )
    parser.add_argument(
        "--save_steps",
        type=int,
        default=500,
        help="Save model checkpoint every N steps."
    )
    parser.add_argument(
        "--early_stopping_patience",
        type=int,
        default=3,
        help="Stop training if validation perplexity fails to improve for N evaluation checks."
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed for deterministic initialization."
    )
    parser.add_argument(
        "--no_fp16",
        action="store_true",
        help="Disable FP16 mixed precision training."
    )
    parser.add_argument(
        "--gradient_checkpointing",
        action="store_true",
        default=False,
        help="Enable gradient checkpointing to reduce activation VRAM footprint if needed."
    )

    # Baseline & Qualitative Evaluation Flags
    parser.add_argument(
        "--eval_baseline_only",
        action="store_true",
        help="Evaluate off-the-shelf vanilla model zero-shot on dapt_val.txt without training (Step 0 PPL_0 benchmark)."
    )
    parser.add_argument(
        "--run_qualitative_eval",
        action="store_true",
        default=True,
        help="Run qualitative probe sentence evaluation on masked token candidates."
    )

    return parser.parse_args()


def check_torch_environment():
    """Validates that PyTorch and CUDA are properly configured."""
    try:
        import torch
    except ImportError:
        print("\n" + "=" * 70, file=sys.stderr)
        print("ERROR: PyTorch ('torch') is not installed in the current environment.", file=sys.stderr)
        print("Domain-Adaptive Pre-Training requires PyTorch and GPU acceleration.", file=sys.stderr)
        print("\nTo train on Google Colab (Free T4 GPU):", file=sys.stderr)
        print("  Open and execute: notebooks/04_dapt_pretraining_colab.ipynb", file=sys.stderr)
        print("\nTo install PyTorch locally (with CUDA support):", file=sys.stderr)
        print("  pip install torch --index-url https://download.pytorch.org/whl/cu118", file=sys.stderr)
        print("=" * 70 + "\n", file=sys.stderr)
        sys.exit(1)

    device = "cuda" if torch.cuda.is_available() else "cpu"
    device_name = torch.cuda.get_device_name(0) if torch.cuda.is_available() else "CPU"
    print(f"[Device Setup] PyTorch version: {torch.__version__} | Active Device: {device} ({device_name})")
    if device == "cpu":
        print("[Warning] CUDA is not available. Training transformer models on CPU will be extremely slow.")
        print("[Recommendation] Use Google Colab (NVIDIA T4) via notebooks/04_dapt_pretraining_colab.ipynb.")
    return device


def load_raw_lines(file_path: str) -> List[str]:
    """Reads non-empty stripped lines from corpus partition."""
    path = Path(file_path)
    if not path.is_file():
        raise FileNotFoundError(f"Corpus partition not found at: {file_path}")
    with open(path, "r", encoding="utf-8") as f:
        lines = [line.strip() for line in f if line.strip()]
    return lines


def build_packed_dataset(lines: List[str], tokenizer: Any, max_seq_length: int) -> Any:
    """
    Variant 1 (Strategy 1): RoBERTa Full-Sentence Packing.
    Tokenizes all sentences and concatenates tokens with </s> delimiter into fixed-size blocks of length max_seq_length.
    Yields 0% padding waste.
    """
    from datasets import Dataset

    print(f"[Data Preparation] Packing {len(lines):,} sentences into {max_seq_length}-token contiguous blocks...")
    t0 = time.time()

    # Tokenize in fast batches without special tokens (we insert delimiters manually)
    tokenized = tokenizer(
        lines,
        add_special_tokens=False,
        truncation=False,
        return_attention_mask=False,
        verbose=False
    )["input_ids"]

    # In XLM-RoBERTa: bos_token_id=0 (<s>), eos_token_id=2 (</s>)
    eos_id = tokenizer.eos_token_id
    bos_id = tokenizer.bos_token_id

    # Flatten into a continuous stream with </s> delimiters between sentences
    stream: List[int] = []
    for seq in tokenized:
        if seq:
            stream.extend(seq)
            stream.append(eos_id)

    total_stream_tokens = len(stream)
    # Target chunk capacity: each block will have <s> at start and </s> at end
    chunk_inner_len = max_seq_length - 2
    total_blocks = total_stream_tokens // chunk_inner_len

    # Slice into blocks
    input_ids_list: List[List[int]] = []
    attention_mask_list: List[List[int]] = []

    for i in range(total_blocks):
        start_idx = i * chunk_inner_len
        end_idx = start_idx + chunk_inner_len
        block_tokens = [bos_id] + stream[start_idx:end_idx] + [eos_id]
        input_ids_list.append(block_tokens)
        attention_mask_list.append([1] * max_seq_length)

    elapsed = time.time() - t0
    print(f"[Data Preparation] Packed {total_stream_tokens:,} tokens into {len(input_ids_list):,} full blocks "
          f"(0% padding waste) in {elapsed:.2f}s.")

    return Dataset.from_dict({
        "input_ids": input_ids_list,
        "attention_mask": attention_mask_list
    })


def build_dynamic_dataset(lines: List[str], tokenizer: Any, max_seq_length: int) -> Any:
    """
    Variant 2 (Strategy 3): Dynamic Length-Grouped Batching.
    Tokenizes sentences individually with <s> sentence </s> without cross-sentence concatenation.
    Keeps conversational boundaries strictly isolated.
    """
    from datasets import Dataset

    print(f"[Data Preparation] Preparing {len(lines):,} isolated sequences (max_seq_length={max_seq_length})...")
    t0 = time.time()

    # Tokenize individually with truncation up to max_seq_length
    encodings = tokenizer(
        lines,
        add_special_tokens=True,
        truncation=True,
        max_length=max_seq_length,
        return_attention_mask=True,
        return_length=True,
        verbose=False
    )

    elapsed = time.time() - t0
    print(f"[Data Preparation] Tokenized {len(lines):,} isolated sequences in {elapsed:.2f}s.")

    dataset_dict = {
        "input_ids": encodings["input_ids"],
        "attention_mask": encodings["attention_mask"],
        "length": encodings["length"]
    }
    return Dataset.from_dict(dataset_dict)


def preprocess_logits_for_metrics(logits: Any, labels: Any) -> Tuple[Any, Any]:
    """
    Memory-Safe Logit Preprocessing:
    Calculates Top-1 and Top-5 prediction indices directly on the GPU.
    Reduces the 250,002 vocabulary dimension down to 1 and 5 ints per token,
    preventing multi-gigabyte RAM OOM crashes when evaluating 6,400+ sentences.
    """
    import torch
    if isinstance(logits, tuple):
        logits = logits[0]
    top1 = logits.argmax(dim=-1)
    top5 = logits.topk(5, dim=-1).indices
    return top1, top5


def compute_metrics(eval_preds: Any) -> Dict[str, float]:
    """
    Computes masked token Top-1 and Top-5 accuracy across masked positions only.
    """
    import numpy as np

    (top1, top5), labels = eval_preds.predictions, eval_preds.label_ids
    mask = (labels != -100)
    masked_labels = labels[mask]

    if len(masked_labels) == 0:
        return {"top1_accuracy": 0.0, "top5_accuracy": 0.0}

    top1_masked = top1[mask]
    top5_masked = top5[mask]

    top1_correct = (top1_masked == masked_labels).sum()
    top1_acc = float(top1_correct) / len(masked_labels)

    # top5_masked shape: (N, 5), masked_labels[:, None] shape: (N, 1)
    top5_correct = (top5_masked == masked_labels[:, None]).any(axis=-1).sum()
    top5_acc = float(top5_correct) / len(masked_labels)

    return {
        "top1_accuracy": round(top1_acc * 100.0, 2),
        "top5_accuracy": round(top5_acc * 100.0, 2),
    }


def evaluate_qualitative_predictions(
    model: Any,
    tokenizer: Any,
    device: str,
    probe_sentences: Optional[List[str]] = None
) -> List[Dict[str, Any]]:
    """
    Generates qualitative predictions for sample sentences with <mask> tokens.
    """
    import torch

    sentences = probe_sentences or DEFAULT_PROBE_SENTENCES
    mask_token = tokenizer.mask_token
    mask_token_id = tokenizer.mask_token_id

    model.eval()
    results = []

    with torch.no_grad():
        for sent in sentences:
            if mask_token not in sent:
                continue
            inputs = tokenizer(sent, return_tensors="pt").to(device)
            input_ids = inputs["input_ids"][0]
            mask_positions = (input_ids == mask_token_id).nonzero(as_tuple=True)[0]

            if len(mask_positions) == 0:
                continue

            outputs = model(**inputs)
            logits = outputs.logits[0]

            pos = mask_positions[0].item()
            mask_logits = logits[pos]
            topk = torch.topk(mask_logits, k=5)
            top_ids = topk.indices.tolist()
            top_probs = torch.softmax(mask_logits, dim=-1)[top_ids].tolist()

            candidates = []
            for tid, prob in zip(top_ids, top_probs):
                subword = tokenizer.decode([tid]).strip()
                candidates.append({"token": subword, "probability": round(prob, 4)})

            results.append({
                "probe_sentence": sent,
                "top5_candidates": candidates
            })

    return results


def build_compatible_training_arguments(**raw_kwargs) -> Any:
    """
    Builds TrainingArguments filtered strictly against the active transformers version signature,
    preventing any unexpected keyword argument errors across transformers v4 and v5.
    """
    from transformers import TrainingArguments
    import inspect

    sig = inspect.signature(TrainingArguments.__init__).parameters
    filtered = {k: v for k, v in raw_kwargs.items() if k in sig}
    return TrainingArguments(**filtered)


def run_baseline_evaluation(args: argparse.Namespace) -> Dict[str, Any]:
    """
    Step 0: Pre-Training Control Benchmark (PPL_0).
    Evaluates off-the-shelf unadapted xlm-roberta-base on dapt_val.txt zero-shot.
    """
    import torch
    from transformers import (
        AutoTokenizer,
        AutoModelForMaskedLM,
        DataCollatorForLanguageModeling,
        Trainer,
        TrainingArguments
    )

    print("\n" + "=" * 70)
    print("STEP 0: BASELINE ZERO-SHOT EVALUATION ON dapt_val.txt")
    print(f"Model: {args.model_name_or_path} (Off-the-shelf vanilla weights)")
    print("=" * 70)

    device = check_torch_environment()
    tokenizer = AutoTokenizer.from_pretrained(args.model_name_or_path)
    model = AutoModelForMaskedLM.from_pretrained(args.model_name_or_path).to(device)

    val_lines = load_raw_lines(args.val_file)
    print(f"Loaded {len(val_lines):,} validation sentences from: {args.val_file}")

    # Build evaluation dataset
    val_dataset = build_dynamic_dataset(val_lines, tokenizer, args.max_seq_length)

    data_collator = DataCollatorForLanguageModeling(
        tokenizer=tokenizer,
        mlm=True,
        mlm_probability=args.mlm_probability,
        pad_to_multiple_of=8 if (device == "cuda" and not args.no_fp16) else None
    )

    eval_output_dir = os.path.join(args.results_dir, "temp_baseline_eval")
    training_args = build_compatible_training_arguments(
        output_dir=eval_output_dir,
        per_device_eval_batch_size=args.per_device_eval_batch_size,
        dataloader_drop_last=False,
        report_to="none",
        fp16=(device == "cuda" and not args.no_fp16)
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        eval_dataset=val_dataset,
        data_collator=data_collator,
        compute_metrics=compute_metrics,
        preprocess_logits_for_metrics=preprocess_logits_for_metrics
    )

    print("\nRunning zero-shot baseline evaluation...")
    eval_start = time.time()
    metrics = trainer.evaluate()
    eval_elapsed = time.time() - eval_start

    eval_loss = metrics.get("eval_loss", 0.0)
    perplexity = math.exp(eval_loss) if eval_loss < 20.0 else float("inf")
    top1_acc = metrics.get("eval_top1_accuracy", 0.0)
    top5_acc = metrics.get("eval_top5_accuracy", 0.0)

    print("\n" + "-" * 50)
    print("BASELINE ZERO-SHOT BENCHMARK RESULTS (PPL_0):")
    print(f"  Validation MLM Loss (L_val_base): {eval_loss:.4f}")
    print(f"  Baseline Perplexity (PPL_base)  : {perplexity:.2f}")
    print(f"  Top-1 Masked Token Accuracy     : {top1_acc:.2f}%")
    print(f"  Top-5 Masked Token Accuracy     : {top5_acc:.2f}%")
    print(f"  Evaluation Duration             : {eval_elapsed:.2f}s")
    print("-" * 50)

    qualitative_samples = []
    if args.run_qualitative_eval:
        print("\nSampling qualitative probe predictions (Baseline model)...")
        qualitative_samples = evaluate_qualitative_predictions(model, tokenizer, device)

    # Save baseline JSON
    os.makedirs(args.results_dir, exist_ok=True)
    baseline_path = os.path.join(args.results_dir, "baseline_evaluation.json")
    baseline_record = {
        "timestamp": datetime.datetime.now().isoformat(),
        "model_name_or_path": args.model_name_or_path,
        "validation_file": args.val_file,
        "validation_sentence_count": len(val_lines),
        "mlm_probability": args.mlm_probability,
        "eval_loss": round(eval_loss, 4),
        "perplexity": round(perplexity, 2),
        "top1_accuracy": top1_acc,
        "top5_accuracy": top5_acc,
        "evaluation_duration_seconds": round(eval_elapsed, 2),
        "qualitative_probe_predictions": qualitative_samples
    }

    with open(baseline_path, "w", encoding="utf-8") as f:
        json.dump(baseline_record, f, indent=2, ensure_ascii=False)
    print(f"\n[Saved] Baseline evaluation record saved to: {baseline_path}")

    # Clean temporary eval directory
    if os.path.exists(eval_output_dir):
        import shutil
        shutil.rmtree(eval_output_dir, ignore_errors=True)

    return baseline_record


def run_training(args: argparse.Namespace):
    """
    Runs Domain-Adaptive Pre-Training (DAPT) under the specified strategy ('packed' or 'dynamic').
    """
    import torch
    from transformers import (
        AutoTokenizer,
        AutoModelForMaskedLM,
        DataCollatorForLanguageModeling,
        Trainer,
        TrainingArguments,
        EarlyStoppingCallback,
        set_seed
    )

    device = check_torch_environment()
    set_seed(args.seed)

    # Set default output dir if not provided
    strategy = args.strategy.lower()
    default_model_dir = f"models/xlm-roberta-dapt-{strategy}"
    output_dir = args.output_dir or default_model_dir
    os.makedirs(output_dir, exist_ok=True)
    os.makedirs(args.results_dir, exist_ok=True)

    print("\n" + "=" * 70)
    print(f"PHASE 4 DAPT TRAINING: VARIANT '{strategy.upper()}'")
    print(f"Strategy: {'Full-Sentence Packing (</s></s>)' if strategy == 'packed' else 'Dynamic Length-Grouped Batching (Isolated)'}")
    print(f"Base Model: {args.model_name_or_path}")
    print(f"Max Seq Length: {args.max_seq_length} | Batch Size: {args.per_device_train_batch_size} * {args.gradient_accumulation_steps} = {args.per_device_train_batch_size * args.gradient_accumulation_steps}")
    print(f"Peak Learning Rate: {args.learning_rate} | Warmup: {args.warmup_ratio * 100:.0f}% | Weight Decay: {args.weight_decay}")
    print(f"Target Checkpoint Dir: {output_dir}")
    print("=" * 70)

    # Load Tokenizer & Model
    tokenizer = AutoTokenizer.from_pretrained(args.model_name_or_path)
    model = AutoModelForMaskedLM.from_pretrained(args.model_name_or_path).to(device)

    # Load Datasets
    train_lines = load_raw_lines(args.train_file)
    val_lines = load_raw_lines(args.val_file)
    print(f"[Corpus] Loaded Train: {len(train_lines):,} sentences | Val: {len(val_lines):,} sentences")

    if strategy == "packed":
        train_dataset = build_packed_dataset(train_lines, tokenizer, args.max_seq_length)
        val_dataset = build_packed_dataset(val_lines, tokenizer, args.max_seq_length)
        group_by_length = False
    else:
        train_dataset = build_dynamic_dataset(train_lines, tokenizer, args.max_seq_length)
        val_dataset = build_dynamic_dataset(val_lines, tokenizer, args.max_seq_length)
        group_by_length = True

    # Data Collator with Dynamic MLM
    use_fp16 = (device == "cuda" and not args.no_fp16)
    data_collator = DataCollatorForLanguageModeling(
        tokenizer=tokenizer,
        mlm=True,
        mlm_probability=args.mlm_probability,
        pad_to_multiple_of=8 if use_fp16 else None
    )

    # Estimate total update steps for warmup calculation across transformers versions
    total_samples = len(train_dataset)
    effective_batch = args.per_device_train_batch_size * args.gradient_accumulation_steps
    steps_per_epoch = max(1, total_samples // effective_batch)
    total_steps = int(steps_per_epoch * args.num_train_epochs)
    warmup_steps = max(10, int(total_steps * args.warmup_ratio))

    # Training Arguments (Filtered dynamically for active transformers version)
    training_args = build_compatible_training_arguments(
        output_dir=output_dir,
        overwrite_output_dir=True,
        num_train_epochs=args.num_train_epochs,
        per_device_train_batch_size=args.per_device_train_batch_size,
        per_device_eval_batch_size=args.per_device_eval_batch_size,
        gradient_accumulation_steps=args.gradient_accumulation_steps,
        learning_rate=args.learning_rate,
        weight_decay=args.weight_decay,
        warmup_ratio=args.warmup_ratio,
        warmup_steps=warmup_steps,
        lr_scheduler_type="cosine",
        adam_beta1=0.9,
        adam_beta2=0.98,
        adam_epsilon=1e-6,
        eval_strategy="steps",
        evaluation_strategy="steps",
        eval_steps=args.eval_steps,
        save_strategy="steps",
        save_steps=args.save_steps,
        save_total_limit=2,
        load_best_model_at_end=True,
        metric_for_best_model="eval_loss",
        greater_is_better=False,
        logging_strategy="steps",
        logging_steps=args.logging_steps,
        fp16=use_fp16,
        report_to="none",
        seed=args.seed,
        dataloader_num_workers=2 if sys.platform != "win32" else 0,
        train_sampling_strategy="group_by_length" if group_by_length else "random",
        group_by_length=group_by_length,
        gradient_checkpointing=args.gradient_checkpointing
    )

    # Trainer with Early Stopping and Metric Callbacks
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=val_dataset,
        data_collator=data_collator,
        compute_metrics=compute_metrics,
        preprocess_logits_for_metrics=preprocess_logits_for_metrics,
        callbacks=[EarlyStoppingCallback(early_stopping_patience=args.early_stopping_patience)]
    )

    # Train
    print("\nStarting DAPT pre-training loop...")
    t_start = time.time()
    train_result = trainer.train()
    total_train_time = time.time() - t_start

    # Final Evaluation on Held-Out Validation Set
    print("\nEvaluating best checkpoint on held-out validation set...")
    final_eval_metrics = trainer.evaluate()
    final_loss = final_eval_metrics.get("eval_loss", 0.0)
    final_ppl = math.exp(final_loss) if final_loss < 20.0 else float("inf")
    final_top1 = final_eval_metrics.get("eval_top1_accuracy", 0.0)
    final_top5 = final_eval_metrics.get("eval_top5_accuracy", 0.0)

    print("\n" + "=" * 70)
    print(f"FINAL DAPT EVALUATION RESULTS ({strategy.upper()} VARIANT):")
    print(f"  Final Validation MLM Loss : {final_loss:.4f}")
    print(f"  Final Domain Perplexity   : {final_ppl:.2f}")
    print(f"  Top-1 Masked Token Acc    : {final_top1:.2f}%")
    print(f"  Top-5 Masked Token Acc    : {final_top5:.2f}%")
    print(f"  Total Training Runtime    : {datetime.timedelta(seconds=int(total_train_time))}")
    print("=" * 70)

    # Save Best Model Weights, Tokenizer, and Config
    print(f"\nSaving best model and tokenizer to: {output_dir}")
    trainer.save_model(output_dir)
    tokenizer.save_pretrained(output_dir)

    # Qualitative Evaluation
    qualitative_predictions = []
    if args.run_qualitative_eval:
        print("\nSampling qualitative probe predictions (Adapted model)...")
        qualitative_predictions = evaluate_qualitative_predictions(model, tokenizer, device)

    # Calculate Improvement over Baseline (if baseline file exists)
    baseline_ppl: Optional[float] = None
    baseline_path = os.path.join(args.results_dir, "baseline_evaluation.json")
    if os.path.isfile(baseline_path):
        try:
            with open(baseline_path, "r", encoding="utf-8") as bf:
                base_data = json.load(bf)
                baseline_ppl = base_data.get("perplexity")
        except Exception:
            pass

    delta_ppl = round(baseline_ppl - final_ppl, 2) if baseline_ppl else None
    pct_reduction = round(((baseline_ppl - final_ppl) / baseline_ppl) * 100.0, 2) if baseline_ppl else None

    # Construct Metrics Record
    metrics_record = {
        "variant": f"DAPT-{strategy.capitalize()}",
        "strategy": strategy,
        "base_model": args.model_name_or_path,
        "output_dir": output_dir,
        "hyperparameters": {
            "max_seq_length": args.max_seq_length,
            "per_device_train_batch_size": args.per_device_train_batch_size,
            "gradient_accumulation_steps": args.gradient_accumulation_steps,
            "effective_batch_size": args.per_device_train_batch_size * args.gradient_accumulation_steps,
            "learning_rate": args.learning_rate,
            "weight_decay": args.weight_decay,
            "warmup_ratio": args.warmup_ratio,
            "num_train_epochs": args.num_train_epochs,
            "fp16": use_fp16,
            "seed": args.seed
        },
        "results": {
            "final_eval_loss": round(final_loss, 4),
            "final_perplexity": round(final_ppl, 2),
            "baseline_perplexity": baseline_ppl,
            "delta_perplexity": delta_ppl,
            "percent_perplexity_reduction": pct_reduction,
            "top1_accuracy": final_top1,
            "top5_accuracy": final_top5,
            "global_steps": trainer.state.global_step,
            "total_epochs": trainer.state.epoch,
            "total_runtime_seconds": round(total_train_time, 2),
            "runtime_formatted": str(datetime.timedelta(seconds=int(total_train_time)))
        },
        "qualitative_probe_predictions": qualitative_predictions,
        "training_loss_history": [
            log for log in trainer.state.log_history if "loss" in log or "eval_loss" in log
        ]
    }

    metrics_file = os.path.join(args.results_dir, f"metrics_{strategy}.json")
    with open(metrics_file, "w", encoding="utf-8") as f:
        json.dump(metrics_record, f, indent=2, ensure_ascii=False)
    print(f"[Saved] Metrics record saved to: {metrics_file}")

    # Also update the joint ablation summary if both exist
    update_ablation_summary(args.results_dir)


def update_ablation_summary(results_dir: str):
    """
    Checks if metrics_packed.json and metrics_dynamic.json exist and creates/updates
    dapt_ablation_summary.json.
    """
    packed_file = os.path.join(results_dir, "metrics_packed.json")
    dynamic_file = os.path.join(results_dir, "metrics_dynamic.json")
    baseline_file = os.path.join(results_dir, "baseline_evaluation.json")

    ablation_summary: Dict[str, Any] = {
        "timestamp": datetime.datetime.now().isoformat(),
        "variants": {}
    }

    if os.path.isfile(baseline_file):
        with open(baseline_file, "r", encoding="utf-8") as f:
            ablation_summary["baseline"] = json.load(f)

    if os.path.isfile(packed_file):
        with open(packed_file, "r", encoding="utf-8") as f:
            ablation_summary["variants"]["packed"] = json.load(f)

    if os.path.isfile(dynamic_file):
        with open(dynamic_file, "r", encoding="utf-8") as f:
            ablation_summary["variants"]["dynamic"] = json.load(f)

    if "packed" in ablation_summary["variants"] or "dynamic" in ablation_summary["variants"]:
        summary_path = os.path.join(results_dir, "dapt_ablation_summary.json")
        with open(summary_path, "w", encoding="utf-8") as f:
            json.dump(ablation_summary, f, indent=2, ensure_ascii=False)
        print(f"[Saved] Ablation summary updated: {summary_path}")


def main():
    args = parse_args()

    if args.eval_baseline_only:
        run_baseline_evaluation(args)
    else:
        run_training(args)


if __name__ == "__main__":
    main()
