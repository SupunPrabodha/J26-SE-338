import json

from preprocessing.data_quality import (
    QualityRecord,
    QualityStatus,
    assess_records,
    build_quality_summary,
)


def make_valid_record(
    record_id: str = "SYN-001",
    text: str = "Synthetic academic workload example.",
) -> QualityRecord:
    return QualityRecord(
        record_id=record_id,
        anonymized_text=text,
        transformations=("email_masked",),
    )


def test_valid_record_passes():
    results = assess_records([make_valid_record()])

    assert len(results) == 1
    assert results[0].status == QualityStatus.PASS
    assert results[0].issues == ()


def test_missing_record_id_is_rejected():
    record = make_valid_record(record_id="")

    result = assess_records([record])[0]

    assert result.status == QualityStatus.REJECT
    assert "missing_record_id" in result.issues


def test_empty_text_is_rejected():
    record = make_valid_record(text="")

    result = assess_records([record])[0]

    assert result.status == QualityStatus.REJECT
    assert "empty_text" in result.issues


def test_very_short_text_requires_review():
    record = make_valid_record(text="x")

    result = assess_records([record])[0]

    assert result.status == QualityStatus.REVIEW
    assert "very_short_text" in result.issues


def test_duplicate_record_ids_are_rejected():
    records = [
        make_valid_record(
            record_id="SYN-001",
            text="First synthetic example.",
        ),
        make_valid_record(
            record_id="SYN-001",
            text="Second synthetic example.",
        ),
    ]

    results = assess_records(records)

    assert all(result.status == QualityStatus.REJECT for result in results)
    assert all("duplicate_record_id" in result.issues for result in results)


def test_duplicate_text_requires_review():
    records = [
        make_valid_record(
            record_id="SYN-001",
            text="Repeated synthetic example.",
        ),
        make_valid_record(
            record_id="SYN-002",
            text="repeated synthetic example.",
        ),
    ]

    results = assess_records(records)

    assert all(result.status == QualityStatus.REVIEW for result in results)
    assert all("duplicate_text" in result.issues for result in results)


def test_privacy_risk_requires_review():
    record = QualityRecord(
        record_id="SYN-001",
        anonymized_text="Synthetic example with uncertain identifier.",
        transformations=("student_id_masked",),
        requires_privacy_review=True,
    )

    result = assess_records([record])[0]

    assert result.status == QualityStatus.REVIEW
    assert "privacy_review_required" in result.issues


def test_missing_transformations_requires_review():
    record = QualityRecord(
        record_id="SYN-001",
        anonymized_text="Synthetic record without transformations.",
    )

    result = assess_records([record])[0]

    assert result.status == QualityStatus.REVIEW
    assert "missing_transformations" in result.issues


def test_summary_passes_without_rejected_records():
    results = assess_records(
        [
            make_valid_record(
                record_id="SYN-001",
                text="First synthetic example.",
            ),
            make_valid_record(
                record_id="SYN-002",
                text="Second synthetic example.",
            ),
        ]
    )

    summary = build_quality_summary(results)

    assert summary["total_records"] == 2
    assert summary["status_counts"]["PASS"] == 2
    assert summary["data_quality_gate"] == "PASSED"


def test_summary_fails_when_record_is_rejected():
    results = assess_records(
        [
            make_valid_record(record_id=""),
        ]
    )

    summary = build_quality_summary(results)

    assert summary["status_counts"]["REJECT"] == 1
    assert summary["data_quality_gate"] == "FAILED"


def test_empty_batch_fails_quality_gate():
    summary = build_quality_summary(())

    assert summary["total_records"] == 0
    assert summary["data_quality_gate"] == "FAILED"


def test_summary_does_not_expose_submitted_text():
    sensitive_synthetic_text = "Synthetic private example text."
    results = assess_records(
        [
            make_valid_record(text=sensitive_synthetic_text),
        ]
    )

    summary = build_quality_summary(results)
    serialized_summary = json.dumps(summary)

    assert sensitive_synthetic_text not in serialized_summary
    assert "anonymized_text" not in serialized_summary
