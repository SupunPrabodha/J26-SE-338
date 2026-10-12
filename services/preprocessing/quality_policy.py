"""Explicit development quality policy; source text and comparison keys stay separate."""

import re
import unicodedata
from collections import Counter
from collections.abc import Iterable
from dataclasses import asdict, dataclass
from enum import StrEnum


class QualityStatus(StrEnum):
    PASS = "PASS"
    REVIEW = "REVIEW"
    REJECT = "REJECT"


@dataclass(frozen=True)
class QualityPolicy:
    short_text_review_below: int = 3
    comparison_case_insensitive: bool = True

    def __post_init__(self):
        if type(self.short_text_review_below) is not int or self.short_text_review_below < 1:
            raise ValueError("Short-text review threshold must be a positive integer.")
        if type(self.comparison_case_insensitive) is not bool:
            raise ValueError("Case-insensitive comparison setting must be boolean.")


DEFAULT_QUALITY_POLICY = QualityPolicy()


@dataclass(frozen=True)
class QualityRecord:
    record_id: str | None = None
    anonymized_text: str | None = None
    transformations: tuple[str, ...] = ()
    requires_privacy_review: bool = False
    input_issues: tuple[str, ...] = ()


@dataclass(frozen=True)
class QualityResult:
    record_id: str
    status: QualityStatus
    issues: tuple[str, ...]


BLOCKING_ISSUES = frozenset(
    {
        "malformed_record",
        "missing_record_id",
        "invalid_record_id",
        "missing_text",
        "invalid_text",
        "invalid_unicode_text",
        "empty_text",
        "duplicate_record_id",
        "invalid_privacy_review_flag",
    }
)
REVIEW_ISSUES = frozenset(
    {
        "very_short_text",
        "duplicate_text",
        "placeholder_only_text",
        "no_usable_content",
        "replacement_character",
        "suspicious_control_character",
        "privacy_review_required",
    }
)
ISSUE_ORDER = (
    "malformed_record",
    "missing_record_id",
    "invalid_record_id",
    "duplicate_record_id",
    "missing_text",
    "invalid_text",
    "invalid_unicode_text",
    "empty_text",
    "very_short_text",
    "placeholder_only_text",
    "no_usable_content",
    "replacement_character",
    "suspicious_control_character",
    "duplicate_text",
    "invalid_privacy_review_flag",
    "privacy_review_required",
)
PLACEHOLDER_PATTERN = re.compile(r"\[(?:EMAIL|PHONE|STUDENT_ID|PERSON|LOCATION)\]")


def record_id_key(value: object) -> tuple[str, tuple[str, ...]]:
    """String IDs: trim edge whitespace, case-sensitive, no NFC or casefold."""
    if value is None:
        return "", ("missing_record_id",)
    if not isinstance(value, str):
        return "", ("invalid_record_id",)
    key = value.strip()
    if not key:
        return "", ("missing_record_id",)
    if any(unicodedata.category(c) in {"Cc", "Cf", "Cs"} for c in key):
        return "", ("invalid_record_id",)
    return key, ()


def text_input_issues(value: object) -> tuple[str, ...]:
    if value is None:
        return ("missing_text",)
    if not isinstance(value, str):
        return ("invalid_text",)
    if any(unicodedata.category(c) == "Cs" for c in value):
        return ("invalid_unicode_text",)
    return ()


def text_review_signals(text: str) -> tuple[str, ...]:
    """Signals on valid Unicode strings; never remove source characters."""
    issues = []
    if "\ufffd" in text:
        issues.append("replacement_character")
    if any(
        (unicodedata.category(c) == "Cc" and c not in "\t\n\r")
        or (unicodedata.category(c) == "Cf" and c not in "\u200c\u200d")
        for c in text
    ):
        issues.append("suspicious_control_character")
    return tuple(issues)


def text_comparison_key(text: str, policy: QualityPolicy = DEFAULT_QUALITY_POLICY) -> str:
    """NFC -> whitespace collapse -> optional casefold; never rewrite source.

    Combining marks and meaningful ZWJ/ZWNJ are preserved. Equal keys can be
    masking collisions; they do not prove original submissions were identical.
    """
    key = " ".join(unicodedata.normalize("NFC", text).split())
    return key.casefold() if policy.comparison_case_insensitive else key


def assess_records(
    records: Iterable[QualityRecord], *, policy: QualityPolicy = DEFAULT_QUALITY_POLICY
) -> tuple[QualityResult, ...]:
    if not isinstance(policy, QualityPolicy):
        raise ValueError("Quality policy must be a validated QualityPolicy.")
    if records is None or isinstance(records, (str, bytes)):
        raise ValueError("Quality records must be an iterable of records.")
    try:
        rows = list(records)
    except TypeError:
        raise ValueError("Quality records must be an iterable of records.") from None
    prepared = []
    for row in rows:
        if not isinstance(row, QualityRecord):
            prepared.append(("", "", {"malformed_record"}, None))
            continue
        record_id, id_issues = record_id_key(row.record_id)
        text_issues = text_input_issues(row.anonymized_text)
        text = row.anonymized_text if not text_issues else ""
        issues = set(id_issues + text_issues)
        if isinstance(row.input_issues, tuple) and all(
            isinstance(issue, str) and issue in ISSUE_ORDER for issue in row.input_issues
        ):
            issues.update(row.input_issues)
        else:
            issues.add("malformed_record")
        prepared.append((record_id, text, issues, row))
    ids = Counter(key for key, _, _, _ in prepared if key)
    texts = Counter(
        text_comparison_key(text, policy)
        for _, text, _, _ in prepared
        if text_comparison_key(text, policy)
    )
    results = []
    for record_id, text, issues, row in prepared:
        if record_id and ids[record_id] > 1:
            issues.add("duplicate_record_id")
        key = text_comparison_key(text, policy)
        if not issues.intersection(
            {"malformed_record", "missing_text", "invalid_text", "invalid_unicode_text"}
        ):
            if not key:
                issues.add("empty_text")
            else:
                if len(text.strip()) < policy.short_text_review_below:
                    issues.add("very_short_text")
                remaining = PLACEHOLDER_PATTERN.sub("", text)
                usable = any(
                    (unicodedata.category(c)[0] in {"L", "N"} or unicodedata.category(c) == "So")
                    and c != "\ufffd"
                    for c in remaining
                )
                if not usable:
                    issues.add(
                        "placeholder_only_text"
                        if PLACEHOLDER_PATTERN.search(text)
                        else "no_usable_content"
                    )
                if texts[key] > 1:
                    issues.add("duplicate_text")
            issues.update(text_review_signals(text))
        if row is not None:
            if type(row.requires_privacy_review) is not bool:
                issues.add("invalid_privacy_review_flag")
            elif row.requires_privacy_review:
                issues.add("privacy_review_required")
        status = (
            QualityStatus.REJECT
            if issues & BLOCKING_ISSUES
            else QualityStatus.REVIEW
            if issues & REVIEW_ISSUES
            else QualityStatus.PASS
        )
        results.append(
            QualityResult(
                record_id, status, tuple(issue for issue in ISSUE_ORDER if issue in issues)
            )
        )
    return tuple(results)


def quality_blocking_reasons(results: Iterable[QualityResult]) -> tuple[str, ...]:
    rows = tuple(results)
    return tuple(
        reason
        for reason, present in (
            ("empty_batch", not rows),
            ("data_quality_rejected", any(row.status == QualityStatus.REJECT for row in rows)),
            (
                "data_quality_review_required",
                any(row.status == QualityStatus.REVIEW for row in rows),
            ),
        )
        if present
    )


def build_quality_summary(
    results: Iterable[QualityResult], *, policy: QualityPolicy = DEFAULT_QUALITY_POLICY
) -> dict[str, object]:
    if not isinstance(policy, QualityPolicy):
        raise ValueError("Quality policy must be a validated QualityPolicy.")
    rows = tuple(results)
    counts = Counter(row.status.value for row in rows)
    reasons = quality_blocking_reasons(rows)
    return {
        "total_records": len(rows),
        "status_counts": {status.value: counts[status.value] for status in QualityStatus},
        "issue_counts": dict(
            sorted(Counter(issue for row in rows for issue in row.issues).items())
        ),
        "data_quality_gate": "FAILED" if reasons else "PASSED",
        "blocking_reasons": list(reasons),
        "policy": asdict(policy),
        "policy_status": "development_only_not_research_approved",
        "release_ready_meaning": "Automated prerequisites only; human release approval remains required.",
        "duplicate_text_meaning": "Possible duplicate or masking collision; original equivalence is not asserted.",
        "privacy_note": "Aggregate metadata only; submitted text and record identifiers are excluded.",
    }
