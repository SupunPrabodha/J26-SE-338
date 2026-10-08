import pytest
from preprocessing.anonymization import anonymize_text


@pytest.mark.parametrize(
    ("original_text", "expected_text"),
    [
        (
            "Contact me at student@example.com.",
            "Contact me at [EMAIL].",
        ),
        (
            "Call me using 0771234567.",
            "Call me using [PHONE].",
        ),
        (
            "Call me using 077 123 4567.",
            "Call me using [PHONE].",
        ),
        (
            "Call me using 071-234-5678.",
            "Call me using [PHONE].",
        ),
        (
            "Call me using +94771234567.",
            "Call me using [PHONE].",
        ),
        (
            "My student ID is IT23123456.",
            "My student ID is [STUDENT_ID].",
        ),
        (
            "My name is Nimal.",
            "My name is [PERSON].",
        ),
        (
            "I am Kavindu and I need support.",
            "I am [PERSON] and I need support.",
        ),
        (
            "Mage nama Kasun and mata pressure.",
            "Mage nama [PERSON] and mata pressure.",
        ),
        (
            "මගේ නම කමල්.",
            "මගේ නම [PERSON].",
        ),
        (
            "මම නිමාලි.",
            "මම [PERSON].",
        ),
        (
            "I live in Kandy.",
            "I live in [LOCATION].",
        ),
        (
            "Dr. Silva is my lecturer.",
            "[PERSON] is my lecturer.",
        ),
    ],
)
def test_known_pii_is_masked(
    original_text: str,
    expected_text: str,
) -> None:
    result = anonymize_text(original_text)

    assert result.anonymized_text == expected_text
    assert result.requires_review is False


def test_multiple_pii_types_are_masked_without_returning_values() -> None:
    original_text = "My name is Kavindu. Contact kavindu@example.com or call 0751234567."

    result = anonymize_text(original_text)

    assert "Kavindu" not in result.anonymized_text
    assert "kavindu@example.com" not in result.anonymized_text
    assert "0751234567" not in result.anonymized_text
    assert result.transformations == (
        "mask:email",
        "mask:phone",
        "mask:person",
    )


def test_non_pii_text_is_preserved() -> None:
    original_text = "I am stressed about assignments this week."

    result = anonymize_text(original_text)

    assert result.anonymized_text == original_text
    assert result.transformations == ()
    assert result.requires_review is False


def test_uncertain_numeric_identifier_requires_review() -> None:
    result = anonymize_text("My reference number is 12345678.")

    assert result.anonymized_text == "My reference number is 12345678."
    assert result.requires_review is True
