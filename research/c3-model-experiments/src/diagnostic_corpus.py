"""
Diagnostic Auditor for YouTube Unified Corpus.
Owner: C3 - Ramanayake R. H. B. D. G. (IT23164130)

Audits:
1. Unicode NFC Normalization impact & diffs
2. Zero-Width Joiner (ZWJ \\u200D) and Zero-Width characters context
3. HTML entities and raw URLs
4. Short sentences (1-2 words) to check emotional signal retention
5. Character elongations (3+ repeated characters)
"""

from __future__ import annotations

import html
import re
import sys
import unicodedata
from collections import Counter
from pathlib import Path

# Ensure UTF-8 stdout on Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def run_corpus_diagnostic(corpus_path: Path | str) -> None:
    path = Path(corpus_path)
    if not path.exists():
        print(f"Error: Corpus file not found at: {path}")
        return

    print(f"\n=======================================================")
    print(f" CORPUS DIAGNOSTIC REPORT: {path.name}")
    print(f"=======================================================")

    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        lines = [line.strip() for line in f if line.strip()]

    total_lines = len(lines)
    print(f"Total Lines Loaded: {total_lines:,}\n")

    # 1. Unicode NFC Normalization Audit
    nfc_diff_samples = []
    nfc_diff_count = 0
    for line in lines:
        nfc_norm = unicodedata.normalize("NFC", line)
        if line != nfc_norm:
            nfc_diff_count += 1
            if len(nfc_diff_samples) < 5:
                nfc_diff_samples.append((line, nfc_norm))

    print("--- 1. Unicode NFC Normalization ---")
    print(f"Lines altered by NFC normalization: {nfc_diff_count} ({nfc_diff_count/total_lines*100:.2f}%)")
    if nfc_diff_samples:
        print("Sample NFC changes (Original -> Normalized):")
        for orig, norm in nfc_diff_samples[:3]:
            print(f"   Original:   {orig}")
            print(f"   Normalized: {norm}\n")

    # 2. Zero-Width Characters & ZWJ Context Audit
    zwj_count = 0
    zwnj_count = 0
    zwsp_count = 0
    zwj_contexts = Counter()
    zwj_samples = []

    for line in lines:
        if "\u200d" in line:
            zwj_count += 1
            if len(zwj_samples) < 5:
                zwj_samples.append(line)
            # Find context around ZWJ: prev char + ZWJ + next char
            for m in re.finditer(r"(.)\u200d(.)?", line):
                prev_c = m.group(1)
                next_c = m.group(2) if m.group(2) else "[END]"
                prev_hex = f"\\u{ord(prev_c):04x}"
                next_hex = f"\\u{ord(next_c):04x}" if next_c != "[END]" else "[END]"
                zwj_contexts[f"{prev_c}({prev_hex}) + ZWJ + {next_c}({next_hex})"] += 1

        if "\u200c" in line:
            zwnj_count += 1
        if "\u200b" in line or "\ufeff" in line:
            zwsp_count += 1

    print("--- 2. Zero-Width Characters Audit ---")
    print(f"Lines containing ZWJ (\\u200D):                 {zwj_count} ({zwj_count/total_lines*100:.2f}%)")
    print(f"Lines containing ZWNJ (\\u200C):                {zwnj_count}")
    print(f"Lines containing Zero-Width Spaces (\\u200B/BOM): {zwsp_count}")
    print("\nMost Common ZWJ Contexts (Top 5):")
    for ctx, count in zwj_contexts.most_common(5):
        print(f"   {ctx}: {count} occurrences")
    print("\nSample lines with ZWJ:")
    for s in zwj_samples[:3]:
        print(f"   • {s}")

    # 3. HTML Entities & URLs Audit
    html_entity_pattern = re.compile(r"&(?:amp|quot|#39|lt|gt|nbsp);|&#\d+;")
    url_pattern = re.compile(r"https?://\S+|www\.\S+|youtu\.be/\S+")

    html_count = sum(1 for line in lines if html_entity_pattern.search(line))
    url_count = sum(1 for line in lines if url_pattern.search(line))

    print(f"\n--- 3. Technical Noise Audit ---")
    print(f"Lines with HTML entities (&amp;, &#39;, etc.): {html_count} ({html_count/total_lines*100:.2f}%)")
    print(f"Lines with URLs (http/www/youtu.be):          {url_count} ({url_count/total_lines*100:.2f}%)")

    # 4. Short Sentences Audit (1-2 words)
    short_sentences = [line for line in lines if len(line.split()) in (1, 2)]
    print(f"\n--- 4. Short Sentence Audit (1-2 words) ---")
    print(f"Total 1-2 word sentences: {len(short_sentences)} ({len(short_sentences)/total_lines*100:.2f}%)")
    print("Sample 1-2 word sentences:")
    for s in short_sentences[:8]:
        print(f"   • \"{s}\"")

    # 5. Character Elongation Audit (3+ repeats)
    elongation_pattern = re.compile(r"([a-zA-Z\u0D80-\u0DFF])\1{2,}")
    elongated_lines = [line for line in lines if elongation_pattern.search(line)]
    print(f"\n--- 5. Character Elongations Audit (3+ identical consecutive chars) ---")
    print(f"Lines with character elongations: {len(elongated_lines)} ({len(elongated_lines)/total_lines*100:.2f}%)")
    print("Sample elongated sentences:")
    for s in elongated_lines[:5]:
        print(f"   • \"{s}\"")

    print("\n=======================================================")
    print(" AUDIT COMPLETE")
    print("=======================================================\n")


if __name__ == "__main__":
    corpus_file = Path(__file__).resolve().parent.parent / "data" / "adaptation" / "youtube_unified_corpus.txt"
    run_corpus_diagnostic(corpus_file)
