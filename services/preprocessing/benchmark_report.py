"""Reproducible aggregate-only C2 comparison CLI; fails if any candidate fails."""

import argparse
import hashlib
import importlib.metadata
import json
import math
import platform
import statistics
import subprocess
import sys
from collections import Counter
from pathlib import Path
from time import perf_counter

STRATEGIES = ("regex", "presidio", "hybrid")


def anonymizer(strategy):
    if strategy == "regex":
        from preprocessing.anonymization import anonymize_text

        return anonymize_text
    if strategy == "presidio":
        from preprocessing.presidio_anonymization import anonymize_with_presidio

        return anonymize_with_presidio
    from preprocessing.hybrid_anonymization import anonymize_with_hybrid

    return anonymize_with_hybrid


def aggregate(pairs):
    from preprocessing.span_evaluation import score_spans

    totals = Counter()
    for gold, predicted in pairs:
        totals.update(
            {
                k: v
                for k, v in score_spans(gold, predicted).items()
                if k not in {"precision", "recall", "f1"}
            }
        )
    tp, fp, fn = totals["tp"], totals["fp"], totals["fn"]
    precision = tp / (tp + fp) if tp + fp else 1.0
    recall = tp / (tp + fn) if tp + fn else 1.0
    return dict(totals) | {
        "precision": precision,
        "recall": recall,
        "f1": 2 * precision * recall / (precision + recall) if precision + recall else 0.0,
    }


def measure(repetitions):
    from preprocessing.span_evaluation import evaluate_detection, render
    from preprocessing.synthetic_benchmark import build_benchmark

    cases = build_benchmark()
    heldout = [c for c in cases if c.split == "heldout"]
    results = {}
    for strategy in STRATEGIES:
        # Fresh interpreter per candidate: timed import, construction and first call.
        cold = subprocess.run(
            [sys.executable, "-m", "preprocessing.benchmark_report", "--cold", strategy],
            capture_output=True,
            text=True,
        )
        if cold.returncode:
            raise RuntimeError(
                f"Required candidate {strategy} failed cold initialization; verify locked dependencies/model (exit {cold.returncode})."
            )
        cold_ms = json.loads(cold.stdout)["cold_ms"]
        process = anonymizer(strategy)
        pairs, times = [], []
        for case in heldout:
            spans = evaluate_detection(case.text, strategy)
            if render(case.text, spans) != process(case.text).anonymized_text:
                raise RuntimeError("Masking trace does not match production output")
            pairs.append((case.gold, spans))
        for _ in range(repetitions):
            for case in heldout:
                start = perf_counter()
                process(case.text)
                times.append((perf_counter() - start) * 1000)
        results[strategy] = {
            "overall": aggregate(pairs),
            "per_family": {
                family: {
                    "cases": sum(c.family == family for c in heldout),
                    **aggregate(
                        pair for c, pair in zip(heldout, pairs, strict=True) if c.family == family
                    ),
                }
                for family in sorted({c.family for c in heldout})
            },
            "per_language": {
                language: {
                    "cases": sum(c.language == language for c in heldout),
                    **aggregate(
                        pair
                        for c, pair in zip(heldout, pairs, strict=True)
                        if c.language == language
                    ),
                }
                for language in sorted({c.language for c in heldout})
            },
            "per_entity": {
                entity: aggregate(
                    (
                        tuple(s for s in gold if s.entity_type == entity),
                        tuple(s for s in predicted if s.entity_type == entity),
                    )
                    for gold, predicted in pairs
                )
                for entity in ("EMAIL", "PHONE", "STUDENT_ID", "PERSON", "LOCATION")
            },
            "runtime": {
                "cold_ms": cold_ms,
                "median_ms": statistics.median(times),
                "p95_ms": sorted(times)[math.ceil(0.95 * len(times)) - 1],
                "repetitions": repetitions,
                "calls": len(times),
            },
        }
    revision = subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()
    diff = subprocess.check_output(["git", "diff", "--", "services/preprocessing"], text=True)
    sources = b"".join(p.read_bytes() for p in sorted(Path("services/preprocessing").glob("*.py")))
    return {
        "methodology": {
            "evaluation_scope": "disposable_synthetic_heldout",
            "metric_basis": "exact_typed_original_character_spans",
            "offsets": "half_open_unicode_characters",
            "zero_denominator_policy": "Undefined precision/recall = 1; F1 = 0 if both zero; empty gold/predictions = 1.",
            "masking_coverage": "Original character unions; missed = none masked; partial = some masked; unnecessary = outside gold.",
            "model_languages": ["en"],
            "selection_policy": "Highest exact-span micro F1 is provisional only; production selection remains pending.",
        },
        "benchmark_id": "c2-synthetic-v1-" + hashlib.sha256(repr(cases).encode()).hexdigest()[:16],
        "split_sizes": dict(Counter(c.split for c in cases)),
        "heldout_languages": dict(Counter(c.language for c in heldout)),
        "environment": {
            "python": sys.version,
            "platform": platform.platform(),
            "processor": platform.processor(),
            "versions": {
                p: importlib.metadata.version(p)
                for p in (
                    "presidio-analyzer",
                    "presidio-anonymizer",
                    "spacy",
                    "en-core-web-sm",
                    "tldextract",
                )
            },
        },
        "revision": revision,
        "working_diff_sha256": hashlib.sha256(diff.encode()).hexdigest(),
        "preprocessing_source_sha256": hashlib.sha256(sources).hexdigest(),
        "requirements_sha256": hashlib.sha256(Path("requirements.lock").read_bytes()).hexdigest(),
        "strategies": results,
    }


def markdown(data, command):
    lines = [
        "# C2 anonymization comparison and selection",
        "",
        "Objective: compare configured masking of synthetic names, locations, emails, Sri Lankan mobiles and student IDs for non-diagnostic wellbeing preprocessing. Authorized humans retain interpretation and release authority.",
        "",
        "Regex uses ordered structured and contextual patterns, including broad Sinhala මම and capitalized English I am rules. Presidio uses English-only spaCy en_core_web_sm with built-in recognizers and custom student-ID/mobile patterns. Those patterns do not constitute Sinhala NLP model support. Hybrid runs Regex then Presidio with original-offset mapping. Existing placeholders are protected; overlapping predictions resolve deterministically by confidence, length and position before masking.",
        "",
        "Presidio email domain validation uses the locked tldextract bundled public suffix snapshot with network fetching and caching disabled; its email detection patterns and domain validation remain enabled.",
        "",
        f"Benchmark `{data['benchmark_id']}`: splits {data['split_sizes']}; held-out languages {data['heldout_languages']}. Fixtures are generated in memory and discarded. Related template variants stay together. Development cases are excluded from scores. This is a small hand-authored challenge benchmark, not an independently sampled population or statistical validation.",
        "",
        "Exact typed half-open Unicode spans determine micro precision/recall/F1. Coverage uses unions of original character positions: missed = no gold characters masked; partial = some but not all masked; unnecessary = masked characters outside all gold spans. Wrong entity types may cover PII while failing exact detection. Undefined precision/recall = 1; F1 = 0 if both zero; empty gold/predictions = 1. Denominators must accompany rates. Legacy placeholder metrics remain count-based and cannot verify residual PII.",
        "",
        "## Measured results",
        "",
        "| Strategy | Gold | Predicted | TP | FP | FN | Precision | Recall | F1 | Missed | Partial | Unmasked gold chars | Unnecessary chars |",
        "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for strategy, result in data["strategies"].items():
        m = result["overall"]
        lines.append(
            f"| {strategy} | "
            + " | ".join(
                f"{m[k]:.4f}" if isinstance(m[k], float) else str(m[k])
                for k in (
                    "gold_entities",
                    "predicted_entities",
                    "tp",
                    "fp",
                    "fn",
                    "precision",
                    "recall",
                    "f1",
                    "missed_gold_pii",
                    "partial_masking",
                    "unmasked_gold_characters",
                    "unnecessary_masked_characters",
                )
            )
            + " |"
        )
    for group in ("per_language", "per_entity", "per_family"):
        lines += [
            "",
            f"## {group.replace('_', ' ').title()}",
            "",
            "| Strategy | Group | Gold | Predicted | TP | FP | FN | Precision | Recall | F1 |",
            "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|",
        ]
        for strategy, result in data["strategies"].items():
            for label, m in result[group].items():
                lines.append(
                    f"| {strategy} | {label} | "
                    + " | ".join(
                        f"{m[k]:.4f}" if isinstance(m[k], float) else str(m[k])
                        for k in (
                            "gold_entities",
                            "predicted_entities",
                            "tp",
                            "fp",
                            "fn",
                            "precision",
                            "recall",
                            "f1",
                        )
                    )
                    + " |"
                )
    lines += [
        "",
        "## Runtime",
        "",
        "Cold cost includes imports, engine/model construction and first synthetic call in a fresh interpreter; interpreter launch itself is excluded. Warm timings measure production calls individually after validation warmup, sequentially in benchmark order; p95 is nearest-rank. One cold sample per candidate; repeat the command to assess variability.",
        "",
        "| Strategy | Cold ms | Warm median ms | Warm p95 ms | Calls | Repetitions |",
        "|---|---:|---:|---:|---:|---:|",
    ]
    for strategy, result in data["strategies"].items():
        r = result["runtime"]
        lines.append(
            f"| {strategy} | {r['cold_ms']:.3f} | {r['median_ms']:.3f} | {r['p95_ms']:.3f} | {r['calls']} | {r['repetitions']} |"
        )
    ranked = sorted(
        data["strategies"], key=lambda s: data["strategies"][s]["overall"]["f1"], reverse=True
    )
    best = ranked[0]
    tied = (
        data["strategies"][best]["overall"]["f1"] == data["strategies"][ranked[1]]["overall"]["f1"]
    )
    lines += ["", "## Error analysis and selection", ""]
    for strategy, result in data["strategies"].items():
        m = result["overall"]
        lines.append(
            f"{strategy}: {m['fn']} exact-span misses, {m['missed_gold_pii']} entirely unmasked gold entities, {m['partial_masking']} partial masks and {m['unnecessary_masked_characters']} unnecessarily masked non-PII characters. Language/entity tables localize errors; aggregate evidence does not identify individual values."
        )
    lines += [
        "",
        "Selection remains pending: top exact-span F1 is tied."
        if tied
        else f"{best} has the highest measured exact-span F1 ({data['strategies'][best]['overall']['f1']:.4f}) on this benchmark and is the provisional candidate for further evaluation, over the alternatives shown above.",
        "Production selection remains pending; retain Regex as the current default. The small synthetic benchmark and remaining misses/false masking do not justify a production default change. Regex is lightweight and explicit but brittle for multiword names and broad self-introduction rules. Presidio adds English NER at model startup/runtime cost and lacks Sinhala/Romanized language modelling. Hybrid inherits Regex false positives and cannot restore removed wellbeing words, while adding model cost. Further independent synthetic validation, owner review and approved thresholds are required. No method establishes complete anonymity or zero re-identification risk. Indirect identifiers and unresolved privacy reviews still block release through existing gates.",
        "",
        "## Reproduction",
        "",
        f"`{command}`",
        "",
        f"Revision: `{data['revision']}` (uncommitted working tree); source SHA256 `{data['preprocessing_source_sha256']}`; diff SHA256 `{data['working_diff_sha256']}`; requirements SHA256 `{data['requirements_sha256']}`.",
        "",
        "Environment: " + json.dumps(data["environment"], ensure_ascii=False),
        "",
    ]
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=Path("artifacts/c2-anonymization"))
    parser.add_argument("--repetitions", type=int, default=20)
    parser.add_argument("--cold", choices=STRATEGIES)
    args = parser.parse_args()
    if args.cold:
        start = perf_counter()
        anonymizer(args.cold)("Contact cold.fixture@example.com.")
        print(json.dumps({"cold_ms": (perf_counter() - start) * 1000}))
        return
    if args.repetitions < 1:
        parser.error("repetitions must be positive")
    data = measure(args.repetitions)
    command = f".\\.venv\\Scripts\\python.exe scripts/run.py preprocessing.benchmark_report --output {args.output.as_posix()} --repetitions {args.repetitions}"
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / "results.json").write_text(json.dumps(data, indent=2), encoding="utf-8")
    (args.output / "comparison.md").write_text(markdown(data, command), encoding="utf-8")
    print(f"Generated aggregate results.json and comparison.md in {args.output}")


if __name__ == "__main__":
    main()
