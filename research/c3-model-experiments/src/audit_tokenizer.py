"""
XLM-RoBERTa Tokenizer Audit & Sequence Length Profiling (Phase 2).
Target Architecture: XLM-RoBERTa (xlm-roberta-base) Domain-Adaptive Pre-Training (DAPT / MLM).
Project: J26-SE-338 / c3-model-experiments
Author: C3 - Ramanayake R. H. B. D. G. (IT23164130) / Research Team.

Audit Objectives:
1. Measure unknown token (<unk>) rate to verify zero vocabulary breakdown.
2. Calculate subword-to-word fragmentation ratio across Romanized Singlish and Sinhala script.
3. Quantile sequence length distribution (P50, P75, P90, P95, P99) to recommend optimal max_seq_length.
4. Profile vocabulary utilization and top domain subwords.
5. Export structured JSON audit report for academic publication and model card documentation.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import sys
from collections import Counter
from pathlib import Path
from typing import Dict, Any, List, Tuple

# Configure UTF-8 stdout for Windows console
if sys.platform.startswith('win') and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Regex to classify script modality
SINHALA_SCRIPT_RE = re.compile(r'[඀-෿]')
LATIN_SCRIPT_RE = re.compile(r'[a-zA-Z]')


def profile_corpus_tokenization(
    input_file: Path | str,
    output_report_file: Path | str,
    model_name: str = 'xlm-roberta-base',
    batch_size: int = 2000,
    sample_count: int = 10,
) -> Dict[str, Any]:
    """
    Performs high-throughput tokenization audit on the cleaned corpus using XLM-RoBERTa.
    """
    in_path = Path(input_file).resolve()
    out_path = Path(output_report_file).resolve()

    if not in_path.exists():
        raise FileNotFoundError(f"Cleaned corpus not found at: {in_path}")

    print("=" * 70)
    print(" PHASE 2: XLM-R TOKENIZER AUDIT & SEQUENCE PROFILING")
    print(" Project: J26-SE-338 / c3-model-experiments")
    print(f" Corpus File : {in_path}")
    print(f" Output File : {out_path}")
    print(f" Model Target: {model_name}")
    print("=" * 70)

    # 1. Load HuggingFace Tokenizer
    print(f"[*] Loading pretrained tokenizer '{model_name}'...")
    from transformers import AutoTokenizer
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    vocab_size = tokenizer.vocab_size
    unk_token_id = tokenizer.unk_token_id
    bos_token_id = tokenizer.bos_token_id
    eos_token_id = tokenizer.eos_token_id
    pad_token_id = tokenizer.pad_token_id

    print(f"[+] Tokenizer loaded successfully. Fast backend: {tokenizer.is_fast}, Vocab size: {vocab_size:,}")

    # 2. Read Cleaned Corpus
    with open(in_path, 'r', encoding='utf-8', errors='replace') as f:
        lines = [line.strip() for line in f if line.strip()]

    total_lines = len(lines)
    print(f"[*] Total sentences to profile: {total_lines:,}")

    # Data collectors
    token_lengths_with_special: List[int] = []
    token_lengths_subwords_only: List[int] = []
    word_counts: List[int] = []

    total_subwords = 0
    total_words = 0
    total_unk_tokens = 0

    subword_frequency = Counter()

    # Script modality tracking
    modality_stats = {
        'pure_latin_singlish': {'sentences': 0, 'words': 0, 'subwords': 0},
        'mixed_sinhala_latin': {'sentences': 0, 'words': 0, 'subwords': 0},
        'pure_sinhala_script': {'sentences': 0, 'words': 0, 'subwords': 0},
    }

    # Samples collection
    samples_data: List[Dict[str, Any]] = []

    # 3. Batch Tokenization Loop
    total_batches = math.ceil(total_lines / batch_size)
    print(f"[*] Profiling across {total_batches} batches (batch_size={batch_size})...")

    for b_idx in range(total_batches):
        start_idx = b_idx * batch_size
        end_idx = min(start_idx + batch_size, total_lines)
        batch_lines = lines[start_idx:end_idx]

        # Fast tokenization without padding or truncation (to measure raw sentence lengths)
        encoded_batch = tokenizer(
            batch_lines,
            add_special_tokens=True,
            return_attention_mask=False,
            return_token_type_ids=False,
        )

        for i, input_ids in enumerate(encoded_batch['input_ids']):
            line_text = batch_lines[i]
            words = line_text.split()
            n_words = len(words)
            n_tokens = len(input_ids)
            # Subtract 2 for <s> and </s>
            n_subwords = max(0, n_tokens - 2)

            word_counts.append(n_words)
            token_lengths_with_special.append(n_tokens)
            token_lengths_subwords_only.append(n_subwords)

            total_words += n_words
            total_subwords += n_subwords

            # Count unk tokens and frequency
            for tid in input_ids:
                if tid == unk_token_id:
                    total_unk_tokens += 1
                elif tid not in (bos_token_id, eos_token_id, pad_token_id):
                    subword_frequency[tid] += 1

            # Modality categorization
            has_sin = bool(SINHALA_SCRIPT_RE.search(line_text))
            has_lat = bool(LATIN_SCRIPT_RE.search(line_text))

            if has_sin and has_lat:
                m_key = 'mixed_sinhala_latin'
            elif has_lat and not has_sin:
                m_key = 'pure_latin_singlish'
            else:
                m_key = 'pure_sinhala_script'

            modality_stats[m_key]['sentences'] += 1
            modality_stats[m_key]['words'] += n_words
            modality_stats[m_key]['subwords'] += n_subwords

            # Save detailed samples from the first batch
            if len(samples_data) < sample_count:
                decoded_tokens = tokenizer.convert_ids_to_tokens(input_ids)
                samples_data.append({
                    'index': len(samples_data) + 1,
                    'text': line_text,
                    'words_count': n_words,
                    'tokens_count': n_tokens,
                    'subwords': decoded_tokens,
                    'token_ids': input_ids,
                    'modality': m_key,
                })

        if (b_idx + 1) % 15 == 0 or (b_idx + 1) == total_batches:
            progress_pct = (end_idx / total_lines) * 100
            print(f"    Progress: {end_idx:,}/{total_lines:,} lines ({progress_pct:.1f}%)...")

    # 4. Statistical Calculations
    token_lengths_with_special.sort()
    n = len(token_lengths_with_special)

    p25 = token_lengths_with_special[int(n * 0.25)]
    p50 = token_lengths_with_special[int(n * 0.50)]
    p75 = token_lengths_with_special[int(n * 0.75)]
    p90 = token_lengths_with_special[int(n * 0.90)]
    p95 = token_lengths_with_special[int(n * 0.95)]
    p98 = token_lengths_with_special[int(n * 0.98)]
    p99 = token_lengths_with_special[int(n * 0.99)]
    min_len = token_lengths_with_special[0]
    max_len = token_lengths_with_special[-1]
    mean_len = sum(token_lengths_with_special) / n

    # Cumulative coverage
    cov_64 = sum(1 for x in token_lengths_with_special if x <= 64) / n * 100
    cov_128 = sum(1 for x in token_lengths_with_special if x <= 128) / n * 100
    cov_256 = sum(1 for x in token_lengths_with_special if x <= 256) / n * 100
    cov_512 = sum(1 for x in token_lengths_with_special if x <= 512) / n * 100

    # Fragmentation ratios
    overall_ratio = total_subwords / total_words if total_words > 0 else 0
    unk_rate = (total_unk_tokens / (total_subwords + total_unk_tokens)) * 100 if total_subwords > 0 else 0

    latin_ratio = (
        modality_stats['pure_latin_singlish']['subwords'] / modality_stats['pure_latin_singlish']['words']
        if modality_stats['pure_latin_singlish']['words'] > 0 else 0
    )
    mixed_ratio = (
        modality_stats['mixed_sinhala_latin']['subwords'] / modality_stats['mixed_sinhala_latin']['words']
        if modality_stats['mixed_sinhala_latin']['words'] > 0 else 0
    )

    # Top Subwords
    top_subwords_list = []
    for tid, count in subword_frequency.most_common(40):
        token_str = tokenizer.convert_ids_to_tokens(tid)
        top_subwords_list.append({
            'token_id': tid,
            'token_str': token_str,
            'count': count,
        })

    # Recommended max sequence length decision
    recommended_seq_len = 128 if cov_128 >= 95.0 else 256
    recommendation_rationale = (
        f"{cov_128:.2f}% of sentences fit completely within 128 tokens. "
        f"Setting max_seq_length=128 avoids quadratic O(N^2) attention memory waste "
        f"and speeds up training by ~3.5x compared to 256."
        if recommended_seq_len == 128 else
        f"Only {cov_128:.2f}% of sentences fit in 128 tokens, but {cov_256:.2f}% fit in 256 tokens. "
        f"Setting max_seq_length=256 preserves long conversational paragraphs."
    )

    # 5. Build Audit Payload
    report = {
        'metadata': {
            'project': 'J26-SE-338 / c3-model-experiments',
            'phase': 'Phase 2: XLM-R Tokenizer Audit & Sequence Length Profiling',
            'model_target': model_name,
            'vocab_size': vocab_size,
            'source_corpus': str(in_path),
            'total_sentences_audited': total_lines,
        },
        'tokenization_metrics': {
            'total_whitespace_words': total_words,
            'total_subword_tokens': total_subwords,
            'total_tokens_with_special': sum(token_lengths_with_special),
            'subword_fragmentation_ratio': round(overall_ratio, 3),
            'singlish_fragmentation_ratio': round(latin_ratio, 3),
            'mixed_script_fragmentation_ratio': round(mixed_ratio, 3),
            'unk_token_count': total_unk_tokens,
            'unk_token_rate_pct': round(unk_rate, 5),
            'distinct_subwords_observed': len(subword_frequency),
            'vocab_utilization_pct': round(len(subword_frequency) / vocab_size * 100, 2),
        },
        'sequence_length_distribution': {
            'min': min_len,
            'max': max_len,
            'mean': round(mean_len, 2),
            'p25': p25,
            'p50_median': p50,
            'p75': p75,
            'p90': p90,
            'p95': p95,
            'p98': p98,
            'p99': p99,
        },
        'cumulative_length_coverage': {
            'pct_within_64_tokens': round(cov_64, 2),
            'pct_within_128_tokens': round(cov_128, 2),
            'pct_within_256_tokens': round(cov_256, 2),
            'pct_within_512_tokens': round(cov_512, 2),
        },
        'pretraining_recommendation': {
            'recommended_max_seq_length': recommended_seq_len,
            'rationale': recommendation_rationale,
            'estimated_dapt_tokens': total_subwords,
        },
        'script_modality_breakdown': modality_stats,
        'top_40_frequent_subwords': top_subwords_list,
        'sample_tokenizations': samples_data,
    }

    # 6. Save JSON Report
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    # 7. Print Terminal Summary Report
    print("\n" + "=" * 70)
    print(" XLM-RoBERTa TOKENIZER AUDIT SUMMARY")
    print("=" * 70)
    print(f"  Total Cleaned Sentences Audited: {total_lines:,}")
    print(f"  Total Whitespace Words         : {total_words:,}")
    print(f"  Total Subwords Produced (MLM)  : {total_subwords:,}")
    print(f"  Subword / Word Ratio (Overall) : {overall_ratio:.2f}x (Expected: 1.3 - 1.8x)")
    print(f"  - Pure Latin Singlish Ratio    : {latin_ratio:.2f}x")
    print(f"  - Mixed Sinhala/Latin Ratio    : {mixed_ratio:.2f}x")
    print(f"  Unknown Tokens (<unk>) Count   : {total_unk_tokens:,} ({unk_rate:.5f}%) [Threshold < 0.05%]")
    print(f"  Vocabulary Utilization         : {len(subword_frequency):,} / {vocab_size:,} ({len(subword_frequency)/vocab_size*100:.2f}%)")
    print("-" * 70)
    print(" SEQUENCE LENGTH PERCENTILES (Includes <s> and </s>)")
    print("-" * 70)
    print(f"  Min : {min_len:3} tokens  | Mean: {mean_len:.1f} tokens | Max: {max_len} tokens")
    print(f"  P25 : {p25:3} tokens  | P50 : {p50:3} tokens  | P75: {p75:3} tokens")
    print(f"  P90 : {p90:3} tokens  | P95 : {p95:3} tokens  | P99: {p99:3} tokens")
    print("-" * 70)
    print(" CUMULATIVE SEQUENCE COVERAGE")
    print("-" * 70)
    print(f"  <=  64 tokens : {cov_64:6.2f}%")
    print(f"  <= 128 tokens : {cov_128:6.2f}%")
    print(f"  <= 256 tokens : {cov_256:6.2f}%")
    print(f"  <= 512 tokens : {cov_512:6.2f}%")
    print("-" * 70)
    print(f"  => RECOMMENDED max_seq_length  : {recommended_seq_len}")
    print(f"  => RATIONALE                   : {recommendation_rationale}")
    print("=" * 70)
    print(f"[+] Full audit report exported to: {out_path}")
    print("=" * 70)

    return report


def main():
    parser = argparse.ArgumentParser(
        description="XLM-RoBERTa Tokenizer Audit & Sequence Length Profiling (Phase 2)."
    )
    base_dir = Path(__file__).resolve().parent.parent / "data" / "adaptation"

    parser.add_argument(
        '--input',
        type=str,
        default=str(base_dir / "clean_corpus.txt"),
        help="Path to cleaned corpus (default: data/adaptation/clean_corpus.txt)",
    )
    parser.add_argument(
        '--output-report',
        type=str,
        default=str(base_dir / "tokenizer_audit_report.json"),
        help="Path to JSON output report (default: data/adaptation/tokenizer_audit_report.json)",
    )
    parser.add_argument(
        '--model-name',
        type=str,
        default='xlm-roberta-base',
        help="Hugging Face model identifier (default: xlm-roberta-base)",
    )
    parser.add_argument(
        '--batch-size',
        type=int,
        default=2000,
        help="Batch size for tokenization (default: 2000)",
    )

    args = parser.parse_args()

    profile_corpus_tokenization(
        input_file=args.input,
        output_report_file=args.output_report,
        model_name=args.model_name,
        batch_size=args.batch_size,
    )


if __name__ == '__main__':
    main()
