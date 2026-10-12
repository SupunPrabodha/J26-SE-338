"""Privacy-safe C2 preprocessing pipeline orchestration."""

from collections.abc import Iterable
from dataclasses import dataclass

from preprocessing.anonymization import anonymize_text
from preprocessing.data_quality import (
    DEFAULT_QUALITY_POLICY,
    QualityPolicy,
    QualityRecord,
    QualityStatus,
    assess_records,
    build_quality_summary,
    quality_blocking_reasons,
    text_input_issues,
    text_review_signals,
)
from preprocessing.privacy_gate import (
    assess_release,
    build_release_summary,
)


@dataclass(frozen=True)
class PipelineInput:
    record_id: str | None = None
    text: str | None = None


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
    *,
    strategy: str = "regex",
    quality_policy: QualityPolicy = DEFAULT_QUALITY_POLICY,
) -> PipelineResult:
    """Run automated prerequisites; release_ready never authorizes human release."""
    if strategy not in {"regex", "presidio", "hybrid"}:
        raise ValueError("Unknown anonymization strategy")
    anonymizer = anonymize_text
    if strategy == "presidio":
        from preprocessing.presidio_anonymization import anonymize_with_presidio

        anonymizer = anonymize_with_presidio
    elif strategy == "hybrid":
        from preprocessing.hybrid_anonymization import anonymize_with_hybrid

        anonymizer = anonymize_with_hybrid
    if not isinstance(quality_policy, QualityPolicy):
        raise ValueError("Quality policy must be a validated QualityPolicy.")
    if records is None or isinstance(records, (str, bytes)):
        raise ValueError("Pipeline records must be an iterable of records.")
    try:
        input_records = list(records)
    except TypeError:
        raise ValueError("Pipeline records must be an iterable of records.") from None
    quality_records = []
    for record in input_records:
        if not isinstance(record, PipelineInput):
            quality_records.append(QualityRecord(None, None, input_issues=("malformed_record",)))
            continue
        issues = text_input_issues(record.text)
        if issues:
            quality_records.append(QualityRecord(record.record_id, record.text))
            continue
        anonymized = anonymizer(record.text)
        quality_records.append(
            QualityRecord(
                record.record_id,
                anonymized.anonymized_text,
                anonymized.transformations,
                anonymized.requires_review,
                text_review_signals(record.text),
            )
        )

    quality_results = assess_records(quality_records, policy=quality_policy)

    outputs = tuple(
        PipelineOutput(
            record_id=quality.record_id,
            anonymized_text=anonymized.anonymized_text
            if not text_input_issues(anonymized.anonymized_text)
            else "",
            transformations=anonymized.transformations,
            quality_status=quality.status,
            quality_issues=quality.issues,
            requires_privacy_review=anonymized.requires_privacy_review,
        )
        for anonymized, quality in zip(
            quality_records,
            quality_results,
            strict=True,
        )
    )

    quality_summary = build_quality_summary(quality_results, policy=quality_policy)

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

    blocking_reasons = list(quality_blocking_reasons(quality_results))

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
        "release_ready_meaning": "Automated prerequisites passed; not human release authorization.",
        "human_release_required": True,
        "blocking_reasons": list(result.blocking_reasons),
        "transformation_counts": dict(sorted(transformation_counts.items())),
        "quality_summary": result.quality_summary,
        "privacy_summary": result.privacy_summary,
        "privacy_note": ("Aggregate pipeline evidence only; submitted text is excluded."),
    }
