"""Privacy-safe quality checks for anonymized synthetic records."""

from collections import Counter
from collections.abc import Iterable
from dataclasses import dataclass
from enum import StrEnum


class QualityStatus(StrEnum):
    PASS = "PASS"
    REVIEW = "REVIEW"
    REJECT = "REJECT"


@dataclass(frozen=True)
class QualityRecord:
    record_id: str
    anonymized_text: str
    transformations: tuple[str, ...] = ()
    requires_privacy_review: bool = False


@dataclass(frozen=True)
class QualityResult:
    record_id: str
    status: QualityStatus
    issues: tuple[str, ...]


BLOCKING_ISSUES = {
    "missing_record_id",
    "empty_text",
    "duplicate_record_id",
}

REVIEW_ISSUES = {
    "very_short_text",
    "duplicate_text",
    "privacy_review_required",
    "missing_transformations",
}


def assess_records(records: Iterable[QualityRecord]) -> tuple[QualityResult, ...]:
    """Assess anonymized records without returning or logging their text."""
    record_list = list(records)

    normalized_ids = [record.record_id.strip() for record in record_list]
    normalized_texts = [record.anonymized_text.strip() for record in record_list]

    id_counts = Counter(value for value in normalized_ids if value)
    text_counts = Counter(value.casefold() for value in normalized_texts if value)

    results: list[QualityResult] = []

    for record, record_id, text in zip(
        record_list,
        normalized_ids,
        normalized_texts,
        strict=True,
    ):
        issues: list[str] = []

        if not record_id:
            issues.append("missing_record_id")
        elif id_counts[record_id] > 1:
            issues.append("duplicate_record_id")

        if not text:
            issues.append("empty_text")
        else:
            if len(text) < 3:
                issues.append("very_short_text")

            if text_counts[text.casefold()] > 1:
                issues.append("duplicate_text")

        if record.requires_privacy_review:
            issues.append("privacy_review_required")

        if not record.transformations:
            issues.append("missing_transformations")

        if any(issue in BLOCKING_ISSUES for issue in issues):
            status = QualityStatus.REJECT
        elif any(issue in REVIEW_ISSUES for issue in issues):
            status = QualityStatus.REVIEW
        else:
            status = QualityStatus.PASS

        results.append(
            QualityResult(
                record_id=record_id,
                status=status,
                issues=tuple(issues),
            )
        )

    return tuple(results)


def build_quality_summary(results: Iterable[QualityResult]) -> dict[str, object]:
    """Create aggregate evidence that never contains submitted text."""
    result_list = list(results)
    status_counts = Counter(result.status.value for result in result_list)
    issue_counts = Counter(issue for result in result_list for issue in result.issues)

    rejected_records = status_counts[QualityStatus.REJECT.value]

    return {
        "total_records": len(result_list),
        "status_counts": {status.value: status_counts[status.value] for status in QualityStatus},
        "issue_counts": dict(sorted(issue_counts.items())),
        "data_quality_gate": ("PASSED" if result_list and rejected_records == 0 else "FAILED"),
        "privacy_note": ("Aggregate quality metadata only; submitted text is excluded."),
    }
