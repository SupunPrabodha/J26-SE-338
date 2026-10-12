"""Convert recorded aggregate quality evidence to PDF without executing fixtures."""

import argparse
import hashlib
import json
import re
from collections import Counter
from io import BytesIO
from pathlib import Path
from xml.sax.saxutils import escape

from pypdf import PdfWriter
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from preprocessing.pdf_report import _NumberedCanvas
from preprocessing.quality_policy import ISSUE_ORDER

ROOT_FIELDS = {
    "evaluation_scope",
    "independent_research_validation",
    "policy",
    "policy_status",
    "scenario_count",
    "scenario_language_counts",
    "execution_count",
    "records_evaluated_including_strategy_repeats",
    "matched_executions",
    "failed_executions",
    "status_counts",
    "issue_counts",
    "blocking_reason_counts",
    "automated_gate_passed_executions",
    "automated_gate_blocked_executions",
    "outcomes",
    "privacy_note",
    "release_policy",
    "revision",
    "quality_source_sha256",
    "policy_sha256",
    "release_policy_sha256",
    "environment",
    "reproduction_command",
}
OUTCOME_FIELDS = {
    "category",
    "language_slice",
    "strategy",
    "scope",
    "records",
    "expected_status_counts",
    "observed_status_counts",
    "expected_issue_counts",
    "observed_issue_counts",
    "expected_blocking_reasons",
    "observed_blocking_reasons",
    "expected_automated_gate_passed",
    "observed_automated_gate_passed",
    "expectations_matched",
}
STATUSES = ("PASS", "REVIEW", "REJECT")
REASONS = {
    "empty_batch",
    "data_quality_rejected",
    "data_quality_review_required",
    "privacy_review_required",
    "release_privacy_gate_failed",
}
LANGUAGES = {"english", "sinhala", "romanized", "code_mixed"}


def _keys(value, allowed, *, exact=True):
    if not isinstance(value, dict) or (
        set(value) != set(allowed) if exact else not set(value) <= set(allowed)
    ):
        raise ValueError("Invalid aggregate quality-report structure.")


def _count(value):
    if type(value) is not int or value < 0:
        raise ValueError("Invalid aggregate quality count.")


def _counter(value, allowed, *, exact=False):
    _keys(value, allowed, exact=exact)
    for count in value.values():
        _count(count)


def load_quality_results(raw):
    def unique_keys(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError("Duplicate quality-report JSON key.")
            result[key] = value
        return result

    data = json.loads(raw, object_pairs_hook=unique_keys)
    _keys(data, ROOT_FIELDS)
    if (
        data["evaluation_scope"] != "disposable_synthetic_policy_regressions"
        or data["independent_research_validation"] is not False
        or data["policy_status"] != "development_only_not_research_approved"
    ):
        raise ValueError("Quality evidence must remain synthetic development policy verification.")
    _keys(data["policy"], {"short_text_review_below", "comparison_case_insensitive"})
    _count(data["policy"]["short_text_review_below"])
    if (
        data["policy"]["short_text_review_below"] < 1
        or type(data["policy"]["comparison_case_insensitive"]) is not bool
    ):
        raise ValueError("Invalid recorded quality-policy settings.")
    _keys(
        data["release_policy"],
        {"synthetic_only", "approved_private_remote", "human_release_required", "dataset_version"},
    )
    if (
        data["release_policy"]["human_release_required"] is not True
        or data["release_policy"]["synthetic_only"] is not True
    ):
        raise ValueError("Recorded evidence must retain human release and synthetic-only policy.")
    for key in (
        "scenario_count",
        "execution_count",
        "records_evaluated_including_strategy_repeats",
        "matched_executions",
        "failed_executions",
        "automated_gate_passed_executions",
        "automated_gate_blocked_executions",
    ):
        _count(data[key])
    _counter(data["status_counts"], STATUSES, exact=True)
    _counter(data["scenario_language_counts"], LANGUAGES)
    _counter(data["issue_counts"], ISSUE_ORDER)
    _counter(data["blocking_reason_counts"], REASONS)
    if not isinstance(data["outcomes"], list):
        raise ValueError("Quality outcomes must be aggregate rows.")
    for row in data["outcomes"]:
        _keys(row, OUTCOME_FIELDS)
        if not isinstance(row["category"], str) or not re.fullmatch(
            r"[a-z][a-z0-9_]{0,80}", row["category"]
        ):
            raise ValueError("Invalid aggregate scenario category.")
        if (
            row["language_slice"] not in LANGUAGES
            or row["strategy"] not in {"quality_only", "regex", "presidio", "hybrid"}
            or row["scope"] not in {"quality_gate_only", "pipeline_automated_prerequisites"}
        ):
            raise ValueError("Invalid recorded quality execution metadata.")
        _count(row["records"])
        for key in ("expected_status_counts", "observed_status_counts"):
            _counter(row[key], STATUSES, exact=True)
            if sum(row[key].values()) != row["records"]:
                raise ValueError("Quality record denominator does not match status counts.")
        for key in ("expected_issue_counts", "observed_issue_counts"):
            _counter(row[key], ISSUE_ORDER)
        for key in ("expected_blocking_reasons", "observed_blocking_reasons"):
            if not isinstance(row[key], list) or any(
                not isinstance(item, str) or item not in REASONS for item in row[key]
            ):
                raise ValueError("Invalid quality blocking reasons.")
        for key in (
            "expected_automated_gate_passed",
            "observed_automated_gate_passed",
            "expectations_matched",
        ):
            if type(row[key]) is not bool:
                raise ValueError("Invalid quality verification flag.")
    if (
        len(data["outcomes"]) != data["execution_count"]
        or sum(r["records"] for r in data["outcomes"])
        != data["records_evaluated_including_strategy_repeats"]
    ):
        raise ValueError("Quality execution denominators are inconsistent.")
    if (
        sum(data["status_counts"].values()) != data["records_evaluated_including_strategy_repeats"]
        or sum(data["scenario_language_counts"].values()) != data["scenario_count"]
    ):
        raise ValueError("Quality aggregate denominators are inconsistent.")
    if (
        sum(r["expectations_matched"] for r in data["outcomes"]) != data["matched_executions"]
        or data["matched_executions"] + data["failed_executions"] != data["execution_count"]
    ):
        raise ValueError("Quality verification totals are inconsistent.")
    _keys(data["environment"], {"python", "platform"})
    if any(not isinstance(v, str) for v in data["environment"].values()):
        raise ValueError("Invalid recorded environment.")
    for key in ("privacy_note", "reproduction_command"):
        if not isinstance(data[key], str):
            raise ValueError("Invalid quality provenance metadata.")
    for key, length in (
        ("revision", 40),
        ("quality_source_sha256", 64),
        ("policy_sha256", 64),
        ("release_policy_sha256", 64),
    ):
        if not isinstance(data[key], str) or not re.fullmatch(f"[0-9a-f]{{{length}}}", data[key]):
            raise ValueError("Invalid recorded provenance fingerprint.")
    return data


def export_quality_pdf(source: Path, destination: Path):
    if source.resolve() == destination.resolve():
        raise ValueError("PDF output must differ from recorded JSON.")
    raw = source.read_bytes()
    data = load_quality_results(raw)
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle("QualityBody", fontSize=10, leading=14, spaceAfter=8))
    styles.add(ParagraphStyle("QualityCell", fontSize=8, leading=11))
    styles.add(
        ParagraphStyle("SourceCode", fontName="Courier", fontSize=8, leading=11, spaceAfter=6)
    )
    story = []
    width = landscape(A4)[0] - 72

    def para(text, style="QualityBody"):
        story.append(Paragraph(escape(str(text)), styles[style]))

    def heading(text):
        para(text, "Heading2")

    def table(headers, rows, widths=None):
        cells = [
            [Paragraph(escape(str(v)), styles["QualityCell"]) for v in row]
            for row in [headers, *rows]
        ]
        item = Table(
            cells,
            colWidths=widths or [width / len(headers)] * len(headers),
            repeatRows=1,
            hAlign="LEFT",
        )
        item.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#dbe7f2")),
                    (
                        "ROWBACKGROUNDS",
                        (0, 1),
                        (-1, -1),
                        [colors.white, colors.HexColor("#f3f6fa")],
                    ),
                    ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#c5d1dd")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ]
            )
        )
        story.extend([item, Spacer(1, 10)])

    para("C2 data-quality policy verification", "Title")
    para("Research panel evidence | Conversion of existing recorded results")
    para(
        "Synthetic policy verification only. Not independent research validation and not release authorization."
    )
    heading("What was verified?")
    para(
        "Automated rules for detecting malformed, incomplete or review-worthy anonymized records, and blocking batches that still need review. Expected outcomes were defined from the documented development policy. No fixture or anonymization measurement was rerun during PDF conversion."
    )
    table(
        ["Denominator / result", "Recorded value"],
        [
            ["Distinct synthetic scenarios", data["scenario_count"]],
            ["Executions (strategy repetitions included)", data["execution_count"]],
            [
                "Evaluated records (strategy repetitions included)",
                data["records_evaluated_including_strategy_repeats"],
            ],
            ["Executions matching all expected outcomes", data["matched_executions"]],
            ["Executions with mismatched outcomes", data["failed_executions"]],
        ],
        [width * 0.7, width * 0.3],
    )
    para(
        "Recorded scenario language slices: "
        + "; ".join(
            f"{k.replace('_', ' ').title()}: {v}"
            for k, v in data["scenario_language_counts"].items()
        )
        + ". These are manually assigned fixture labels, not language-identification results."
    )
    para(
        "Direct quality scenarios execute once. Pipeline scenarios execute through the configured anonymization strategies. Repeated executions and records are not independent observations. A matching outcome checks status counts, issue counts, the gate decision and ordered blocking reasons."
    )
    heading("Recorded settings and release meaning")
    para(
        f"Short-text review threshold: fewer than {data['policy']['short_text_review_below']} trimmed source Unicode code points. Case-insensitive text comparison: {data['policy']['comparison_case_insensitive']}. Settings are development-only, not research-approved thresholds."
    )
    para(
        "release_ready indicates automated prerequisites passed. The recorded human-release-required and synthetic-only settings remain true. This report does not approve release, remove a review requirement or change C1 workflows."
    )
    story.append(PageBreak())
    heading("Quality policy rules")
    table(
        ["Condition", "Policy outcome"],
        [
            [
                "Missing/invalid ID or text; malformed row; invalid Unicode surrogate; repeated trimmed ID; invalid privacy-review flag",
                "REJECT",
            ],
            ["Whitespace-empty text", "REJECT"],
            [
                f"Valid nonempty text shorter than {data['policy']['short_text_review_below']} trimmed source code points",
                "REVIEW; never rejected solely for short length",
            ],
            ["Only supported placeholders, or no usable content", "REVIEW"],
            ["Replacement character U+FFFD", "REVIEW"],
            ["Cc controls except tab/LF/CR; Cf formats except ZWNJ/ZWJ", "REVIEW"],
            ["Matching anonymized text key", "REVIEW: possible duplicate or masking collision"],
            ["Unresolved privacy-review flag", "REVIEW and privacy-review blocking"],
            ["No detected quality issue", "PASS"],
        ],
        [width * 0.65, width * 0.35],
    )
    para(
        "Status precedence: REJECT, then REVIEW, then PASS. Every unresolved REVIEW or REJECT blocks release; empty batches fail. All detected issues are retained in deterministic order. No records are silently deleted or merged."
    )
    para(
        "Text comparison key: Unicode NFC, collapse Unicode whitespace, then casefold when configured. Source text remains unchanged, including Sinhala combining marks, meaningful joiners, punctuation and emoji. IDs are string-only, edge-trimmed and case-sensitive, without NFC or casefold."
    )
    para(
        "Usable content means a Unicode letter, number or So symbol (including common emoji) after removing supported placeholders; U+FFFD does not count. Punctuation/marks/joiners alone require review. Input replacement/control signals survive masking. These heuristics do not determine linguistic or clinical meaning."
    )
    story.append(PageBreak())
    heading("Aggregate observed outcomes")
    table(
        ["Record status", "Count (strategy repeats included)"],
        [[s, data["status_counts"][s]] for s in STATUSES],
    )
    table(
        ["Execution gate result", "Count"],
        [
            ["Automated prerequisites passed", data["automated_gate_passed_executions"]],
            ["Automated prerequisites blocked", data["automated_gate_blocked_executions"]],
        ],
    )
    heading("Observed issue counts")
    table(["Issue code", "Count"], [[k, v] for k, v in data["issue_counts"].items()])
    heading("Release-blocking results")
    table(
        ["Blocking reason", "Executions containing this reason"],
        [[k, v] for k, v in data["blocking_reason_counts"].items()],
    )
    para(
        "A record can have multiple issues; an execution can have multiple blocking reasons. Those counts are not mutually exclusive. Quality-only scopes check just the quality gate; pipeline scopes check all automated prerequisites. Human authorization remains a separate requirement in both cases."
    )
    story.append(PageBreak())
    heading("Expected versus observed: aggregate execution evidence")
    para(
        "P/R/J = PASS/REVIEW/REJECT record counts. Gate entries show expected -> observed. Match reflects the recorded verification flag, including expected/observed issues and ordered reasons; it is not a model accuracy percentage. No individual record identifiers or submitted values are shown."
    )

    def status_counts(row, key):
        return "/".join(str(row[key][s]) for s in STATUSES)

    def gate(flag):
        return "Passed" if flag else "Blocked"

    table(
        [
            "Scenario category",
            "Language",
            "Strategy / scope",
            "Expected P/R/J",
            "Observed P/R/J",
            "Expected -> observed gate",
            "Matched",
        ],
        [
            [
                r["category"].replace("_", " "),
                r["language_slice"].replace("_", " "),
                r["strategy"],
                status_counts(r, "expected_status_counts"),
                status_counts(r, "observed_status_counts"),
                f"{gate(r['expected_automated_gate_passed'])} -> {gate(r['observed_automated_gate_passed'])}",
                "Yes" if r["expectations_matched"] else "NO",
            ]
            for r in data["outcomes"]
        ],
        [175, 75, 85, 80, 80, 120, width - 615],
    )
    heading("Expected versus observed issue and reason totals")
    expected_issues, observed_issues = Counter(), Counter()
    expected_reasons, observed_reasons = Counter(), Counter()
    for row in data["outcomes"]:
        expected_issues.update(row["expected_issue_counts"])
        observed_issues.update(row["observed_issue_counts"])
        expected_reasons.update(row["expected_blocking_reasons"])
        observed_reasons.update(row["observed_blocking_reasons"])
    table(
        ["Issue", "Expected occurrences", "Observed occurrences"],
        [
            [k, expected_issues[k], observed_issues[k]]
            for k in sorted(expected_issues.keys() | observed_issues.keys())
        ],
    )
    table(
        ["Blocking reason", "Expected executions", "Observed executions"],
        [
            [k, expected_reasons[k], observed_reasons[k]]
            for k in sorted(expected_reasons.keys() | observed_reasons.keys())
        ],
    )
    para(
        "These tables summarize stored outcome counts only. They do not execute fixtures or invent observations. The exact recorded JSON is embedded as results.json, including each execution's full expected/observed issue counts and ordered reasons."
    )
    story.append(PageBreak())
    heading("Provenance and reproduction")
    para(
        "Recorded hashes, environment and revision describe the original quality verification, not the PDF converter's current working tree. Relocation preserves the original bytes and metadata."
    )
    for key in ("revision", "quality_source_sha256", "policy_sha256", "release_policy_sha256"):
        para(f"{key}: {data[key]}", "SourceCode")
    para("Recorded environment: " + json.dumps(data["environment"], sort_keys=True), "SourceCode")
    para(
        "Recorded release configuration: " + json.dumps(data["release_policy"], sort_keys=True),
        "SourceCode",
    )
    para("Original verification command (historical path; not executed during conversion):")
    para(data["reproduction_command"], "SourceCode")
    para("Current conversion command:")
    para(
        ".\\.venv\\Scripts\\python.exe scripts/run.py preprocessing.quality_pdf --results artifacts/c2-evidence/data-quality/results.json --output artifacts/c2-evidence/data-quality/quality-report.pdf",
        "SourceCode",
    )
    para(f"Source JSON SHA256: {hashlib.sha256(raw).hexdigest()}", "SourceCode")
    heading("Limitations")
    para(
        "These policy-derived regression fixtures verify software behavior, not independent research performance. Counts include strategy repetitions and are not a representative population sample. Heuristics cannot establish wellbeing meaning, identify language or prove that no PII remains. No fuzzy deduplication, full linguistic normalization, tokenization or annotation is provided. Research thresholds and human release review remain separate responsibilities."
    )
    buffer = BytesIO()
    SimpleDocTemplate(
        buffer,
        pagesize=landscape(A4),
        leftMargin=36,
        rightMargin=36,
        topMargin=30,
        bottomMargin=40,
        title="C2 synthetic data-quality policy verification",
        author="J26-SE-338 | Component 2",
    ).build(story, canvasmaker=_NumberedCanvas)
    writer = PdfWriter(clone_from=BytesIO(buffer.getvalue()))
    writer.add_attachment("results.json", raw)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("wb") as output:
        writer.write(output)
    return destination


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--results", type=Path, default=Path("artifacts/c2-evidence/data-quality/results.json")
    )
    parser.add_argument(
        "--output", type=Path, default=Path("artifacts/c2-evidence/data-quality/quality-report.pdf")
    )
    args = parser.parse_args()
    export_quality_pdf(args.results, args.output)
    print(f"Converted recorded aggregate evidence to {args.output}; no fixtures rerun")


if __name__ == "__main__":
    main()
