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
    from preprocessing.span_evaluation import regex_trace

    masked, transformations, _ = regex_trace(text)
    return AnonymizationResult(masked, transformations, bool(RESIDUAL_RISK_PATTERN.search(masked)))
