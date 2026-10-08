import json

import pytest
from preprocessing.privacy_gate import (
    assess_release,
    build_release_summary,
)

SAFE_COLUMNS = ("record_id", "anonymized_text")


def make_safe_record(
    record_id: str = "SYN-001",
    text: str = "Synthetic academic workload example.",
) -> dict[str, str]:
    return {
        "record_id": record_id,
        "anonymized_text": text,
    }


def test_safe_synthetic_dataset_passes():
    result = assess_release(
        SAFE_COLUMNS,
        [make_safe_record()],
    )

    assert result.passed is True
    assert result.total_records == 1
    assert result.issues == ()


def test_empty_dataset_fails():
    result = assess_release(SAFE_COLUMNS, [])

    assert result.passed is False
    assert "empty_dataset" in result.issues


def test_missing_required_column_fails():
    result = assess_release(
        ("record_id",),
        [make_safe_record()],
    )

    assert result.passed is False
    assert "missing_required_columns" in result.issues


@pytest.mark.parametrize(
    "unsafe_column",
    [
        "original_text",
        "detected_values",
        "expected_pii",
        "email",
        "timestamp",
    ],
)
def test_forbidden_column_fails(unsafe_column):
    result = assess_release(
        (*SAFE_COLUMNS, unsafe_column),
        [make_safe_record()],
    )

    assert result.passed is False
    assert "forbidden_columns_present" in result.issues


def test_missing_record_id_fails():
    result = assess_release(
        SAFE_COLUMNS,
        [make_safe_record(record_id="")],
    )

    assert result.passed is False
    assert "missing_record_id" in result.issues


def test_duplicate_record_id_fails():
    result = assess_release(
        SAFE_COLUMNS,
        [
            make_safe_record(
                record_id="SYN-001",
                text="First synthetic example.",
            ),
            make_safe_record(
                record_id="SYN-001",
                text="Second synthetic example.",
            ),
        ],
    )

    assert result.passed is False
    assert "duplicate_record_id" in result.issues


def test_empty_anonymized_text_fails():
    result = assess_release(
        SAFE_COLUMNS,
        [make_safe_record(text="")],
    )

    assert result.passed is False
    assert "empty_anonymized_text" in result.issues


@pytest.mark.parametrize(
    ("unsafe_text", "expected_issue"),
    [
        (
            "Contact synthetic.student@example.com",
            "residual_email",
        ),
        (
            "Call 0771234567",
            "residual_phone",
        ),
        (
            "Identifier IT23123456",
            "residual_student_id",
        ),
    ],
)
def test_residual_structured_pii_fails(
    unsafe_text,
    expected_issue,
):
    result = assess_release(
        SAFE_COLUMNS,
        [make_safe_record(text=unsafe_text)],
    )

    assert result.passed is False
    assert expected_issue in result.issues


def test_release_summary_contains_only_aggregate_metadata():
    synthetic_text = "Synthetic text that must not appear in the report."
    result = assess_release(
        SAFE_COLUMNS,
        [make_safe_record(text=synthetic_text)],
    )

    summary = build_release_summary(result)
    serialized = json.dumps(summary)

    assert summary["status"] == "PASSED"
    assert summary["total_records"] == 1
    assert synthetic_text not in serialized
    assert "anonymized_text" not in serialized
