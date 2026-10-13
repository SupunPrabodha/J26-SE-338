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

# Introduction/location fields are shared with Presidio in contextual_detection.
# Bare Sinhala self statements deliberately have no blanket next-token rule.

RESIDUAL_RISK_PATTERN = re.compile(r"(?:@|\b[A-Za-z]{2}\d{6,10}\b|(?<!\d)\+?\d[\d\s-]{6,}\d(?!\d))")


def anonymize_text(text: str) -> AnonymizationResult:
    from preprocessing.span_evaluation import regex_trace

    masked, transformations, _ = regex_trace(text)
    return AnonymizationResult(masked, transformations, bool(RESIDUAL_RISK_PATTERN.search(masked)))
