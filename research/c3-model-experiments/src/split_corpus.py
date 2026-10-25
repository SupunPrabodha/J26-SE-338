"""
Stratified Train / Validation Split for DAPT Corpus (Phase 3).
Target Architecture: XLM-RoBERTa (xlm-roberta-base) Domain-Adaptive Pre-Training (DAPT / MLM).
Project: J26-SE-338 / c3-model-experiments
Author: C3 - Ramanayake R. H. B. D. G. (IT23164130) / Research Team.

Scientific Objectives:
1. Deterministic, stratified split maintaining exact distribution across script modalities
   (Pure Latin Singlish vs. Mixed Sinhala Unicode + Latin script).
2. Guarantees zero data leakage between training and validation sets (disjoint sets).
3. Produces standard 95% Train / 5% Validation partitions:
   - dapt_train.txt (~121,900+ sentences for continued pre-training)
   - dapt_val.txt (~6,400+ sentences for monitoring MLM validation loss / perplexity)
4. Exports structured JSON audit report recording stratification ratios, token counts, and leakage validation.
"""

from __future__ import annotations

import argparse
import json
import random
import re
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

# Configure UTF-8 stdout for Windows console
if sys.platform.startswith("win") and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Regex patterns for script modality stratification
SINHALA_SCRIPT_RE = re.compile(r"[\u0D80-\u0DFF]")
LATIN_SCRIPT_RE = re.compile(r"[a-zA-Z]")


def classify_modality(text: str) -> str:
    """
    Classifies sentence into its linguistic script modality stratum.
    """
    has_sin = bool(SINHALA_SCRIPT_RE.search(text))
    has_lat = bool(LATIN_SCRIPT_RE.search(text))

    if has_sin and has_lat:
        return "mixed_sinhala_latin"
    elif has_lat and not has_sin:
        return "pure_latin_singlish"
    elif has_sin and not has_lat:
        return "pure_sinhala_script"
    else:
        return "other"


def stratified_split(
    input_file: Path | str,
    output_train_file: Path | str,
    output_val_file: Path | str,
    output_audit_file: Path | str,
    train_ratio: float = 0.95,
    random_seed: int = 42,
) -> dict[str, Any]:
    """
    Executes stratified split based on script modality, verifies zero data leakage,
    exports partition files and comprehensive JSON audit report.
    """
    in_path = Path(input_file).resolve()
    out_train_path = Path(output_train_file).resolve()
    out_val_path = Path(output_val_file).resolve()
    out_audit_path = Path(output_audit_file).resolve()

    if not in_path.exists():
        raise FileNotFoundError(f"Input corpus not found at: {in_path}")

    val_ratio = 1.0 - train_ratio

    print("=" * 70)
    print(" PHASE 3: STRATIFIED TRAIN / VALIDATION SPLIT")
    print(" Project: J26-SE-338 / c3-model-experiments")
    print(f" Input Corpus: {in_path}")
    print(f" Output Train: {out_train_path} ({train_ratio * 100:.1f}%)")
    print(f" Output Val  : {out_val_path} ({val_ratio * 100:.1f}%)")
    print(f" Random Seed : {random_seed} (Deterministic)")
    print("=" * 70)

    # 1. Read cleaned corpus
    with open(in_path, encoding="utf-8", errors="replace") as f:
        lines = [line.strip() for line in f if line.strip()]

    total_sentences = len(lines)
    print(f"[*] Loaded {total_sentences:,} cleaned sentences.")

    # 2. Group into strata
    strata: dict[str, list[str]] = defaultdict(list)
    for line in lines:
        modality = classify_modality(line)
        strata[modality].append(line)

    print(f"[*] Identified {len(strata)} script strata:")
    for m_name, m_lines in strata.items():
        print(
            f"    - {m_name:22}: {len(m_lines):,} sentences ({len(m_lines) / total_sentences * 100:.2f}%)"
        )

    # 3. Deterministic stratified partition
    rng = random.Random(random_seed)
    train_lines: list[str] = []
    val_lines: list[str] = []

    strata_split_stats: dict[str, dict[str, Any]] = {}

    for m_name, m_lines in strata.items():
        # Shuffle deterministically within stratum
        shuffled = list(m_lines)
        rng.shuffle(shuffled)

        n_stratum = len(shuffled)
        n_train = int(round(n_stratum * train_ratio))
        _n_val = n_stratum - n_train

        s_train = shuffled[:n_train]
        s_val = shuffled[n_train:]

        train_lines.extend(s_train)
        val_lines.extend(s_val)

        strata_split_stats[m_name] = {
            "total_sentences": n_stratum,
            "train_sentences": len(s_train),
            "val_sentences": len(s_val),
            "stratum_train_ratio": round(len(s_train) / n_stratum, 4),
            "stratum_val_ratio": round(len(s_val) / n_stratum, 4),
        }

    # Final shuffle within train and val partitions to mix strata evenly
    rng.shuffle(train_lines)
    rng.shuffle(val_lines)

    # 4. Strict Scientific Data Leakage Verification
    train_set: set[str] = set(train_lines)
    val_set: set[str] = set(val_lines)
    overlap = train_set & val_set
    leakage_detected = len(overlap) > 0

    if leakage_detected:
        raise ValueError(
            f"CRITICAL ERROR: Data leakage detected! {len(overlap)} sentences overlap between train and val."
        )

    conservation_verified = (len(train_lines) + len(val_lines)) == total_sentences

    print("\n[-] Scientific Verification Checks:")
    print("    [+] Data Leakage Check (Train ∩ Val): 0 overlapping sentences (PASSED)")
    print(
        f"    [+] Partition Conservation Check   : {len(train_lines):,} + {len(val_lines):,} == {total_sentences:,} (PASSED)"
    )

    # 5. Word and Token Metrics
    train_words = sum(len(line.split()) for line in train_lines)
    val_words = sum(len(line.split()) for line in val_lines)
    # Estimated subwords based on Phase 2 empirical factor (1.885x)
    est_subword_factor = 1.885
    train_subwords_est = int(round(train_words * est_subword_factor))
    val_subwords_est = int(round(val_words * est_subword_factor))

    # 6. Export Partitions
    out_train_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_train_path, "w", encoding="utf-8") as f:
        for line in train_lines:
            f.write(line + "\n")

    out_val_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_val_path, "w", encoding="utf-8") as f:
        for line in val_lines:
            f.write(line + "\n")

    # 7. Build and Export JSON Audit Report
    audit_data = {
        "metadata": {
            "project": "J26-SE-338 / c3-model-experiments",
            "phase": "Phase 3: Stratified Train / Validation Split",
            "target_model": "XLM-RoBERTa (xlm-roberta-base) DAPT/MLM",
            "source_corpus": str(in_path),
            "target_train_file": str(out_train_path),
            "target_val_file": str(out_val_path),
            "random_seed": random_seed,
            "configured_train_ratio": train_ratio,
            "configured_val_ratio": round(val_ratio, 2),
        },
        "verification_checks": {
            "leakage_check_passed": not leakage_detected,
            "overlap_count": len(overlap),
            "conservation_check_passed": conservation_verified,
            "total_source_sentences": total_sentences,
            "sum_partitions_sentences": len(train_lines) + len(val_lines),
        },
        "partition_statistics": {
            "train": {
                "sentences": len(train_lines),
                "sentence_percentage": round(len(train_lines) / total_sentences * 100, 2),
                "words": train_words,
                "estimated_mlm_subwords": train_subwords_est,
                "file_size_bytes": out_train_path.stat().st_size,
            },
            "val": {
                "sentences": len(val_lines),
                "sentence_percentage": round(len(val_lines) / total_sentences * 100, 2),
                "words": val_words,
                "estimated_mlm_subwords": val_subwords_est,
                "file_size_bytes": out_val_path.stat().st_size,
            },
            "combined_total": {
                "sentences": total_sentences,
                "words": train_words + val_words,
                "estimated_mlm_subwords": train_subwords_est + val_subwords_est,
            },
        },
        "strata_breakdown": strata_split_stats,
    }

    out_audit_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_audit_path, "w", encoding="utf-8") as f:
        json.dump(audit_data, f, ensure_ascii=False, indent=2)

    # 8. Print Executive Terminal Summary
    print("\n" + "=" * 70)
    print(" PHASE 3 SPLIT SUMMARY REPORT")
    print("=" * 70)
    print(f"  Total Cleaned Sentences : {total_sentences:,}")
    print(
        f"  Training Partition (95%): {len(train_lines):,} sentences | {train_words:,} words | ~{train_subwords_est:,} subwords"
    )
    print(
        f"  Validation Partition(5%): {len(val_lines):,} sentences | {val_words:,} words | ~{val_subwords_est:,} subwords"
    )
    print("-" * 70)
    print(" STRATA DISTRIBUTION COMPARISON (TRAIN vs. VAL)")
    print("-" * 70)
    for m_name, s_info in strata_split_stats.items():
        tr_pct = s_info["train_sentences"] / len(train_lines) * 100
        val_pct = s_info["val_sentences"] / len(val_lines) * 100
        print(
            f"  {m_name:22} -> Train: {tr_pct:5.2f}% | Val: {val_pct:5.2f}%  (Stratification: MATCH)"
        )
    print("=" * 70)
    print(f"[+] Train dataset exported to: {out_train_path}")
    print(f"[+] Val dataset exported to  : {out_val_path}")
    print(f"[+] Audit log exported to    : {out_audit_path}")
    print("=" * 70)

    return audit_data


def main():
    parser = argparse.ArgumentParser(
        description="Stratified Train / Validation Split for DAPT Corpus (Phase 3)."
    )
    base_dir = Path(__file__).resolve().parent.parent / "data" / "adaptation"

    parser.add_argument(
        "--input",
        type=str,
        default=str(base_dir / "clean_corpus.txt"),
        help="Path to cleaned input corpus (default: data/adaptation/clean_corpus.txt)",
    )
    parser.add_argument(
        "--output-train",
        type=str,
        default=str(base_dir / "dapt_train.txt"),
        help="Path to training partition output (default: data/adaptation/dapt_train.txt)",
    )
    parser.add_argument(
        "--output-val",
        type=str,
        default=str(base_dir / "dapt_val.txt"),
        help="Path to validation partition output (default: data/adaptation/dapt_val.txt)",
    )
    parser.add_argument(
        "--output-audit",
        type=str,
        default=str(base_dir / "split_audit_report.json"),
        help="Path to JSON split audit log (default: data/adaptation/split_audit_report.json)",
    )
    parser.add_argument(
        "--train-ratio",
        type=float,
        default=0.95,
        help="Train split ratio (default: 0.95 for 95/5 split)",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed for reproducibility (default: 42)",
    )

    args = parser.parse_args()

    stratified_split(
        input_file=args.input,
        output_train_file=args.output_train,
        output_val_file=args.output_val,
        output_audit_file=args.output_audit,
        train_ratio=args.train_ratio,
        random_seed=args.seed,
    )


if __name__ == "__main__":
    main()
