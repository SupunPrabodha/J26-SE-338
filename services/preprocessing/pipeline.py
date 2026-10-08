"""Privacy-safe C2 preprocessing pipeline orchestration."""

from collections.abc import Iterable
from dataclasses import dataclass

from preprocessing.anonymization import anonymize_text
from preprocessing.data_quality import (
    QualityRecord,
    QualityStatus,
    assess_records,
    build_quality_summary,
)
from preprocessing.privacy_gate import (
    assess_release,
    build_release_summary,
)


@dataclass(frozen=True)
class PipelineInput:
    record_id: str
    text: str


@dataclass(frozen=True)
class PipelineOutput:
    record_id: str
    anonymized_text: str
    transformations: tuple[str, ...]
    quality_status: QualityStatus
    quality_issues: tuple[str, ...]
    requires_privacy_review: bool


@dataclass(frozen=True)
class PipelineResult:
    records: tuple[PipelineOutput, ...]
    quality_summary: dict[str, object]
    privacy_summary: dict[str, object]
    release_ready: bool
    blocking_reasons: tuple[str, ...]


def run_preprocessing_pipeline(
    records: Iterable[PipelineInput],
) -> PipelineResult:
    """Run anonymization, quality checks, and the release privacy gate."""
    input_records = list(records)
    anonymized_results = [anonymize_text(record.text) for record in input_records]

    quality_records = [
        QualityRecord(
            record_id=input_record.record_id,
            anonymized_text=anonymized.anonymized_text,
            transformations=anonymized.transformations,
            requires_privacy_review=anonymized.requires_review,
        )
        for input_record, anonymized in zip(
            input_records,
            anonymized_results,
            strict=True,
        )
    ]

    quality_results = assess_records(quality_records)

    outputs = tuple(
        PipelineOutput(
            record_id=input_record.record_id.strip(),
            anonymized_text=anonymized.anonymized_text,
            transformations=anonymized.transformations,
            quality_status=quality.status,
            quality_issues=quality.issues,
            requires_privacy_review=anonymized.requires_review,
        )
        for input_record, anonymized, quality in zip(
            input_records,
            anonymized_results,
            quality_results,
            strict=True,
        )
    )

    quality_summary = build_quality_summary(quality_results)

    release_records = [
        {
            "record_id": output.record_id,
            "anonymized_text": output.anonymized_text,
        }
        for output in outputs
    ]

    privacy_result = assess_release(
        ("record_id", "anonymized_text"),
        release_records,
    )
    privacy_summary = build_release_summary(privacy_result)

    blocking_reasons: list[str] = []

    if any(output.quality_status == QualityStatus.REJECT for output in outputs):
        blocking_reasons.append("data_quality_rejected")

    if any(output.requires_privacy_review for output in outputs):
        blocking_reasons.append("privacy_review_required")

    if not privacy_result.passed:
        blocking_reasons.append("release_privacy_gate_failed")

    return PipelineResult(
        records=outputs,
        quality_summary=quality_summary,
        privacy_summary=privacy_summary,
        release_ready=not blocking_reasons,
        blocking_reasons=tuple(blocking_reasons),
    )


def build_pipeline_summary(
    result: PipelineResult,
) -> dict[str, object]:
    """Create pipeline evidence without including submitted text."""
    transformation_counts: dict[str, int] = {}

    for record in result.records:
        for transformation in record.transformations:
            transformation_counts[transformation] = transformation_counts.get(transformation, 0) + 1

    return {
        "pipeline_stage": "c2_anonymization_and_quality",
        "records_processed": len(result.records),
        "release_ready": result.release_ready,
        "blocking_reasons": list(result.blocking_reasons),
        "transformation_counts": dict(sorted(transformation_counts.items())),
        "quality_summary": result.quality_summary,
        "privacy_summary": result.privacy_summary,
        "privacy_note": ("Aggregate pipeline evidence only; submitted text is excluded."),
    }
