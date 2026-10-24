"""Local C2 batch validation / optional labelled evaluation; no network or text exports."""

import argparse
import hashlib
import json
import platform
import subprocess
import sys
from importlib.metadata import version
from pathlib import Path

from preprocessing.validation_evaluation import evaluate_cases

ROOT = Path(__file__).resolve().parents[1]


def markdown(report):
    lines = [
        "# C2 run validation and reference evaluation",
        "",
        f"Records processed: **{report['records_processed']}** (answer records, not participants).",
        f"Declared reference status: **{report['provenance']['reference_status']}**; label independence is not verified by this program.",
        "",
        "## Actual output checks",
        "",
        "Pass rates below are policy/integrity compliance, not detection accuracy. Reviews count in the denominator; not-evaluated records are shown separately.",
        "",
        "| Stage | Checked | Pass | Fail | Review | Not evaluated | Pass rate |",
        "|---|---:|---:|---:|---:|---:|---:|",
    ]
    for row in report["validation_summary"]["stages"]:
        rate = (
            "Not measured"
            if row["pass_rate_percent"] is None
            else f"{row['pass_rate_percent']:.2f}%"
        )
        lines.append(
            f"| {row['stage']} | {row['checked_records']} | {row['passed_records']} | {row['failed_records']} | {row['review_records']} | {row['not_evaluated_records']} | {rate} |"
        )
    lines += ["", "## Agreement with explicit reference labels", ""]
    for name, metric in (("anonymization", "f1"), ("language_id", "accuracy")):
        values = report[name]
        score = "Not measured" if values[metric] is None else f"{100 * values[metric]:.2f}%"
        lines.append(
            f"- {name} {metric}: **{score}**; labelled records: {values['labelled_records']}; unlabelled: {values['unlabelled_records']}."
        )
    lines += [
        "",
        "See report.json for typed-span TP/FP/FN, entity/language breakdowns, confusion counts, exposure counts and per-record checks (ordinal positions only).",
        "",
        "## Rule locations",
        "",
        *[
            f"- `{rule['rule_id']}`: {rule['description']} Source: `{rule['source_path']}` → `{rule['source_function']}()`."
            for rule in report["validation_summary"]["rules"]
        ],
        "",
        "## Boundaries",
        "",
        report["limitation"],
        "These diagnostics do not override the existing release policy. Human approval, annotation agreement, adjudication and full dataset-release validation remain separate.",
        "No participant texts, input IDs, detected values or gold spans are exported.",
        "",
    ]
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--strategy", choices=("regex", "presidio", "hybrid"), default="presidio")
    args = parser.parse_args()
    if args.output_dir.exists():
        parser.exit(2, "Output directory already exists; choose a fresh path.\n")
    try:
        payload = args.input.read_bytes()
        document = json.loads(payload)
        if (
            not isinstance(document, dict)
            or set(document) != {"reference_status", "cases"}
            or not isinstance(document["reference_status"], str)
            or document["reference_status"]
            not in {"unreviewed", "author_reviewed", "independent_review_declared"}
        ):
            raise ValueError("Expected reference_status and cases; no other metadata accepted.")
        report = evaluate_cases(document["cases"], strategy=args.strategy)
        try:
            head = subprocess.check_output(
                ["git", "rev-parse", "HEAD"], cwd=ROOT, text=True, stderr=subprocess.DEVNULL
            ).strip()
        except (OSError, subprocess.CalledProcessError):
            head = "unavailable"
        sources = [*sorted((ROOT / "services/preprocessing").glob("*.py")), Path(__file__)]
        report["provenance"] = {
            "reference_status": document["reference_status"],
            "input_sha256": hashlib.sha256(payload).hexdigest(),
            "git_head": head,
            "python": platform.python_version(),
            "versions": {
                package: version(package)
                for package in ("presidio-analyzer", "spacy", "en-core-web-sm", "regex")
            },
            "source_sha256": {
                path.relative_to(ROOT).as_posix(): hashlib.sha256(path.read_bytes()).hexdigest()
                for path in sources
            },
        }
        args.output_dir.mkdir(parents=True)
        (args.output_dir / "report.json").write_text(
            json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
        )
        (args.output_dir / "report.md").write_text(markdown(report), encoding="utf-8")
    except (ValueError, OSError, RuntimeError):
        # No input fragments, file contents, participant identifiers or tracebacks.
        parser.exit(
            2,
            "C2 validation could not complete. Check input schema, explicit reference spans, runtime dependencies and output permissions locally. No score should be inferred.\n",
        )
    print(
        json.dumps(
            {
                "records_processed": report["records_processed"],
                "anonymization": report["anonymization"]["status"],
                "language_id": report["language_id"]["status"],
            }
        )
    )


if __name__ == "__main__":
    sys.exit(main())
