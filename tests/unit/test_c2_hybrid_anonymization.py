from dataclasses import asdict

from preprocessing.hybrid_anonymization import anonymize_with_hybrid


def test_hybrid_masks_email_with_regex():
    email = "synthetic.student@example.com"

    result = anonymize_with_hybrid(f"Contact {email} today.")

    assert "[EMAIL]" in result.anonymized_text
    assert email not in result.anonymized_text
    assert "mask:email" in result.regex_transformations
    assert "mask:email" in result.transformations


def test_hybrid_masks_phone_and_name():
    result = anonymize_with_hybrid("Mage nama Nimal and call 0771234567.")

    assert "[PHONE]" in result.anonymized_text
    assert "[PERSON]" in result.anonymized_text
    assert "0771234567" not in result.anonymized_text
    assert "mask:phone" in result.transformations
    assert "mask:person" in result.transformations


def test_hybrid_uses_presidio_for_location():
    result = anonymize_with_hybrid("Alice studies in Colombo.")

    assert "[LOCATION]" in result.anonymized_text
    assert "Colombo" not in result.anonymized_text
    assert ("LOCATION", 1) in result.presidio_entity_counts
    assert "presidio:location" in result.transformations


def test_hybrid_masks_sinhala_person_name():
    result = anonymize_with_hybrid("මගේ නම නිමල්")

    assert "[PERSON]" in result.anonymized_text
    assert "නිමල්" not in result.anonymized_text
    assert "mask:person" in result.transformations


def test_hybrid_result_does_not_expose_raw_values():
    email = "hybrid.fixture@example.com"

    result = anonymize_with_hybrid(f"Use {email} for testing.")

    serialized_result = str(asdict(result))

    assert email not in serialized_result
    assert "original_text" not in asdict(result)


def test_hybrid_handles_empty_text():
    result = anonymize_with_hybrid("")

    assert result.anonymized_text == ""
    assert result.regex_transformations == ()
    assert result.presidio_entity_counts == ()
    assert result.transformations == ()
    assert result.requires_review is False
