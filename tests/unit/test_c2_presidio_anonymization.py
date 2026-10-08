from dataclasses import asdict

from preprocessing.presidio_anonymization import (
    anonymize_with_presidio,
)


def test_presidio_masks_synthetic_email():
    synthetic_email = "synthetic.student@example.com"

    result = anonymize_with_presidio(f"Email {synthetic_email} today.")

    assert "[EMAIL]" in result.anonymized_text
    assert synthetic_email not in result.anonymized_text
    assert ("EMAIL_ADDRESS", 1) in result.entity_counts
    assert "presidio:email" in result.transformations
    assert result.requires_review is False


def test_presidio_masks_student_id_and_phone():
    synthetic_student_id = "IT12345678"
    synthetic_phone = "0771234567"

    result = anonymize_with_presidio(f"Student ID {synthetic_student_id} called {synthetic_phone}.")

    assert "[STUDENT_ID]" in result.anonymized_text
    assert "[PHONE]" in result.anonymized_text
    assert synthetic_student_id not in result.anonymized_text
    assert synthetic_phone not in result.anonymized_text
    assert ("STUDENT_ID", 1) in result.entity_counts
    assert ("PHONE_NUMBER", 1) in result.entity_counts


def test_presidio_masks_detected_location():
    result = anonymize_with_presidio("Alice studies in Colombo.")

    assert "[LOCATION]" in result.anonymized_text
    assert "Colombo" not in result.anonymized_text
    assert ("LOCATION", 1) in result.entity_counts
    assert "presidio:location" in result.transformations


def test_presidio_result_does_not_expose_raw_detected_values():
    synthetic_email = "privacy.fixture@example.com"

    result = anonymize_with_presidio(f"Use {synthetic_email} for this synthetic test.")
    serialized_result = str(asdict(result))

    assert synthetic_email not in serialized_result
    assert "original_text" not in asdict(result)
    assert "detected_values" not in asdict(result)


def test_presidio_returns_only_aggregate_entity_counts():
    result = anonymize_with_presidio("Student ID IT87654321 called 0712345678.")

    assert all(
        isinstance(entity_type, str) and isinstance(count, int) and count > 0
        for entity_type, count in result.entity_counts
    )


def test_presidio_flags_unmasked_residual_risk():
    result = anonymize_with_presidio("Synthetic unresolved marker @ remains.")

    assert result.requires_review is True


def test_presidio_handles_empty_text_safely():
    result = anonymize_with_presidio("")

    assert result.anonymized_text == ""
    assert result.entity_counts == ()
    assert result.transformations == ()
    assert result.requires_review is False
