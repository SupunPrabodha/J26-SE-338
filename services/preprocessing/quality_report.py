"""Execute policy-derived synthetic regressions and retain aggregate evidence only."""

import argparse
import hashlib
import json
import platform
import subprocess
from collections import Counter
from dataclasses import asdict
from pathlib import Path

from preprocessing.data_quality import (
    DEFAULT_QUALITY_POLICY,
    QualityPolicy,
    assess_records,
    build_quality_summary,
)
from preprocessing.pipeline import run_preprocessing_pipeline
from preprocessing.quality_fixtures import build_quality_scenarios


def _counts(values):
    return dict(sorted(Counter(values).items()))


def run_synthetic_checks(policy=DEFAULT_QUALITY_POLICY):
    if policy != DEFAULT_QUALITY_POLICY:
        raise ValueError(
            "Regression expectations require the documented default development policy."
        )
    scenarios = build_quality_scenarios()
    evidence = []
    totals = Counter()
    issues = Counter()
    blocked = Counter()
    for scenario in scenarios:
        for strategy in ("regex", "presidio", "hybrid") if scenario.pipeline else ("quality_only",):
            expected_reasons = []
            if not scenario.records:
                expected_reasons.append("empty_batch")
            if "REJECT" in scenario.expected_statuses:
                expected_reasons.append("data_quality_rejected")
            if "REVIEW" in scenario.expected_statuses:
                expected_reasons.append("data_quality_review_required")
            if scenario.pipeline and any(
                "privacy_review_required" in item for item in scenario.expected_issues
            ):
                expected_reasons.append("privacy_review_required")
            if scenario.pipeline and scenario.expected_privacy_block:
                expected_reasons.append("release_privacy_gate_failed")
            if scenario.pipeline:
                result = run_preprocessing_pipeline(
                    scenario.records, strategy=strategy, quality_policy=policy
                )
                observed_statuses = tuple(r.quality_status.value for r in result.records)
                observed_issues = tuple(r.quality_issues for r in result.records)
                reasons = result.blocking_reasons
                passed = result.release_ready
                summary = result.quality_summary
            else:
                results = assess_records(scenario.records, policy=policy)
                summary = build_quality_summary(results, policy=policy)
                observed_statuses = tuple(r.status.value for r in results)
                observed_issues = tuple(r.issues for r in results)
                reasons = tuple(summary["blocking_reasons"])
                passed = summary["data_quality_gate"] == "PASSED"
            matches = (
                observed_statuses == scenario.expected_statuses
                and observed_issues == scenario.expected_issues
                and reasons == tuple(expected_reasons)
                and passed == (not expected_reasons)
                and (summary["data_quality_gate"] == "PASSED")
                == (bool(scenario.records) and all(s == "PASS" for s in observed_statuses))
            )
            observed_counts = {s: observed_statuses.count(s) for s in ("PASS", "REVIEW", "REJECT")}
            totals.update(observed_counts)
            issues.update(issue for item in observed_issues for issue in item)
            blocked.update(reasons)
            evidence.append(
                {
                    "category": scenario.category,
                    "language_slice": scenario.language,
                    "strategy": strategy,
                    "scope": "pipeline_automated_prerequisites"
                    if scenario.pipeline
                    else "quality_gate_only",
                    "records": len(scenario.records),
                    "expected_status_counts": {
                        s: scenario.expected_statuses.count(s) for s in ("PASS", "REVIEW", "REJECT")
                    },
                    "observed_status_counts": observed_counts,
                    "expected_issue_counts": _counts(
                        issue for item in scenario.expected_issues for issue in item
                    ),
                    "observed_issue_counts": _counts(
                        issue for item in observed_issues for issue in item
                    ),
                    "expected_blocking_reasons": expected_reasons,
                    "observed_blocking_reasons": list(reasons),
                    "expected_automated_gate_passed": not expected_reasons,
                    "observed_automated_gate_passed": passed,
                    "expectations_matched": matches,
                }
            )
    return {
        "evaluation_scope": "disposable_synthetic_policy_regressions",
        "independent_research_validation": False,
        "policy": asdict(policy),
        "policy_status": "development_only_not_research_approved",
        "scenario_count": len(scenarios),
        "scenario_language_counts": _counts(c.language for c in scenarios),
        "execution_count": len(evidence),
        "records_evaluated_including_strategy_repeats": sum(row["records"] for row in evidence),
        "matched_executions": sum(row["expectations_matched"] for row in evidence),
        "failed_executions": sum(not row["expectations_matched"] for row in evidence),
        "status_counts": {s: totals[s] for s in ("PASS", "REVIEW", "REJECT")},
        "issue_counts": dict(sorted(issues.items())),
        "blocking_reason_counts": dict(sorted(blocked.items())),
        "automated_gate_passed_executions": sum(
            row["observed_automated_gate_passed"] for row in evidence
        ),
        "automated_gate_blocked_executions": sum(
            not row["observed_automated_gate_passed"] for row in evidence
        ),
        "outcomes": evidence,
        "privacy_note": "Aggregate evidence only; submitted text, detected values and individual record identifiers are excluded.",
    }


def render_markdown(data):
    lines = [
        "# C2 data-quality policy verification",
        "",
        "This report checks development quality rules using disposable synthetic regressions. It is not independent research validation or a release authorization.",
        "",
        f"Outcome: {'PASS' if not data['failed_executions'] else 'FAIL'} — {data['matched_executions']} / {data['execution_count']} executions matched the documented expected status, issues, gate and ordered blocking reasons.",
        "",
        f"Cases: {data['scenario_count']} scenarios; language slices {data['scenario_language_counts']}. Pipeline cases run through Regex, Presidio and Hybrid; direct quality cases run once. Evaluated records including repeats: {data['records_evaluated_including_strategy_repeats']}.",
        "",
        "## Policy and human release",
        "",
        "Development settings: " + json.dumps(data["policy"], sort_keys=True),
        "",
        "The existing short-text threshold of 3 is retained, not research-approved. Unresolved REVIEW and REJECT records block release; empty batches fail. REJECT takes precedence over REVIEW, which takes precedence over PASS. release_ready means only automated prerequisites passed. The existing human_release_required policy remains in force; C1 approval workflows are unchanged.",
        "",
        "Recorded release configuration: " + json.dumps(data["release_policy"], sort_keys=True),
        "",
        "Text comparison uses Unicode NFC, Unicode whitespace collapsing and casefolding. Source text is unchanged, including Sinhala marks, meaningful joiners, punctuation and emoji. IDs are trimmed, string-only and case-sensitive, without NFC/casefold. Matching anonymized text means a possible duplicate or masking collision. Nothing is merged or deleted.",
        "",
        "Whitespace-empty text is REJECT. Short nonempty text is REVIEW. Placeholder-only or punctuation/mark-only content is REVIEW. Letters/numbers and Unicode So symbols (including emoji) count as usable. U+FFFD is REVIEW. Cc controls except tab/LF/CR and Cf formats except ZWNJ/ZWJ are REVIEW. Surrogate code points are malformed Unicode and REJECT before anonymization. Missing/non-string fields are REJECT; no values appear in errors.",
        "",
        "## Aggregate outcomes",
        "",
        "| Status | Records including repeats |",
        "|---|---:|",
    ]
    lines.extend(f"| {s} | {n} |" for s, n in data["status_counts"].items())
    lines += [
        "",
        f"Automated gate passed: {data['automated_gate_passed_executions']} executions; blocked: {data['automated_gate_blocked_executions']}.",
        "",
        "| Issue | Count |",
        "|---|---:|",
    ]
    lines.extend(f"| {s} | {n} |" for s, n in data["issue_counts"].items())
    lines += ["", "| Blocking reason | Executions |", "|---|---:|"]
    lines.extend(f"| {s} | {n} |" for s, n in data["blocking_reason_counts"].items())
    lines += [
        "",
        "## Expected versus observed",
        "",
        "P/R/J = PASS/REVIEW/REJECT record counts. Gate scope is quality-only for direct tests and all automated pipeline prerequisites for strategy tests. Detailed expected/observed issue counts and ordered reasons are in aggregate JSON.",
        "",
        "| Category | Language | Strategy | Expected P/R/J | Observed P/R/J | Expected gate | Observed gate | Matched |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for row in data["outcomes"]:

        def counts(key, row=row):
            return "/".join(str(row[key][s]) for s in ("PASS", "REVIEW", "REJECT"))

        def gate(value):
            return "PASS" if value else "BLOCKED"

        lines.append(
            f"| {row['category']} | {row['language_slice']} | {row['strategy']} | {counts('expected_status_counts')} | {counts('observed_status_counts')} | {gate(row['expected_automated_gate_passed'])} | {gate(row['observed_automated_gate_passed'])} | {'PASS' if row['expectations_matched'] else 'FAIL'} |"
        )
    lines += [
        "",
        "## Reproduction and provenance",
        "",
        f"`{data['reproduction_command']}`",
        "",
        f"Revision: `{data['revision']}`. Current quality implementation SHA256: `{data['quality_source_sha256']}`; policy SHA256: `{data['policy_sha256']}`; release-policy SHA256: `{data['release_policy_sha256']}`.",
        "",
        "Environment: " + json.dumps(data["environment"], sort_keys=True),
        "",
        "Limitations: heuristic policy signals cannot establish text quality for a population, identify language, validate clinical meaning or prove absence of PII. Length is Unicode character count, not grapheme or linguistic length. No fuzzy deduplication, linguistic normalization, tokenization or annotation is implemented. Anonymization selection/results remain separate and unchanged.",
        "",
    ]
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=Path("artifacts/c2-data-quality"))
    parser.add_argument(
        "--policy",
        type=Path,
        default=Path("research/c2-dataset-pipeline/config/quality-policy.json"),
    )
    args = parser.parse_args()
    raw_policy = args.policy.read_bytes()
    config = json.loads(raw_policy)
    if not isinstance(config, dict) or set(config) != {
        "short_text_review_below",
        "comparison_case_insensitive",
    }:
        raise ValueError("Invalid development quality-policy configuration.")
    data = run_synthetic_checks(QualityPolicy(**config))
    release_bytes = Path("research/c2-dataset-pipeline/config/release-policy.json").read_bytes()
    data.update(
        {
            "release_policy": json.loads(release_bytes),
            "revision": subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip(),
            "quality_source_sha256": hashlib.sha256(
                b"".join(
                    Path("services/preprocessing", name).read_bytes()
                    for name in (
                        "data_quality.py",
                        "quality_policy.py",
                        "pipeline.py",
                        "privacy_gate.py",
                        "quality_fixtures.py",
                        "quality_report.py",
                    )
                )
            ).hexdigest(),
            "policy_sha256": hashlib.sha256(raw_policy).hexdigest(),
            "release_policy_sha256": hashlib.sha256(release_bytes).hexdigest(),
            "environment": {"python": platform.python_version(), "platform": platform.platform()},
            "reproduction_command": f".\\.venv\\Scripts\\python.exe scripts/run.py preprocessing.quality_report --policy {args.policy.as_posix()} --output {args.output.as_posix()}",
        }
    )
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / "results.json").write_text(json.dumps(data, indent=2), encoding="utf-8")
    (args.output / "quality-report.md").write_text(render_markdown(data), encoding="utf-8")
    print(
        f"Quality expectations matched: {data['matched_executions']}/{data['execution_count']}; aggregate reports in {args.output}"
    )
    if data["failed_executions"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
