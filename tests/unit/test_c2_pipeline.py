import json

from preprocessing.data_quality import QualityStatus
from preprocessing.pipeline import (
    PipelineInput,
    build_pipeline_summary,
    run_preprocessing_pipeline,
)


def test_pipeline_anonymizes_email_and_allows_release():
    result = run_preprocessing_pipeline(
        [
            PipelineInput(
                record_id="synthetic-001",
                text="Contact me using test.student@example.com",
            )
        ]
    )

    assert result.release_ready is True
    assert result.blocking_reasons == ()
    assert result.records[0].anonymized_text == "Contact me using [EMAIL]"
    assert result.records[0].transformations == ("mask:email",)
    assert result.records[0].quality_status == QualityStatus.PASS
    assert "test.student@example.com" not in result.records[0].anonymized_text


def test_pipeline_allows_safe_text_without_transformations():
    result = run_preprocessing_pipeline(
        [
            PipelineInput(
                record_id="synthetic-002",
                text="The synthetic timetable feels busy this week.",
            )
        ]
    )

    record = result.records[0]

    assert result.release_ready is True
    assert record.transformations == ()
    assert record.quality_status == QualityStatus.PASS
    assert record.requires_privacy_review is False


def test_pipeline_handles_mixed_language_synthetic_text():
    result = run_preprocessing_pipeline(
        [
            PipelineInput(
                record_id="synthetic-003",
                text="Mage nama Nimal and call me on 0771234567.",
            )
        ]
    )

    anonymized_text = result.records[0].anonymized_text

    assert result.release_ready is True
    assert "[PERSON]" in anonymized_text
    assert "[PHONE]" in anonymized_text
    assert "Nimal" not in anonymized_text
    assert "0771234567" not in anonymized_text


def test_pipeline_blocks_duplicate_record_ids():
    result = run_preprocessing_pipeline(
        [
            PipelineInput(
                record_id="synthetic-duplicate",
                text="First disposable synthetic example.",
            ),
            PipelineInput(
                record_id="synthetic-duplicate",
                text="Second disposable synthetic example.",
            ),
        ]
    )

    assert result.release_ready is False
    assert "data_quality_rejected" in result.blocking_reasons
    assert "release_privacy_gate_failed" in result.blocking_reasons
    assert all(record.quality_status == QualityStatus.REJECT for record in result.records)


def test_pipeline_blocks_empty_text():
    result = run_preprocessing_pipeline(
        [
            PipelineInput(
                record_id="synthetic-empty",
                text="",
            )
        ]
    )

    assert result.release_ready is False
    assert "data_quality_rejected" in result.blocking_reasons
    assert result.records[0].quality_status == QualityStatus.REJECT


def test_pipeline_blocks_residual_privacy_risk():
    result = run_preprocessing_pipeline(
        [
            PipelineInput(
                record_id="synthetic-risk",
                text="Synthetic reference number is 12345678.",
            )
        ]
    )

    assert result.release_ready is False
    assert "privacy_review_required" in result.blocking_reasons
    assert result.records[0].requires_privacy_review is True


def test_pipeline_blocks_empty_dataset_release():
    result = run_preprocessing_pipeline([])

    assert result.records == ()
    assert result.release_ready is False
    assert "release_privacy_gate_failed" in result.blocking_reasons


def test_pipeline_summary_contains_only_aggregate_evidence():
    submitted_text = "Email sample.person@example.com for help."

    result = run_preprocessing_pipeline(
        [
            PipelineInput(
                record_id="synthetic-summary",
                text=submitted_text,
            )
        ]
    )
    summary = build_pipeline_summary(result)
    serialized_summary = json.dumps(summary)

    assert summary["records_processed"] == 1
    assert summary["release_ready"] is True
    assert summary["transformation_counts"] == {"mask:email": 1}
    assert submitted_text not in serialized_summary
    assert "sample.person@example.com" not in serialized_summary
    assert "Email [EMAIL] for help." not in serialized_summary
