"""Privacy-safe hybrid Regex and Presidio anonymization."""

from dataclasses import dataclass

from preprocessing.anonymization import anonymize_text
from preprocessing.presidio_anonymization import (
    anonymize_with_presidio,
)


@dataclass(frozen=True)
class HybridAnonymizationResult:
    anonymized_text: str
    regex_transformations: tuple[str, ...]
    presidio_entity_counts: tuple[tuple[str, int], ...]
    transformations: tuple[str, ...]
    requires_review: bool


def anonymize_with_hybrid(
    text: str,
) -> HybridAnonymizationResult:
    """Apply deterministic masking before aggregate-only Presidio analysis."""
    regex_result = anonymize_text(text)
    presidio_result = anonymize_with_presidio(regex_result.anonymized_text)

    transformations = tuple(
        dict.fromkeys(
            (
                *regex_result.transformations,
                *presidio_result.transformations,
            )
        )
    )

    return HybridAnonymizationResult(
        anonymized_text=presidio_result.anonymized_text,
        regex_transformations=regex_result.transformations,
        presidio_entity_counts=presidio_result.entity_counts,
        transformations=transformations,
        requires_review=presidio_result.requires_review,
    )
