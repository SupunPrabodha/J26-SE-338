"""Privacy-safe Presidio anonymization for synthetic C2 fixtures."""

from collections import Counter
from dataclasses import dataclass
from functools import lru_cache

from presidio_analyzer import AnalyzerEngine, Pattern, PatternRecognizer
from presidio_analyzer.nlp_engine import NlpEngineProvider
from presidio_anonymizer import AnonymizerEngine
from presidio_anonymizer.entities import OperatorConfig

from preprocessing.anonymization import (
    PHONE_PATTERN,
    RESIDUAL_RISK_PATTERN,
    STUDENT_ID_PATTERN,
)


@dataclass(frozen=True)
class PresidioAnonymizationResult:
    anonymized_text: str
    entity_counts: tuple[tuple[str, int], ...]
    transformations: tuple[str, ...]
    requires_review: bool


ENTITY_PLACEHOLDERS = {
    "PERSON": "[PERSON]",
    "EMAIL_ADDRESS": "[EMAIL]",
    "PHONE_NUMBER": "[PHONE]",
    "STUDENT_ID": "[STUDENT_ID]",
    "LOCATION": "[LOCATION]",
}

TRANSFORMATION_NAMES = {
    "PERSON": "presidio:person",
    "EMAIL_ADDRESS": "presidio:email",
    "PHONE_NUMBER": "presidio:phone",
    "STUDENT_ID": "presidio:student-id",
    "LOCATION": "presidio:location",
}


@lru_cache(maxsize=1)
def _get_engines():
    nlp_configuration = {
        "nlp_engine_name": "spacy",
        "models": [
            {
                "lang_code": "en",
                "model_name": "en_core_web_sm",
            }
        ],
    }

    provider = NlpEngineProvider(
        nlp_configuration=nlp_configuration,
    )
    nlp_engine = provider.create_engine()

    analyzer = AnalyzerEngine(
        nlp_engine=nlp_engine,
        supported_languages=["en"],
    )

    analyzer.registry.add_recognizer(
        PatternRecognizer(
            supported_entity="STUDENT_ID",
            patterns=[
                Pattern(
                    name="synthetic_student_id",
                    regex=STUDENT_ID_PATTERN.pattern,
                    score=0.85,
                )
            ],
            supported_language="en",
        )
    )

    analyzer.registry.add_recognizer(
        PatternRecognizer(
            supported_entity="PHONE_NUMBER",
            patterns=[
                Pattern(
                    name="sri_lankan_mobile_number",
                    regex=PHONE_PATTERN.pattern,
                    score=0.85,
                )
            ],
            supported_language="en",
        )
    )

    return analyzer, AnonymizerEngine()


def anonymize_with_presidio(
    text: str,
) -> PresidioAnonymizationResult:
    """Anonymize text without returning or logging detected PII values."""
    analyzer, anonymizer = _get_engines()

    analyzer_results = analyzer.analyze(
        text=text,
        language="en",
        entities=list(ENTITY_PLACEHOLDERS),
    )

    unique_results = {}
    for result in analyzer_results:
        key = (
            result.start,
            result.end,
            result.entity_type,
        )
        existing = unique_results.get(key)
        if existing is None or result.score > existing.score:
            unique_results[key] = result

    safe_results = list(unique_results.values())
    entity_counts = Counter(result.entity_type for result in safe_results)

    anonymized_result = anonymizer.anonymize(
        text=text,
        analyzer_results=safe_results,
        operators={
            entity_type: OperatorConfig(
                "replace",
                {"new_value": placeholder},
            )
            for entity_type, placeholder in ENTITY_PLACEHOLDERS.items()
        },
    )

    transformations = tuple(
        TRANSFORMATION_NAMES[entity_type] for entity_type in sorted(entity_counts)
    )

    return PresidioAnonymizationResult(
        anonymized_text=anonymized_result.text,
        entity_counts=tuple(sorted(entity_counts.items())),
        transformations=transformations,
        requires_review=bool(RESIDUAL_RISK_PATTERN.search(anonymized_result.text)),
    )
