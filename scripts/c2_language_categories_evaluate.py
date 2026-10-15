"""Bounded v1.1/v1.2 comparison, with unchanged frozen language gold."""

import argparse
import json
from collections import Counter
from dataclasses import asdict
from pathlib import Path
from time import perf_counter_ns

from preprocessing import pipeline
from preprocessing.language_id import identify_language

from scripts.c2_language_id_evaluate import CASES
from scripts.c2_language_short_evaluate import DIAGNOSTICS, load_baseline

# Additional development cases, not untouched validation data.
CATEGORY_CASES = (
    ("mixed-script", "sinhala", "විභාග නිසා mata බයයි"),
    ("mixed-script-upper", "sinhala", "අද MATA මහන්සියි"),
    ("mixed-script-abbreviation", "sinhala", "මට mt බයයි"),
    ("sinhala", "sinhala", "අද මට මහන්සියි"),
    ("sinhala-english", "code-mixed", "මට I am tired today."),
    ("romanized-english", "code-mixed", "mata hari mahansiyi but I am tired."),
    ("english", "english", "We are worried about studies today."),
    ("romanized", "romanized-si", "MATA HARI MAHANSIYI NISA"),
    ("abbreviation", "romanized-si", "mt exam gna byi"),
    ("introduction", "romanized-si", "Mge nama [PERSON]"),
    ("borrowed", "uncertain", "මට exam තියෙනවා"),
    ("shared", "uncertain", "mama"),
    ("short", "uncertain", "I am"),
    ("placeholder", "unknown", "[PERSON] [LOCATION]"),
    ("unexplained-latin", "uncertain", "අද bonjour salut"),
)


def summarize(rows, field):
    groups = {}
    for row in rows:
        group = groups.setdefault(row["expected"], Counter())
        prediction = row[field]
        group["records"] += 1
        group["matching_labels"] += prediction["language"] == row["expected"]
        group["wrong_provisional_labels"] += (
            prediction["language"] != row["expected"] and not prediction["uncertain"]
        )
        group["abstentions"] += (
            row["expected"] not in {"uncertain", "unknown"} and prediction["uncertain"]
        )
    return groups


def evaluate(baseline):
    groups = {"frozen": [], "short_development": [], "category_development": []}
    timings = {"before": [], "after": []}
    original = pipeline.identify_language
    try:
        for expected, texts in CASES.items():
            for index, text in enumerate(texts):
                pair = {}
                results = []
                for name, detector in (
                    ("before", baseline.identify_language),
                    ("after", identify_language),
                ):
                    pipeline.identify_language = detector
                    result = pipeline.run_preprocessing_pipeline(
                        [pipeline.PipelineInput("synthetic", text)], strategy="presidio"
                    )
                    record = asdict(result.records[0])
                    pair[name] = record.pop("language_identification")
                    results.append(
                        (
                            record,
                            result.quality_summary,
                            result.privacy_summary,
                            result.release_ready,
                            result.blocking_reasons,
                        )
                    )
                assert results[0] == results[1]
                groups["frozen"].append(
                    {"case_id": f"{expected}-{index}", "expected": expected, **pair}
                )
        for group, cases in (
            ("short_development", DIAGNOSTICS),
            ("category_development", CATEGORY_CASES),
        ):
            for key, expected, text in cases:
                pair = {}
                for name, detector in (
                    ("before", baseline.identify_language),
                    ("after", identify_language),
                ):
                    start = perf_counter_ns()
                    pair[name] = asdict(detector(text))
                    timings[name].append((perf_counter_ns() - start) / 1_000_000)
                groups[group].append({"case_id": key, "expected": expected, **pair})
    finally:
        pipeline.identify_language = original
    return {
        "groups": {
            key: {
                "before": summarize(rows, "before"),
                "after": summarize(rows, "after"),
                "cases": rows,
            }
            for key, rows in groups.items()
        },
        "non_language_fields_unchanged": True,
        "runtime_ms": {
            key: {"calls": len(values), "mean": sum(values) / len(values), "max": max(values)}
            for key, values in timings.items()
        },
        "evidence": "reused_frozen_and_development_diagnostics_not_independent_validation",
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--baseline", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    if args.output.exists():
        raise SystemExit("Refusing to overwrite evidence")
    report = evaluate(load_baseline(args.baseline))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {
                key: {name: group[name] for name in ("before", "after")}
                for key, group in report["groups"].items()
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
