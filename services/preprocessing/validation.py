"""Text-free, deterministic diagnostics on actual C2 outputs; not an accuracy oracle."""

from __future__ import annotations

import unicodedata
from collections import Counter
from typing import TYPE_CHECKING

import regex

from preprocessing.privacy_gate import EMAIL_PATTERN, PHONE_PATTERN, STUDENT_ID_PATTERN
from preprocessing.quality_policy import BLOCKING_ISSUES, REVIEW_ISSUES
from preprocessing.residual_privacy import assess_output
from preprocessing.text_processing import PLACEHOLDER

if TYPE_CHECKING:
    from preprocessing.pipeline import PipelineOutput

VERSION = "c2-output-validation-v1.1+residual-output-v1"
STAGES = ("anonymization", "quality", "language_id", "normalization", "tokenization")
SOURCE = "services/preprocessing/validation.py"

# Policy definitions are explicit and versioned; no fixture-specific names or outputs.
RULES = (
    ("anonymization.residual_email", "No supported email pattern remains.", "check_privacy"),
    (
        "anonymization.residual_phone",
        "No supported Sri Lankan mobile pattern remains.",
        "check_privacy",
    ),
    (
        "anonymization.residual_student_id",
        "No supported student-ID pattern remains.",
        "check_privacy",
    ),
    (
        "anonymization.review_flag",
        "No existing automated privacy-review flag is set.",
        "check_privacy",
    ),
    (
        "anonymization.person_field",
        "Explicit name fields contain no lexical residue; NO_SIGNAL is not proof of anonymity.",
        "check_residual_output",
    ),
    (
        "anonymization.location_field",
        "Explicit location/address fields contain no lexical residue; bounded policy check, not complete NER.",
        "check_residual_output",
    ),
    (
        "anonymization.person_context",
        "Unresolved naming-context content requires review, not a claim of confirmed PII.",
        "check_residual_output",
    ),
    (
        "anonymization.location_context",
        "Unresolved locative-context content requires review, not a claim of confirmed PII.",
        "check_residual_output",
    ),
    (
        "anonymization.placeholder_type",
        "A placeholder contradicting an explicit entity context requires review; type correctness is otherwise not measured.",
        "check_residual_output",
    ),
    ("quality.policy", "Use the actual PASS/REVIEW/REJECT policy result.", "check_quality"),
    (
        "language_id.evidence",
        "Report provisional evidence or abstention; this does not establish label accuracy.",
        "check_language",
    ),
    ("normalization.nfc", "Derived text is in Unicode NFC.", "check_normalization"),
    (
        "normalization.whitespace",
        "No leading/trailing/repeated Unicode whitespace remains.",
        "check_normalization",
    ),
    (
        "normalization.content",
        "NFC non-whitespace chunks match the anonymized source in order and case.",
        "check_normalization",
    ),
    (
        "normalization.placeholders",
        "Placeholder sequence/count is unchanged.",
        "check_normalization",
    ),
    (
        "tokenization.offsets",
        "Offsets are ordered non-empty code-point spans matching tokens.",
        "check_tokens",
    ),
    ("tokenization.graphemes", "No token boundary splits a Unicode grapheme.", "check_tokens"),
    (
        "tokenization.coverage",
        "Every non-whitespace code point is covered exactly once.",
        "check_tokens",
    ),
    (
        "tokenization.placeholders",
        "Each placeholder occupies one token, including attached marks.",
        "check_tokens",
    ),
)


def result(rule_id, status, reasons=()):
    return {"rule_id": rule_id, "status": status, "reasons": list(reasons)}


def outcome(passed):
    return "PASS" if passed else "FAIL"


def check_privacy(record):
    """Pattern non-detection is bounded evidence, never proof of PII absence."""
    usable = bool(record.anonymized_text.strip())
    checks = [
        result(
            "anonymization." + name,
            outcome(not pattern.search(record.anonymized_text)) if usable else "NOT_EVALUATED",
            ("supported_structured_identifier_remains",)
            if usable and pattern.search(record.anonymized_text)
            else ()
            if usable
            else ("no_usable_anonymized_text",),
        )
        for name, pattern in (
            ("residual_email", EMAIL_PATTERN),
            ("residual_phone", PHONE_PATTERN),
            ("residual_student_id", STUDENT_ID_PATTERN),
        )
    ]
    checks.append(
        result(
            "anonymization.review_flag",
            "FAIL"
            if type(record.requires_privacy_review) is not bool
            else "REVIEW"
            if record.requires_privacy_review
            else "PASS"
            if usable
            else "NOT_EVALUATED",
            ("privacy_review_required",) if record.requires_privacy_review else (),
        )
    )
    return checks


def check_quality(record):
    status = {"PASS": "PASS", "REVIEW": "REVIEW", "REJECT": "FAIL"}.get(
        record.quality_status, "FAIL"
    )
    reasons = [
        issue if issue in BLOCKING_ISSUES | REVIEW_ISSUES else "unrecognized_quality_issue"
        for issue in record.quality_issues
    ]
    return [result("quality.policy", status, reasons)]


def check_residual_output(record):
    """Output-only signals; never reinterpret non-detection as verified safety."""
    signals = assess_output(record.anonymized_text)
    checks = []
    for name in (
        "person_field",
        "location_field",
        "person_context",
        "location_context",
        "placeholder_type",
    ):
        found = [signal for signal in signals if signal.rule_id == name]
        checks.append(
            result(
                "anonymization." + name,
                "FAIL"
                if any(s.status == "FAIL" for s in found)
                else "REVIEW"
                if found
                else "PASS"
                if record.anonymized_text.strip()
                else "NOT_EVALUATED",
                tuple(s.reason for s in found) if found else ("no_signal_not_verified_anonymity",),
            )
        )
    return checks


def check_language(record):
    language = record.language_identification
    status = (
        "NOT_EVALUATED"
        if language.status == "unknown"
        else "REVIEW"
        if language.uncertain or language.status == "uncertain"
        else "PASS"
    )
    return [result("language_id.evidence", status, ("label_accuracy_not_measured",))]


def check_normalization(record):
    source, derived = record.anonymized_text, record.normalized_text
    checks = {
        "nfc": unicodedata.is_normalized("NFC", derived),
        "whitespace": derived == " ".join(derived.split()),
        "content": unicodedata.normalize("NFC", source).split() == derived.split(),
        "placeholders": PLACEHOLDER.findall(source) == PLACEHOLDER.findall(derived),
    }
    return [
        result("normalization." + name, outcome(passed) if source.strip() else "NOT_EVALUATED")
        for name, passed in checks.items()
    ]


def check_tokens(record):
    text, tokens, offsets = record.normalized_text, record.tokens, record.token_offsets
    boundaries = {0, len(text)} | {
        edge for match in regex.finditer(r"\X", text) for edge in match.span()
    }
    valid = len(tokens) == len(offsets) and all(
        isinstance(pair, (tuple, list))
        and len(pair) == 2
        and all(type(edge) is int for edge in pair)
        and 0 <= pair[0] < pair[1] <= len(text)
        for pair in offsets
    )
    ordered = valid and all(a[1] <= b[0] for a, b in zip(offsets, offsets[1:], strict=False))
    exact = valid and all(
        text[start:end] == token for token, (start, end) in zip(tokens, offsets, strict=True)
    )
    covered = (
        Counter(i for start, end in offsets for i in range(start, end)) if valid else Counter()
    )
    expected = Counter(i for i, character in enumerate(text) if not character.isspace())
    pairs = {tuple(pair) for pair in offsets} if valid else set()
    placeholders = all(
        (match.start(), min(edge for edge in boundaries if edge >= match.end())) in pairs
        for match in PLACEHOLDER.finditer(text)
    )
    checks = {
        "offsets": ordered and exact,
        "graphemes": valid
        and all(start in boundaries and end in boundaries for start, end in offsets),
        "coverage": valid and covered == expected,
        "placeholders": valid and placeholders,
    }
    return [
        result(
            "tokenization." + name,
            outcome(passed) if record.anonymized_text.strip() else "NOT_EVALUATED",
        )
        for name, passed in checks.items()
    ]


def build_validation_summary(records: tuple[PipelineOutput, ...], *, strategy: str):
    """Report ordinal positions, rule IDs and outcomes; never submitted text/values/IDs.

    Diagnostic only: existing quality/privacy/release decisions are not overridden.
    Rates count records passing ALL stage rules, not the fraction of easy rules.
    """
    rows = [
        {
            "record_index": index,
            "checks": [
                check
                for function in (
                    check_privacy,
                    check_residual_output,
                    check_quality,
                    check_language,
                    check_normalization,
                    check_tokens,
                )
                for check in function(record)
            ],
        }
        for index, record in enumerate(records, 1)
    ]
    stages = []
    for stage in STAGES:
        counts = Counter()
        for row in rows:
            statuses = {
                check["status"]
                for check in row["checks"]
                if check["rule_id"].startswith(stage + ".")
            }
            status = next(
                value for value in ("FAIL", "REVIEW", "NOT_EVALUATED", "PASS") if value in statuses
            )
            counts[status] += 1
        checked = counts["PASS"] + counts["FAIL"] + counts["REVIEW"]
        stages.append(
            {
                "stage": stage,
                "checked_records": checked,
                "passed_records": counts["PASS"],
                "failed_records": counts["FAIL"],
                "review_records": counts["REVIEW"],
                "not_evaluated_records": counts["NOT_EVALUATED"],
                "pass_rate_percent": round(100 * counts["PASS"] / checked, 2) if checked else None,
            }
        )
    return {
        "method": VERSION,
        "anonymization_strategy": strategy,
        "records_processed": len(rows),
        "measurement": "policy_and_integrity_checks_not_accuracy",
        "accuracy_status": "NOT_MEASURED",
        "release_policy_unchanged": False,
        "rules": [
            {
                "rule_id": rule_id,
                "description": description,
                "source_path": SOURCE,
                "source_function": function,
            }
            for rule_id, description, function in RULES
        ],
        "records": rows,
        "stages": stages,
    }
