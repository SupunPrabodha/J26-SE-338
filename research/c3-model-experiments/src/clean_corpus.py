"""
Enhanced Normalization & Cleaning Pipeline for Sinhala-English Code-Mixed Corpus.
Target Architecture: XLM-RoBERTa (xlm-roberta-base) Continued Pre-Training (DAPT / MLM).
Project: J26-SE-338 / c3-model-experiments
Domain: Sinhala Unicode Script + Romanized Singlish Code-Mixed Text.

Pipeline Specifications (Phase 1):
1. UTF-8 BOM & Stray Zero-Width Space Stripping (with Strict ZWJ \u200D Ligature Protection)
2. HTML Entity Decoding (canonical unescaping)
3. BBCode Markup & Cloudflare Artifact Stripping ([FONT], [QUOTE], [email protected])
4. Spaced Redaction Substitution ([USER], [URL_REDACTED], [PHONE_REDACTED], [EMAIL_REDACTED])
5. Decorative Unicode Glyphs & Bullets Stripping (•, ·, ★, ✔, █, ░, etc.)
6. Non-Alphanumeric Symbol Flood Collapsing ($$$$, ****, ++++, ====, ~~~~ to max 1-2)
7. Grawlix / Typographic Profanity Masking Scrubbing (e.g. $%#%$, P@#, hu#@@, @#$ta, while protecting C#, R&D, etc.)
8. Forum Markdown Formatting Stripping (*word*, _word_, ~word~)
9. Word-Glued Punctuation & Slash Spacing (separates word(word) and word/word while strictly preserving A/L, O/L)
10. Phonetic Character & Punctuation De-elongation (collapsing 3+ repeats to at most 2)
11. Unicode NFC Normalization (canonical composite representations for Sinhala diacritics)
12. Whitespace Normalization (collapsing tabs, non-breaking spaces, and multi-spaces)
13. Selective Quality & Length Filtering (dropping <3 words & non-linguistic noise; preserving 3+ word thoughts)
14. Exact Deduplication
15. Automated JSON Audit Reporting & Sample Difference Logging
"""

from __future__ import annotations

import argparse
import html
import json
import os
import re
import sys
import unicodedata
from pathlib import Path
from typing import Dict, Any, List, Set, Tuple

# Configure UTF-8 for Windows console
if sys.platform.startswith('win') and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# ==============================================================================
# COMPILED REGEX PATTERNS (OPTIMIZED FOR HIGH-THROUGHPUT PROCESSING)
# ==============================================================================

# Redaction tokens: Substitute with whitespace to prevent fusing adjoining morphemes
REDACTION_PATTERN = re.compile(
    r'\[(URL_REDACTED|USER|PHONE_REDACTED|EMAIL_REDACTED)\]',
    re.IGNORECASE
)

# Cloudflare email obfuscation artifact
CLOUDFLARE_PATTERN = re.compile(r'\[email protected\]', re.IGNORECASE)

# BBCode tags (e.g. [FONT=&quot], [/FONT], [SIZE=4], [/SIZE], [QUOTE], [/QUOTE], [B], [/B])
BBCODE_PATTERN = re.compile(r'\[/?[a-zA-Z0-9_-]+(?:=[^\]]*)?\]')

# Forum colon smilies (e.g. :sorry:, :rolleyes:, :D, :p)
SMILIE_PATTERN = re.compile(r':[a-zA-Z0-9_-]+:')

# Raw URLs and links
URL_PATTERN = re.compile(r'https?://\S+|www\.\S+|youtu\.be/\S+', re.IGNORECASE)

# Decorative Unicode glyphs, bullet points, stars, and box-drawing blocks
DECORATIVE_GLYPHS_PATTERN = re.compile(r'[•·●■◆▲►◄★☆✔✓♦♣♠♥™©®█░▒▓]')

# Non-alphanumeric symbol floods (e.g. $$$$$$ -> $, ****** -> *, +++++ -> +)
SYMBOL_FLOOD_PATTERN = re.compile(r'([\$#\*\~=\+\_\^><\|\/\\`])\1+')

# Protected technical / financial acronyms & currencies from grawlix cleaner
PROTECTED_TOKENS = {
    'c#', 'f#', 'q&a', 'r&d', 's&p', 't&c', 'p&l', 'at&t',
    'b&w', 'm&e', 'h&m', 'm&a', 'o&m'
}
CURRENCY_PCT_PATTERN = re.compile(r'^[\$£€]?\d+(?:\.\d+)?%?$')

# Forum markdown formatting around words (*word*, _word_, ~word~)
MARKDOWN_STAR_PATTERN = re.compile(r'(?<![\w\u0D80-\u0DFF])\*([\w\u0D80-\u0DFF\u200D]+)\*(?![\w\u0D80-\u0DFF])')
MARKDOWN_UNDER_PATTERN = re.compile(r'(?<![\w\u0D80-\u0DFF])_([\w\u0D80-\u0DFF\u200D]+)_(?![\w\u0D80-\u0DFF])')
MARKDOWN_TILDE_PATTERN = re.compile(r'(?<![\w\u0D80-\u0DFF])~([\w\u0D80-\u0DFF\u200D]+)~(?![\w\u0D80-\u0DFF])')

# Brackets glued directly to words: word(word) -> word (word)
BRACKET_OPEN_GLUE_PATTERN = re.compile(r'([\w\u0D80-\u0DFF\u200D])\(')
BRACKET_CLOSE_GLUE_PATTERN = re.compile(r'\)([\w\u0D80-\u0DFF\u200D])')

# Slashes glued to words (e.g. Resources/salli -> Resources / salli), while PRESERVING A/L, O/L, a/l, o/l
SLASH_GLUE_PATTERN = re.compile(r'(?<!\b[AOao])/(?![Ll]\b)')

# Phonetic character elongation (collapses 3+ repeated letters to at most 2)
CHAR_ELONGATION_PATTERN = re.compile(r'([a-zA-Z\u0D80-\u0DFF])\1{2,}', re.IGNORECASE)

# Extreme punctuation floods
PUNCT_FLOOD_QUESTION = re.compile(r'\?{3,}')
PUNCT_FLOOD_EXCLAMATION = re.compile(r'!{3,}')
PUNCT_FLOOD_PERIOD = re.compile(r'\.{3,}')
PUNCT_FLOOD_OTHER = re.compile(r'([,-])\1{2,}')

# Stray / orphaned zero-width spaces or stray ZWJ not part of ligatures
# Valid Sinhala ligatures: Virama (\u0DCA) + ZWJ (\u200D) + Consonant (\u0DBB, \u0DBA, etc.)
# We explicitly preserve valid ZWJ while stripping BOM (\uFEFF) and ZWSP (\u200B)
BOM_ZWSP_ORPHAN_PATTERN = re.compile(r'[\u200B\uFEFF]|\u200D\s|\s\u200D')

# Whitespace collapsing
WHITESPACE_PATTERN = re.compile(r'\s+')

# Genuine linguistic characters (Sinhala Unicode or Latin English)
LINGUISTIC_CHAR_PATTERN = re.compile(r'[a-zA-Z\u0D80-\u0DFF]')


def scrub_grawlix(text: str) -> Tuple[str, bool]:
    """
    Scrubs grawlix / typographic profanity masking clusters (e.g. P@#, hu#@@, $%#%$, @#$ta),
    while strictly protecting C#, F#, Q&A, R&D, percentages, and currencies.
    """
    words = text.split()
    cleaned_words = []
    grawlix_found = False

    for w in words:
        stripped = w.strip('.,!?:;"\'()[]{}')
        low = stripped.lower()

        # Preserve protected programming languages, finance tokens, and valid currencies/percentages
        if low in PROTECTED_TOKENS or CURRENCY_PCT_PATTERN.match(stripped):
            cleaned_words.append(w)
            continue

        # Count profanity mask symbols
        sym_count = sum(1 for c in stripped if c in '@#$%^&*~')

        # Check for grawlix patterns
        is_grawlix = (
            sym_count >= 2 or
            (sym_count == 1 and any(low.startswith(p) for p in ['p@', 'h@', 'f@', 'w@', 'k@', 'h#', 'f#', 'p#', 'k#']))
        )

        if is_grawlix:
            grawlix_found = True
            continue

        cleaned_words.append(w)

    return ' '.join(cleaned_words), grawlix_found


def clean_text_line(
    raw_text: str,
    max_char_repeats: int = 2,
    max_punct_repeats: int = 2,
) -> Tuple[str, Dict[str, bool]]:
    """
    Cleans a single line of text according to the enhanced Phase 1 specifications.
    Returns:
        (cleaned_text, flags_dict)
    """
    flags = {
        'html_decoded': False,
        'bbcode_removed': False,
        'cloudflare_removed': False,
        'redaction_spaced': False,
        'url_removed': False,
        'smilie_removed': False,
        'decorative_glyphs_removed': False,
        'symbol_flood_collapsed': False,
        'grawlix_scrubbed': False,
        'markdown_cleaned': False,
        'glued_punct_spaced': False,
        'char_deelongated': False,
        'punct_regularized': False,
        'nfc_normalized': False,
        'zwj_preserved': False,
        'orphan_zw_removed': False,
    }

    if not isinstance(raw_text, str) or not raw_text.strip():
        return '', flags

    text = raw_text.strip()

    # Step 1: Strip BOM & Orphaned zero-width spaces (strictly preserve ZWJ \u200D)
    if '\u200d' in text:
        flags['zwj_preserved'] = True
    if BOM_ZWSP_ORPHAN_PATTERN.search(text):
        text = BOM_ZWSP_ORPHAN_PATTERN.sub('', text)
        flags['orphan_zw_removed'] = True

    # Step 2: HTML Entity Decoding (first)
    if '&' in text:
        decoded = html.unescape(text)
        if decoded != text:
            flags['html_decoded'] = True
            text = decoded

    # Step 3: Cloudflare Obfuscation Stripping
    if CLOUDFLARE_PATTERN.search(text):
        text = CLOUDFLARE_PATTERN.sub(' ', text)
        flags['cloudflare_removed'] = True

    # Step 4: BBCode Tag Removal
    if BBCODE_PATTERN.search(text):
        text = BBCODE_PATTERN.sub(' ', text)
        flags['bbcode_removed'] = True

    # Step 5: Redaction Token Spacing
    if REDACTION_PATTERN.search(text):
        text = REDACTION_PATTERN.sub(' ', text)
        flags['redaction_spaced'] = True

    # Step 6: Raw URLs & Links Removal
    if URL_PATTERN.search(text):
        text = URL_PATTERN.sub(' ', text)
        flags['url_removed'] = True

    # Step 7: Colon Smilies Removal
    if SMILIE_PATTERN.search(text):
        text = SMILIE_PATTERN.sub(' ', text)
        flags['smilie_removed'] = True

    # Step 8: Decorative Glyphs, Bullets & Box Blocks Removal
    if DECORATIVE_GLYPHS_PATTERN.search(text):
        text = DECORATIVE_GLYPHS_PATTERN.sub(' ', text)
        flags['decorative_glyphs_removed'] = True

    # Step 9: Non-Alphanumeric Symbol Flood Collapsing (e.g. $$$$$$ -> $, ****** -> *)
    if SYMBOL_FLOOD_PATTERN.search(text):
        text = SYMBOL_FLOOD_PATTERN.sub(r'\1', text)
        flags['symbol_flood_collapsed'] = True

    # Step 10: Grawlix / Typographic Profanity Masking Scrubbing
    text, grawlix_found = scrub_grawlix(text)
    if grawlix_found:
        flags['grawlix_scrubbed'] = True

    # Step 11: Forum Markdown Formatting Stripping (*word*, _word_, ~word~)
    orig_md = text
    text = MARKDOWN_STAR_PATTERN.sub(r'\1', text)
    text = MARKDOWN_UNDER_PATTERN.sub(r'\1', text)
    text = MARKDOWN_TILDE_PATTERN.sub(r'\1', text)
    if text != orig_md:
        flags['markdown_cleaned'] = True

    # Step 12: Spaced Brackets & Slashes (protecting A/L, O/L)
    orig_glue = text
    text = BRACKET_OPEN_GLUE_PATTERN.sub(r'\1 (', text)
    text = BRACKET_CLOSE_GLUE_PATTERN.sub(r') \1', text)
    text = SLASH_GLUE_PATTERN.sub(' / ', text)
    if text != orig_glue:
        flags['glued_punct_spaced'] = True

    # Step 13: Phonetic Character De-elongation (e.g. aneeeee -> anee)
    if CHAR_ELONGATION_PATTERN.search(text):
        text = CHAR_ELONGATION_PATTERN.sub(r'\1\1', text)
        flags['char_deelongated'] = True

    # Step 14: Punctuation Flood Regularization
    p_orig = text
    text = PUNCT_FLOOD_QUESTION.sub('??', text)
    text = PUNCT_FLOOD_EXCLAMATION.sub('!!', text)
    text = PUNCT_FLOOD_PERIOD.sub('..', text)
    text = PUNCT_FLOOD_OTHER.sub(r'\1\1', text)
    if text != p_orig:
        flags['punct_regularized'] = True

    # Step 15: Unicode NFC Normalization (canonical composite vowel signs)
    nfc_text = unicodedata.normalize('NFC', text)
    if nfc_text != text:
        flags['nfc_normalized'] = True
        text = nfc_text

    # Step 16: Whitespace Normalization
    text = WHITESPACE_PATTERN.sub(' ', text).strip()

    return text, flags


def run_pipeline(
    input_path: Path | str,
    output_clean_path: Path | str,
    output_audit_path: Path | str,
    min_words: int = 3,
    min_chars: int = 12,
) -> Dict[str, Any]:
    """
    Executes the complete Phase 1 pipeline over the input file, exports cleaned
    corpus and comprehensive JSON audit report.
    """
    in_file = Path(input_path).resolve()
    out_clean = Path(output_clean_path).resolve()
    out_audit = Path(output_audit_path).resolve()

    if not in_file.exists():
        raise FileNotFoundError(f'Input corpus file not found: {in_file}')

    print('=' * 70)
    print(' PHASE 1: ENHANCED NORMALIZATION & CLEANING PIPELINE (WITH GRAWLIX PASS)')
    print(' Project: J26-SE-338 / c3-model-experiments')
    print(f' Input File  : {in_file}')
    print(f' Output File : {out_clean}')
    print(f' Audit File  : {out_audit}')
    print(f' Thresholds  : min_words={min_words}, min_chars={min_chars}')
    print('=' * 70)

    with open(in_file, 'r', encoding='utf-8', errors='replace') as f:
        raw_lines = [line.strip() for line in f if line.strip()]

    total_input = len(raw_lines)
    print(f'[*] Loaded {total_input:,} non-empty raw lines.')

    seen_sentences: Set[str] = set()
    cleaned_sentences: List[str] = []

    stats: Dict[str, Any] = {
        'total_input_lines': total_input,
        'html_decoded_count': 0,
        'bbcode_removed_count': 0,
        'cloudflare_removed_count': 0,
        'redaction_spaced_count': 0,
        'url_removed_count': 0,
        'smilie_removed_count': 0,
        'decorative_glyphs_removed_count': 0,
        'symbol_flood_collapsed_count': 0,
        'grawlix_scrubbed_count': 0,
        'markdown_cleaned_count': 0,
        'glued_punct_spaced_count': 0,
        'char_deelongated_count': 0,
        'punct_regularized_count': 0,
        'nfc_normalized_count': 0,
        'zwj_ligatures_protected': 0,
        'orphan_zw_removed_count': 0,
        'dropped_under_min_words': 0,
        'dropped_under_min_chars': 0,
        'dropped_non_linguistic': 0,
        'exact_duplicates_removed': 0,
        'final_cleaned_lines': 0,
        'raw_total_words': 0,
        'clean_total_words': 0,
    }

    sample_transformations: List[Dict[str, str]] = []

    for orig_line in raw_lines:
        orig_words = orig_line.split()
        stats['raw_total_words'] += len(orig_words)

        cleaned, flags = clean_text_line(orig_line)

        # Update flags counts
        if flags['html_decoded']:
            stats['html_decoded_count'] += 1
        if flags['bbcode_removed']:
            stats['bbcode_removed_count'] += 1
        if flags['cloudflare_removed']:
            stats['cloudflare_removed_count'] += 1
        if flags['redaction_spaced']:
            stats['redaction_spaced_count'] += 1
        if flags['url_removed']:
            stats['url_removed_count'] += 1
        if flags['smilie_removed']:
            stats['smilie_removed_count'] += 1
        if flags['decorative_glyphs_removed']:
            stats['decorative_glyphs_removed_count'] += 1
        if flags['symbol_flood_collapsed']:
            stats['symbol_flood_collapsed_count'] += 1
        if flags['grawlix_scrubbed']:
            stats['grawlix_scrubbed_count'] += 1
        if flags['markdown_cleaned']:
            stats['markdown_cleaned_count'] += 1
        if flags['glued_punct_spaced']:
            stats['glued_punct_spaced_count'] += 1
        if flags['char_deelongated']:
            stats['char_deelongated_count'] += 1
        if flags['punct_regularized']:
            stats['punct_regularized_count'] += 1
        if flags['nfc_normalized']:
            stats['nfc_normalized_count'] += 1
        if flags['zwj_preserved']:
            stats['zwj_ligatures_protected'] += 1
        if flags['orphan_zw_removed']:
            stats['orphan_zw_removed_count'] += 1

        # Check linguistic character presence
        if not LINGUISTIC_CHAR_PATTERN.search(cleaned):
            stats['dropped_non_linguistic'] += 1
            continue

        # Check length constraints
        cleaned_words = cleaned.split()
        if len(cleaned_words) < min_words:
            stats['dropped_under_min_words'] += 1
            continue

        if len(cleaned) < min_chars:
            stats['dropped_under_min_chars'] += 1
            continue

        # Record diff samples for inspection (up to 20 samples)
        if cleaned != orig_line and len(sample_transformations) < 20:
            sample_transformations.append({
                'original': orig_line[:120],
                'cleaned': cleaned[:120],
            })

        # Deduplication
        if cleaned in seen_sentences:
            stats['exact_duplicates_removed'] += 1
        else:
            seen_sentences.add(cleaned)
            cleaned_sentences.append(cleaned)
            stats['clean_total_words'] += len(cleaned_words)

    stats['final_cleaned_lines'] = len(cleaned_sentences)

    # Write output cleaned corpus
    out_clean.parent.mkdir(parents=True, exist_ok=True)
    with open(out_clean, 'w', encoding='utf-8') as f:
        for s in cleaned_sentences:
            f.write(s + '\n')

    # Write JSON audit report
    audit_payload = {
        'metadata': {
            'project': 'J26-SE-338 / c3-model-experiments',
            'phase': 'Phase 1: Enhanced Normalization & Cleaning Pipeline (Grawlix Scrubbing)',
            'target_model': 'XLM-RoBERTa (xlm-roberta-base) DAPT/MLM',
            'source_file': str(in_file),
            'target_file': str(out_clean),
            'min_words_threshold': min_words,
            'min_chars_threshold': min_chars,
        },
        'statistics': stats,
        'sample_transformations': sample_transformations,
    }

    out_audit.parent.mkdir(parents=True, exist_ok=True)
    with open(out_audit, 'w', encoding='utf-8') as f:
        json.dump(audit_payload, f, ensure_ascii=False, indent=2)

    print('\n' + '-' * 70)
    print(' PHASE 1 AUDIT SUMMARY REPORT')
    print('-' * 70)
    print(f'  Input Raw Lines                : {stats["total_input_lines"]:,}')
    print(f'  HTML Unescaping Applied        : {stats["html_decoded_count"]:,}')
    print(f'  BBCode Tags Removed            : {stats["bbcode_removed_count"]:,}')
    print(f'  Cloudflare Artifacts Cleared   : {stats["cloudflare_removed_count"]:,}')
    print(f'  Redaction Tags Spaced          : {stats["redaction_spaced_count"]:,}')
    print(f'  Raw URLs Stripped              : {stats["url_removed_count"]:,}')
    print(f'  Smilies Stripped               : {stats["smilie_removed_count"]:,}')
    print(f'  Decorative Bullets/Glyphs Purged: {stats["decorative_glyphs_removed_count"]:,}')
    print(f'  Symbol Floods Collapsed        : {stats["symbol_flood_collapsed_count"]:,}')
    print(f'  Grawlix / Profanity Scrubbed   : {stats["grawlix_scrubbed_count"]:,}')
    print(f'  Markdown *word* Stripped       : {stats["markdown_cleaned_count"]:,}')
    print(f'  Glued Punctuation Spaced       : {stats["glued_punct_spaced_count"]:,}')
    print(f'  Character Repeats Collapsed    : {stats["char_deelongated_count"]:,}')
    print(f'  Punctuation Floods Regularized : {stats["punct_regularized_count"]:,}')
    print(f'  Unicode NFC Normalized         : {stats["nfc_normalized_count"]:,}')
    print(f'  Sinhala ZWJ Protected          : {stats["zwj_ligatures_protected"]:,}')
    print(f'  Dropped Under Min Words (<{min_words})  : {stats["dropped_under_min_words"]:,}')
    print(f'  Dropped Under Min Chars (<{min_chars}): {stats["dropped_under_min_chars"]:,}')
    print(f'  Dropped Non-Linguistic Noise   : {stats["dropped_non_linguistic"]:,}')
    print(f'  Exact Duplicates Removed       : {stats["exact_duplicates_removed"]:,}')
    print(f'  => FINAL CLEANED SENTENCES     : {stats["final_cleaned_lines"]:,}')
    print(f'  => TOTAL CLEANED WORDS         : {stats["clean_total_words"]:,}')
    print(f'  Retention Rate                 : {stats["final_cleaned_lines"] / stats["total_input_lines"] * 100:.2f}%')
    print('-' * 70)
    print(f'[+] Cleaned corpus exported to: {out_clean}')
    print(f'[+] Audit report exported to  : {out_audit}')
    print('=' * 70)

    return stats


def main():
    parser = argparse.ArgumentParser(
        description='Enhanced Normalization & Cleaning Pipeline for Sinhala-English Code-Mixed Corpus (Phase 1).'
    )
    base_dir = Path(__file__).resolve().parent.parent / 'data' / 'adaptation'

    parser.add_argument(
        '--input',
        type=str,
        default=str(base_dir / 'texts.txt'),
        help='Path to raw input corpus (default: data/adaptation/texts.txt)',
    )
    parser.add_argument(
        '--output',
        type=str,
        default=str(base_dir / 'clean_corpus.txt'),
        help='Path to output cleaned corpus (default: data/adaptation/clean_corpus.txt)',
    )
    parser.add_argument(
        '--audit',
        type=str,
        default=str(base_dir / 'cleaning_audit_report.json'),
        help='Path to output JSON audit log (default: data/adaptation/cleaning_audit_report.json)',
    )
    parser.add_argument(
        '--min-words',
        type=int,
        default=3,
        help='Minimum words required per line (default: 3)',
    )
    parser.add_argument(
        '--min-chars',
        type=int,
        default=12,
        help='Minimum characters required per line (default: 12)',
    )

    args = parser.parse_args()

    run_pipeline(
        input_path=args.input,
        output_clean_path=args.output,
        output_audit_path=args.audit,
        min_words=args.min_words,
        min_chars=args.min_chars,
    )


if __name__ == '__main__':
    main()
