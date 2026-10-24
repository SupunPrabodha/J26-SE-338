"""
Conservative, Affect-Preserving Preprocessor for Sinhala-English Corpus.
Owner: C3 - Ramanayake R. H. B. D. G. (IT23164130)

Preprocesses raw student text for Domain-Adaptive Pretraining (DAPT) on XLM-RoBERTa:
1. HTML entity decoding (first)
2. URL & YouTube sticker shortcode cleaning
3. Unicode NFC Normalization (canonical composite representations)
4. Evidence-backed ZWJ ligature protection (Rakaransaya, Yansaya, combined emojis)
5. Punctuation flood regularization without artificial whitespace injection
6. Quality validation (preserving short distress phrases, casing, emojis, and informal Singlish)
7. Exact deduplication & automated JSON audit reporting
"""

from __future__ import annotations

import html
import json
import re
import sys
import unicodedata
from pathlib import Path
from typing import Dict, Any, List, Set, Tuple

# Ensure UTF-8 stdout on Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


# Compile regex patterns for efficiency
URL_PATTERN = re.compile(r"https?://\S+|www\.\S+|youtu\.be/\S+", re.IGNORECASE)
YT_STICKER_PATTERN = re.compile(r":[a-zA-Z0-9_ -]+:")
PUNCT_FLOOD_QUESTION = re.compile(r"\?{3,}")
PUNCT_FLOOD_EXCLAMATION = re.compile(r"!{3,}")
PUNCT_FLOOD_PERIOD = re.compile(r"\.{4,}")
WHITESPACE_PATTERN = re.compile(r"\s+")
LINGUISTIC_CHAR_PATTERN = re.compile(r"[a-zA-Z\u0D80-\u0DFF]")

# Pattern for stray / orphaned zero-width spaces or stray ZWJ not part of ligatures
# Valid Sinhala ligatures: Virama (\u0DCA) + ZWJ (\u200D) + Consonant (e.g. \u0DBB, \u0DBA)
# Valid Emoji ligatures: Emoji / Variation Selector + ZWJ + Emoji
ZWSP_ORPHAN_PATTERN = re.compile(r"[\u200B\uFEFF]|\u200D\s|\s\u200D")


def clean_sentence(raw_text: str) -> Tuple[str, Dict[str, bool]]:
    """
    Applies the conservative, affect-preserving cleaning pipeline to a single text line.
    Returns:
        (cleaned_sentence, transformations_applied_flags)
    """
    flags = {
        "html_decoded": False,
        "url_removed": False,
        "sticker_removed": False,
        "nfc_normalized": False,
        "zwj_preserved": False,
        "orphan_zw_removed": False,
        "punct_regularized": False,
    }

    if not isinstance(raw_text, str) or not raw_text.strip():
        return "", flags

    text = raw_text.strip()

    # Step 1: HTML Entity Decoding (first)
    if "&" in text:
        decoded = html.unescape(text)
        if decoded != text:
            flags["html_decoded"] = True
            text = decoded

    # Step 2: Strip URLs
    if URL_PATTERN.search(text):
        text = URL_PATTERN.sub("", text)
        flags["url_removed"] = True

    # Step 3: Strip YouTube sticker shortcodes (e.g. :face-purple-crying:)
    if YT_STICKER_PATTERN.search(text):
        text = YT_STICKER_PATTERN.sub("", text)
        flags["sticker_removed"] = True

    # Step 4: Unicode NFC Normalization
    nfc_text = unicodedata.normalize("NFC", text)
    if nfc_text != text:
        flags["nfc_normalized"] = True
        text = nfc_text

    # Step 5: Clean only stray/orphaned zero-width spaces, strictly preserving ligatures
    if "\u200d" in text:
        flags["zwj_preserved"] = True
    if ZWSP_ORPHAN_PATTERN.search(text):
        text = ZWSP_ORPHAN_PATTERN.sub("", text)
        flags["orphan_zw_removed"] = True

    # Step 6: Regularize extreme punctuation floods without injecting arbitrary spaces
    p_orig = text
    text = PUNCT_FLOOD_QUESTION.sub("??", text)
    text = PUNCT_FLOOD_EXCLAMATION.sub("!!", text)
    text = PUNCT_FLOOD_PERIOD.sub("...", text)
    if text != p_orig:
        flags["punct_regularized"] = True

    # Step 7: Collapse whitespace
    text = WHITESPACE_PATTERN.sub(" ", text).strip()

    # Step 8: Linguistic Quality Check
    # Ensure line contains at least one genuine linguistic character (Sinhala or English)
    if not LINGUISTIC_CHAR_PATTERN.search(text):
        return "", flags

    return text, flags


def process_corpus(
    input_file: Path | str,
    output_clean_file: Path | str,
    output_audit_file: Path | str,
) -> Dict[str, Any]:
    """
    Executes conservative preprocessing across the entire unified corpus file.
    """
    in_path = Path(input_file)
    out_clean_path = Path(output_clean_file)
    out_audit_path = Path(output_audit_file)

    if not in_path.exists():
        raise FileNotFoundError(f"Input corpus not found at: {in_path.resolve()}")

    print(f"\n=======================================================")
    print(f" PREPROCESSING CORPUS: {in_path.name}")
    print(f"=======================================================")

    with open(in_path, "r", encoding="utf-8", errors="ignore") as f:
        raw_lines = [line.strip() for line in f if line.strip()]

    total_input_lines = len(raw_lines)
    print(f"Total Raw Lines In: {total_input_lines:,}")

    seen_sentences: Set[str] = set()
    cleaned_sentences: List[str] = []

    stats = {
        "total_input_lines": total_input_lines,
        "html_decoded_count": 0,
        "url_removed_count": 0,
        "sticker_removed_count": 0,
        "nfc_normalized_count": 0,
        "zwj_ligatures_protected": 0,
        "orphan_zw_removed_count": 0,
        "punct_regularized_count": 0,
        "discarded_non_linguistic_count": 0,
        "exact_duplicates_removed": 0,
        "final_cleaned_lines": 0,
    }

    sample_diffs: List[Dict[str, str]] = []

    for orig_line in raw_lines:
        cleaned, flags = clean_sentence(orig_line)

        # Track transformation metrics
        if flags["html_decoded"]:
            stats["html_decoded_count"] += 1
        if flags["url_removed"]:
            stats["url_removed_count"] += 1
        if flags["sticker_removed"]:
            stats["sticker_removed_count"] += 1
        if flags["nfc_normalized"]:
            stats["nfc_normalized_count"] += 1
        if flags["zwj_preserved"]:
            stats["zwj_ligatures_protected"] += 1
        if flags["orphan_zw_removed"]:
            stats["orphan_zw_removed_count"] += 1
        if flags["punct_regularized"]:
            stats["punct_regularized_count"] += 1

        # Check linguistic quality
        if not cleaned:
            stats["discarded_non_linguistic_count"] += 1
            continue

        # Record diff samples for inspection
        if cleaned != orig_line and len(sample_diffs) < 10:
            sample_diffs.append({
                "original": orig_line,
                "cleaned": cleaned
            })

        # Exact Deduplication
        if cleaned in seen_sentences:
            stats["exact_duplicates_removed"] += 1
        else:
            seen_sentences.add(cleaned)
            cleaned_sentences.append(cleaned)

    stats["final_cleaned_lines"] = len(cleaned_sentences)

    # Export cleaned corpus
    out_clean_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_clean_path, "w", encoding="utf-8") as f:
        for s in cleaned_sentences:
            f.write(s + "\n")

    # Export audit report
    audit_data = {
        "metadata": {
            "source_file": in_path.name,
            "target_file": out_clean_path.name,
            "owner": "C3 - Ramanayake R. H. B. D. G. (IT23164130)",
            "pipeline": "Conservative Affect-Preserving Preprocessor v1.0",
        },
        "statistics": stats,
        "sample_transformations": sample_diffs,
    }

    out_audit_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_audit_path, "w", encoding="utf-8") as f:
        json.dump(audit_data, f, ensure_ascii=False, indent=2)

    print("\n--- PREPROCESSING AUDIT SUMMARY ---")
    print(f"✓ Input lines:                   {stats['total_input_lines']:,}")
    print(f"✓ NFC normalizations applied:    {stats['nfc_normalized_count']:,}")
    print(f"✓ ZWJ ligatures protected:       {stats['zwj_ligatures_protected']:,}")
    print(f"✓ Stickers/shortcodes cleaned:   {stats['sticker_removed_count']:,}")
    print(f"✓ Punctuation floods normalized: {stats['punct_regularized_count']:,}")
    print(f"✓ Non-linguistic lines dropped:  {stats['discarded_non_linguistic_count']:,}")
    print(f"✓ Exact duplicates removed:      {stats['exact_duplicates_removed']:,}")
    print(f"✓ Final Cleaned Sentences:       {stats['final_cleaned_lines']:,}")
    print(f"\nCleaned corpus written to: {out_clean_path.resolve()}")
    print(f"Detailed audit log saved to: {out_audit_path.resolve()}")
    print("=======================================================\n")

    return stats


if __name__ == "__main__":
    base_adaptation_dir = Path(__file__).resolve().parent.parent / "data" / "adaptation"
    in_file = base_adaptation_dir / "youtube_unified_corpus.txt"
    out_file = base_adaptation_dir / "youtube_corpus_cleaned.txt"
    audit_file = base_adaptation_dir / "preprocessing_audit_report.json"

    process_corpus(
        input_file=in_file,
        output_clean_file=out_file,
        output_audit_file=audit_file,
    )
