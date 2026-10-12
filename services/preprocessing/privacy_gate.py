"""Strict privacy checks applied before synthetic dataset release."""

import re
from collections import Counter
from collections.abc import Iterable, Mapping
from dataclasses import dataclass

from preprocessing.data_quality import record_id_key, text_input_issues

FORBIDDEN_COLUMNS = frozenset(
    {
        "original_text",
        "detected_values",
        "expected_pii",
        "email",
        "timestamp",
    }
)

REQUIRED_COLUMNS = frozenset(
    {
        "record_id",
        "anonymized_text",
    }
)

EMAIL_PATTERN = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
PHONE_PATTERN = re.compile(r"(?<!\d)(?:\+94|0)[\s-]?7\d(?:[\s-]?\d){7}(?!\d)")
STUDENT_ID_PATTERN = re.compile(r"\b[A-Za-z]{2}\d{8}\b")


@dataclass(frozen=True)
class ReleaseGateResult:
    passed: bool
    total_records: int
    issues: tuple[str, ...]
    issue_counts: Mapping[str, int]


def assess_release(
    fieldnames: Iterable[str],
    records: Iterable[Mapping[str, object]],
) -> ReleaseGateResult:
    """Return aggregate privacy evidence without exposing record text."""
    if (
        fieldnames is None
        or isinstance(fieldnames, (str, bytes))
        or records is None
        or isinstance(records, (str, bytes))
    ):
        raise ValueError("Release fields and records must be iterables.")
    try:
        columns = list(fieldnames)
        record_list = list(records)
    except TypeError:
        raise ValueError("Release fields and records must be iterables.") from None
    available_columns = {
        fieldname.strip()
        for fieldname in columns
        if isinstance(fieldname, str) and fieldname.strip()
    }

    missing_columns = sorted(REQUIRED_COLUMNS - available_columns)
    unsafe_columns = sorted(FORBIDDEN_COLUMNS & available_columns)

    counts: Counter[str] = Counter()
    seen_record_ids: set[str] = set()

    counts["missing_required_columns"] = len(missing_columns)
    counts["forbidden_columns"] = len(unsafe_columns)
    counts["invalid_fieldnames"] = sum(not isinstance(fieldname, str) for fieldname in columns)

    for record in record_list:
        if not isinstance(record, Mapping):
            counts["malformed_record"] += 1
            continue
        record_id, id_issues = record_id_key(record.get("record_id"))
        counts.update(id_issues)
        text = record.get("anonymized_text")
        text_issues = text_input_issues(text)
        if text_issues:
            counts["invalid_anonymized_text"] += 1
            anonymized_text = ""
        else:
            anonymized_text = text.strip()

        if not record_id:
            pass  # Already counted missing/invalid ID without string coercion.
        elif record_id in seen_record_ids:
            counts["duplicate_record_id"] += 1
        else:
            seen_record_ids.add(record_id)

        if not anonymized_text:
            counts["empty_anonymized_text"] += 1
            continue

        counts["residual_email"] += len(EMAIL_PATTERN.findall(anonymized_text))
        counts["residual_phone"] += len(PHONE_PATTERN.findall(anonymized_text))
        counts["residual_student_id"] += len(STUDENT_ID_PATTERN.findall(anonymized_text))

    issues: list[str] = []

    if not record_list:
        issues.append("empty_dataset")

    if missing_columns:
        issues.append("missing_required_columns")

    if unsafe_columns:
        issues.append("forbidden_columns_present")

    issue_mapping = {
        "invalid_fieldnames": "invalid_fieldnames",
        "malformed_record": "malformed_record",
        "invalid_record_id": "invalid_record_id",
        "invalid_anonymized_text": "invalid_anonymized_text",
        "missing_record_id": "missing_record_id",
        "duplicate_record_id": "duplicate_record_id",
        "empty_anonymized_text": "empty_anonymized_text",
        "residual_email": "residual_email",
        "residual_phone": "residual_phone",
        "residual_student_id": "residual_student_id",
    }

    for count_name, issue_name in issue_mapping.items():
        if counts[count_name]:
            issues.append(issue_name)

    public_counts = {name: count for name, count in sorted(counts.items()) if count}

    return ReleaseGateResult(
        passed=not issues,
        total_records=len(record_list),
        issues=tuple(issues),
        issue_counts=public_counts,
    )


def build_release_summary(result: ReleaseGateResult) -> dict[str, object]:
    """Build a privacy-safe aggregate report."""
    return {
        "pipeline_stage": "release_privacy_gate",
        "total_records": result.total_records,
        "status": "PASSED" if result.passed else "FAILED",
        "issues": list(result.issues),
        "issue_counts": dict(result.issue_counts),
        "privacy_note": ("Aggregate metadata only; submitted and detected text is excluded."),
        "limitation": (
            "Automated checks cover supported structured identifiers. "
            "Indirect identifiers still require controlled human review."
        ),
    }
