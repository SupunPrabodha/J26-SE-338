"""Bounded, frozen synthetic method evidence; never replaces runtime methods."""

import argparse
import hashlib
import json
import platform
import subprocess
import unicodedata
from collections import Counter
from importlib.metadata import version
from pathlib import Path
from statistics import mean, median
from time import perf_counter_ns

import regex
from preprocessing.language_id import identify_language
from preprocessing.pipeline import PipelineInput, run_preprocessing_pipeline
from preprocessing.text_processing import normalize_text, tokenize_text

from scripts.c2_language_id_evaluate import CASES as LANGUAGE_CASES

# Manually specified development gold, frozen before execution. Not generated
# from tokenizer predictions and not independent annotation/research validation.
# (id, metadata, input, expected normalized text, expected token sequence)
FROZEN = (
    ("si-1", "sinhala", "  මට\tබයයි.\n🙂 ", "මට බයයි. 🙂", ("මට", "බයයි", ".", "🙂")),
    ("si-2", "sinhala", "ක්‍රියා කිරීම අපහසුයි!", "ක්‍රියා කිරීම අපහසුයි!", ("ක්‍රියා", "කිරීම", "අපහසුයි", "!")),
    ("si-3", "sinhala", "මගේ නම [PERSON].", "මගේ නම [PERSON].", ("මගේ", "නම", "[PERSON]", ".")),
    (
        "en-1",
        "english",
        " I can't\nNOT sleep! 🙂 ",
        "I can't NOT sleep! 🙂",
        ("I", "can't", "NOT", "sleep", "!", "🙂"),
    ),
    (
        "en-2",
        "english",
        "A cafe\u0301, well-being.",
        "A café, well-being.",
        ("A", "café", ",", "well-being", "."),
    ),
    (
        "en-3",
        "english",
        "No\u00a0change: 12.5?",
        "No change: 12.5?",
        ("No", "change", ":", "12", ".", "5", "?"),
    ),
    (
        "ro-1",
        "romanized-si",
        "Mata exams gana dukai.",
        "Mata exams gana dukai.",
        ("Mata", "exams", "gana", "dukai", "."),
    ),
    (
        "ro-2",
        "romanized-si",
        " mage nama [PERSON]\tmt exam gna byi ",
        "mage nama [PERSON] mt exam gna byi",
        ("mage", "nama", "[PERSON]", "mt", "exam", "gna", "byi"),
    ),
    (
        "ro-3",
        "romanized-si",
        "ape grp leader [PERSON]",
        "ape grp leader [PERSON]",
        ("ape", "grp", "leader", "[PERSON]"),
    ),
    (
        "mixed-1",
        "code-mixed",
        "මට exams pressure තියෙනවා.",
        "මට exams pressure තියෙනවා.",
        ("මට", "exams", "pressure", "තියෙනවා", "."),
    ),
    (
        "mixed-2",
        "code-mixed",
        "නෑ! I am NOT okay. 👩🏽‍💻",
        "නෑ! I am NOT okay. 👩🏽‍💻",
        ("නෑ", "!", "I", "am", "NOT", "okay", ".", "👩🏽‍💻"),
    ),
    (
        "mixed-3",
        "code-mixed",
        " [EMAIL], [PHONE]; [STUDENT_ID]! ",
        "[EMAIL], [PHONE]; [STUDENT_ID]!",
        ("[EMAIL]", ",", "[PHONE]", ";", "[STUDENT_ID]", "!"),
    ),
    (
        "weak-1",
        "uncertain",
        "Hi[PERSON],[LOCATION]!",
        "Hi[PERSON],[LOCATION]!",
        ("Hi", "[PERSON]", ",", "[LOCATION]", "!"),
    ),
    ("weak-2", "uncertain", "a\u200cb?", "a\u200cb?", ("a\u200cb", "?")),
    ("empty", "unknown", " \t\n", "", ()),
    ("emoji", "unknown", "🇱🇰 ❤️ 👨‍👩‍👧‍👦", "🇱🇰 ❤️ 👨‍👩‍👧‍👦", ("🇱🇰", "❤️", "👨‍👩‍👧‍👦")),
)


def offsets_for(text, tokens):
    cursor = 0
    offsets = []
    for token in tokens:
        start = text.index(token, cursor)
        cursor = start + len(token)
        offsets.append((start, cursor))
    return tuple(offsets)


def timed(function, text):
    started = perf_counter_ns()
    result = function(text)
    return result, (perf_counter_ns() - started) / 1_000_000


def timing(values):
    return {
        "calls": len(values),
        "total_ms": sum(values),
        "mean_ms": mean(values),
        "median_ms": median(values),
        "max_ms": max(values),
    }


def evaluate():
    norm_methods = {
        "c2-nfc-whitespace-v1": normalize_text,
        "whitespace-only-reference": lambda text: " ".join(text.split()),
    }
    token_methods = {
        "c2-grapheme-words-v1": tokenize_text,
        "whitespace-split-reference": lambda text: (
            tuple(text.split()),
            offsets_for(text, text.split()),
        ),
    }
    report = {
        "evidence_status": "frozen_synthetic_development_not_independent_validation",
        "records": len(FROZEN),
        "normalization": {},
        "tokenization": {},
    }
    for name, method in norm_methods.items():
        rows, times = [], []
        for key, language, text, expected, _ in FROZEN:
            output, duration = timed(method, text)
            times.append(duration)
            rows.append(
                {
                    "case_id": key,
                    "language_metadata": language,
                    "exact_match": output == expected,
                    "non_whitespace_content_preserved_under_nfc": "".join(
                        unicodedata.normalize("NFC", output).split()
                    )
                    == "".join(unicodedata.normalize("NFC", text).split()),
                }
            )
        report["normalization"][name] = {
            "exact_matches": sum(row["exact_match"] for row in rows),
            "preservation_errors": sum(
                not row["non_whitespace_content_preserved_under_nfc"] for row in rows
            ),
            "timing": timing(times),
            "cases": rows,
        }
    for name, method in token_methods.items():
        rows, times, totals = [], [], Counter()
        for key, language, _, expected, gold_tokens in FROZEN:
            (tokens, offsets), duration = timed(method, expected)
            times.append(duration)
            gold = set(zip(gold_tokens, offsets_for(expected, gold_tokens), strict=True))
            predicted = set(zip(tokens, offsets, strict=True))
            boundaries = {0, len(expected)} | {
                edge for match in regex.finditer(r"\X", expected) for edge in match.span()
            }
            counts = {
                "tp": len(gold & predicted),
                "fp": len(predicted - gold),
                "fn": len(gold - predicted),
                "unsafe_boundaries": sum(
                    start not in boundaries or end not in boundaries for start, end in offsets
                ),
                "offset_errors": sum(
                    expected[start:end] != token
                    for token, (start, end) in zip(tokens, offsets, strict=True)
                ),
                "content_preservation_errors": int("".join(tokens) != "".join(expected.split())),
                "placeholder_integrity_errors": sum(
                    placeholder not in tokens
                    for placeholder in (
                        "[PERSON]",
                        "[LOCATION]",
                        "[EMAIL]",
                        "[PHONE]",
                        "[STUDENT_ID]",
                    )
                    if placeholder in expected
                ),
            }
            totals.update(counts)
            rows.append(
                {
                    "case_id": key,
                    "language_metadata": language,
                    "exact_sequence_match": tokens == gold_tokens,
                    **counts,
                }
            )
        tp, fp, fn = totals["tp"], totals["fp"], totals["fn"]
        report["tokenization"][name] = {
            "exact_sequence_matches": sum(row["exact_sequence_match"] for row in rows),
            **totals,
            "precision": tp / (tp + fp),
            "recall": tp / (tp + fn),
            "f1": 2 * tp / (2 * tp + fp + fn),
            "timing": timing(times),
            "cases": rows,
        }

    # Reuse the previously frozen 33 language-labelled inputs and labels. Record
    # runtime only; do not retune rules or describe these inputs as held-out.
    old = json.loads(
        Path("artifacts/c2-evidence/language-id/rule-baseline-v1/report.json").read_text(
            encoding="utf-8"
        )
    )
    times, pipeline_times, changes = [], [], 0
    cold_start = perf_counter_ns()
    for index, text in enumerate(text for texts in LANGUAGE_CASES.values() for text in texts):
        result, duration = timed(
            lambda value: run_preprocessing_pipeline(
                [PipelineInput("synthetic", value)], strategy="presidio"
            ),
            text,
        )
        pipeline_times.append(duration)
        prediction, language_time = timed(identify_language, result.records[0].anonymized_text)
        times.append(language_time)
        changes += int(prediction.__dict__ != old["cases"][index]["prediction"])
    report["language_id"] = {
        "reused_result_path": "artifacts/c2-evidence/language-id/rule-baseline-v1/report.json",
        "reused_result_sha256": hashlib.sha256(
            Path("artifacts/c2-evidence/language-id/rule-baseline-v1/report.json").read_bytes()
        ).hexdigest(),
        "records": 33,
        "prediction_changes": changes,
        "language_slices": old["language_slices"],
        "stage_timing": timing(times),
        "pipeline_timing_including_first_model_initialization": timing(pipeline_times),
        "evaluation_wall_ms": (perf_counter_ns() - cold_start) / 1_000_000,
        "alternatives_executed": [],
    }
    report["provenance"] = {
        "head": subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip(),
        "python": platform.python_version(),
        "unicode_database": unicodedata.unidata_version,
        "regex": version("regex"),
        "spacy": version("spacy"),
        "source_hashes": {
            str(path): hashlib.sha256(path.read_bytes()).hexdigest()
            for path in [
                Path(__file__),
                Path("services/preprocessing/text_processing.py"),
                Path("services/preprocessing/language_id.py"),
                Path("services/preprocessing/pipeline.py"),
            ]
        },
        "timing_note": "One CPU pass, short inputs, no repetitions/optimization; stage timings exclude imports, pipeline first call includes model load; not a load benchmark. Source text/detected values excluded.",
    }
    return report


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", type=Path, required=True)
    directory = parser.parse_args().output_dir
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / "report.json"
    if path.exists():
        raise SystemExit("Refusing to overwrite evidence")
    report = evaluate()
    path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {
                name: {
                    method: {key: value for key, value in row.items() if key != "cases"}
                    for method, row in report[name].items()
                }
                for name in ("normalization", "tokenization")
            },
            indent=2,
        )
    )
    print(
        json.dumps(
            {
                key: value
                for key, value in report["language_id"].items()
                if key != "language_slices"
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
