import re
from dataclasses import dataclass


@dataclass(frozen=True)
class AnonymizationResult:
    anonymized_text: str
    transformations: tuple[str, ...]
    requires_review: bool


EMAIL_PATTERN = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")

PHONE_PATTERN = re.compile(r"(?<!\d)(?:\+94|0)[\s-]?7\d(?:[\s-]?\d){7}(?!\d)")

STUDENT_ID_PATTERN = re.compile(r"\b[A-Za-z]{2}\d{8}\b")

TITLED_NAME_PATTERN = re.compile(r"\b(?:Dr|Mr|Mrs|Ms)\.?\s+[A-Z][a-z]+\b")

ENGLISH_NAME_PATTERN = re.compile(
    r"(\bmy name is\s+)([A-Za-z]+)",
    re.IGNORECASE,
)

ENGLISH_SELF_NAME_PATTERN = re.compile(r"(?i:(\bi\s+am\s+|\bi['’]m\s+))([A-Z][a-z]+)")

ROMANIZED_NAME_PATTERN = re.compile(
    r"(\bmage\s+nama\s+)([A-Za-z]+)",
    re.IGNORECASE,
)

SINHALA_NAME_PATTERN = re.compile(r"((?:මගේ|මගෙ)\s+නම\s+)([^\s.,!?]+)")

SINHALA_SELF_NAME_PATTERN = re.compile(r"(මම\s+)([^\s.,!?]+)")

ENGLISH_LOCATION_PATTERN = re.compile(r"(?i:(\b(?:live|stay|reside)\s+in\s+))([A-Z][A-Za-z]+)")

RESIDUAL_RISK_PATTERN = re.compile(r"(?:@|\b[A-Za-z]{2}\d{6,10}\b|(?<!\d)\+?\d[\d\s-]{6,}\d(?!\d))")


def anonymize_text(text: str) -> AnonymizationResult:
    anonymized_text = text
    transformations: list[str] = []

    replacements = (
        (EMAIL_PATTERN, "[EMAIL]", "mask:email"),
        (PHONE_PATTERN, "[PHONE]", "mask:phone"),
        (STUDENT_ID_PATTERN, "[STUDENT_ID]", "mask:student-id"),
        (TITLED_NAME_PATTERN, "[PERSON]", "mask:person"),
    )

    for pattern, placeholder, transformation in replacements:
        anonymized_text, count = pattern.subn(
            placeholder,
            anonymized_text,
        )
        if count:
            transformations.append(transformation)

    contextual_replacements = (
        (ENGLISH_NAME_PATTERN, r"\1[PERSON]", "mask:person"),
        (ENGLISH_SELF_NAME_PATTERN, r"\1[PERSON]", "mask:person"),
        (ROMANIZED_NAME_PATTERN, r"\1[PERSON]", "mask:person"),
        (SINHALA_NAME_PATTERN, r"\1[PERSON]", "mask:person"),
        (SINHALA_SELF_NAME_PATTERN, r"\1[PERSON]", "mask:person"),
        (ENGLISH_LOCATION_PATTERN, r"\1[LOCATION]", "mask:location"),
    )

    for pattern, replacement, transformation in contextual_replacements:
        anonymized_text, count = pattern.subn(
            replacement,
            anonymized_text,
        )
        if count:
            transformations.append(transformation)

    unique_transformations = tuple(dict.fromkeys(transformations))

    return AnonymizationResult(
        anonymized_text=anonymized_text,
        transformations=unique_transformations,
        requires_review=bool(RESIDUAL_RISK_PATTERN.search(anonymized_text)),
    )
