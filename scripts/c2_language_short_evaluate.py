"""Bounded diagnostic comparison; fixed previous Language ID gold is unchanged."""

import argparse
import hashlib
import importlib.util
import json
import sys
from collections import Counter
from dataclasses import asdict
from pathlib import Path
from time import perf_counter_ns

from preprocessing import pipeline
from preprocessing.language_id import LanguageIdentification, explicit_short_introduction

from scripts.c2_language_id_evaluate import CASES

# Development diagnostics frozen before evaluation; no names are needed.
DIAGNOSTICS = (
    *(
        (f"phrase-{i}-{j}", "romanized-si", f"{prefix} {word} [PERSON].")
        for i, base in enumerate(("mage", "mge", "eyge"))
        for j, (prefix, word) in enumerate(
            (
                (base, "nama"),
                (base.title(), "nama"),
                (base.upper(), "NAMA"),
                (base[0].lower() + base[1:].upper(), "NaMa"),
            )
        )
    ),
    ("tab", "romanized-si", "Mge\tnama [PERSON]"),
    ("newline", "romanized-si", "MGE\nNAMA [PERSON]"),
    ("punctuation", "romanized-si", "mage nama: [PERSON]! 🙂"),
    ("bare", "romanized-si", "eyge nama?"),
    ("english-my", "english", "My name is [PERSON]."),
    ("english-our", "english", "Our name is [PERSON]."),
    ("english-the", "english", "The name is [PERSON]."),
    ("short-english", "uncertain", "I am [PERSON]"),
    ("short-name", "uncertain", "My name [PERSON]"),
    ("shared-mama", "uncertain", "mama"),
    ("shared-nama", "uncertain", "nama"),
    ("shared-pair", "uncertain", "gana nama"),
    ("shared-other-pair", "uncertain", "mama nama"),
    ("comma-break", "uncertain", "mge,nama [PERSON]"),
    ("placeholder-break", "uncertain", "mage [PERSON] nama"),
    ("near-match", "uncertain", "mge namaste [PERSON]"),
    ("quoted-english", "english", "The phrase mge nama is quoted."),
    ("quoted-fragment", "uncertain", '"mge nama"'),
    ("placeholders", "unknown", "[PERSON] [LOCATION] [EMAIL]"),
    ("empty", "unknown", ""),
    ("mixed", "code-mixed", "Mge nama [PERSON]. I am tired."),
)


def load_baseline(path):
    spec = importlib.util.spec_from_file_location("c2_language_short_baseline", path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def candidate(text, baseline):
    if explicit_short_introduction(text):
        return LanguageIdentification(
            "romanized-si",
            "provisional",
            "explicit_romanized_name_introduction",
            method="c2-rule-language-v1.1",
            uncertain=False,
        )
    return baseline.identify_language(text)


def summarize(rows, name):
    counts = Counter()
    for row in rows:
        expected = row["expected"]
        prediction = row[name]
        counts["records"] += 1
        counts["matching_labels"] += prediction["language"] == expected
        counts["uncertain_or_unknown"] += prediction["uncertain"]
        counts["language_abstentions"] += (
            expected not in {"uncertain", "unknown"} and prediction["uncertain"]
        )
        counts["wrong_provisional_labels"] += (
            prediction["language"] != expected and not prediction["uncertain"]
        )
    return dict(counts)


def evaluate(baseline):
    rows = []
    times = []
    for key, expected, text in DIAGNOSTICS:
        start = perf_counter_ns()
        before = baseline.identify_language(text)
        after = candidate(text, baseline)
        times.append((perf_counter_ns() - start) / 1_000_000)
        rows.append(
            {"case_id": key, "expected": expected, "before": asdict(before), "after": asdict(after)}
        )
    frozen = []
    normal_identify = pipeline.identify_language
    try:
        for expected, texts in CASES.items():
            for index, text in enumerate(texts):
                pipeline.identify_language = baseline.identify_language
                before = pipeline.run_preprocessing_pipeline(
                    [pipeline.PipelineInput("synthetic", text)], strategy="presidio"
                )
                pipeline.identify_language = lambda value: candidate(value, baseline)
                after = pipeline.run_preprocessing_pipeline(
                    [pipeline.PipelineInput("synthetic", text)], strategy="presidio"
                )
                before_record, after_record = asdict(before.records[0]), asdict(after.records[0])
                before_language = before_record.pop("language_identification")
                after_language = after_record.pop("language_identification")
                assert before_record == after_record
                assert before.quality_summary == after.quality_summary
                assert before.privacy_summary == after.privacy_summary
                assert before.release_ready == after.release_ready
                assert before.blocking_reasons == after.blocking_reasons
                frozen.append(
                    {
                        "case_id": f"{expected}-{index}",
                        "expected": expected,
                        "before": before_language,
                        "after": after_language,
                    }
                )
    finally:
        pipeline.identify_language = normal_identify
    return {
        "diagnostics": {
            "before": summarize(rows, "before"),
            "after": summarize(rows, "after"),
            "cases": rows,
        },
        "frozen": {
            "before": summarize(frozen, "before"),
            "after": summarize(frozen, "after"),
            "cases": frozen,
        },
        "other_record_fields_quality_privacy_release_unchanged": True,
        "diagnostic_pair_wall_time_ms": {
            "calls": len(times),
            "total": sum(times),
            "max": max(times),
        },
        "evidence_status": "development_diagnostics_and_reused_frozen_cases_not_independent_validation",
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--baseline", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        raise SystemExit("Refusing to overwrite evidence")
    report = evaluate(load_baseline(args.baseline))
    report["baseline_sha256"] = hashlib.sha256(args.baseline.read_bytes()).hexdigest()
    report["frozen_fixture_source_sha256"] = hashlib.sha256(
        Path("scripts/c2_language_id_evaluate.py").read_bytes()
    ).hexdigest()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {
                key: {name: report[key][name] for name in ("before", "after")}
                for key in ("diagnostics", "frozen")
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
