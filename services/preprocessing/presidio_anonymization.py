"""Privacy-safe Presidio anonymization for synthetic C2 fixtures."""

from collections import Counter
from dataclasses import dataclass
from functools import lru_cache

import tldextract
from presidio_analyzer import (
    AnalysisExplanation,
    AnalyzerEngine,
    EntityRecognizer,
    Pattern,
    PatternRecognizer,
    RecognizerResult,
)
from presidio_analyzer.nlp_engine import NlpEngineProvider
from presidio_analyzer.predefined_recognizers import EmailRecognizer
from presidio_anonymizer import AnonymizerEngine

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


class _OfflineEmailRecognizer(EmailRecognizer):
    """Keep Presidio email rules, using the locked dependency's bundled suffix list."""

    def __init__(self):
        super().__init__(name="OfflineEmailRecognizer")
        self.extract = tldextract.TLDExtract(suffix_list_urls=(), cache_dir=None)

    def validate_result(self, pattern_text: str):
        return self.extract(pattern_text).fqdn != ""


class ContextualRecognizer(EntityRecognizer):
    """Shared original-offset contextual fields; selection preserves structured PII."""

    def __init__(self):
        from preprocessing.contextual_detection import VERSION
        from preprocessing.location_case import VERSION as LOCATION_VERSION
        from preprocessing.person_context import VERSION as PERSON_VERSION

        super().__init__(
            supported_entities=["PERSON", "LOCATION"],
            name=f"{VERSION}+{PERSON_VERSION}+{LOCATION_VERSION}",
            supported_language="en",
        )

    def load(self):
        pass

    def analyze(self, text, entities, nlp_artifacts=None):
        from preprocessing.contextual_detection import detect_contextual

        return [
            RecognizerResult(
                s.entity_type,
                s.start,
                s.end,
                0.85,
                analysis_explanation=AnalysisExplanation(self.name, 0.85),
            )
            for s in detect_contextual(text)
            if s.entity_type in entities
        ]


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

    import spacy

    if not spacy.util.is_package("en_core_web_sm"):
        raise RuntimeError(
            "Required English spaCy model en_core_web_sm is unavailable; install locked dependencies."
        )
    provider = NlpEngineProvider(
        nlp_configuration=nlp_configuration,
    )
    nlp_engine = provider.create_engine()

    analyzer = AnalyzerEngine(
        nlp_engine=nlp_engine,
        supported_languages=["en"],
    )
    analyzer.registry.remove_recognizer("EmailRecognizer")
    analyzer.registry.add_recognizer(_OfflineEmailRecognizer())
    analyzer.registry.add_recognizer(ContextualRecognizer())

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
    from preprocessing.person_context import requires_context_review, requires_unresolved_review
    from preprocessing.span_evaluation import ALIASES, EntitySpan, render, select_presidio

    safe_results = select_presidio(text)
    entity_counts = Counter(result.entity_type for result in safe_results)
    spans = tuple(
        EntitySpan(r.start, r.end, ALIASES.get(r.entity_type, r.entity_type)) for r in safe_results
    )
    masked = render(text, spans)

    transformations = tuple(
        TRANSFORMATION_NAMES[entity_type] for entity_type in sorted(entity_counts)
    )

    return PresidioAnonymizationResult(
        anonymized_text=masked,
        entity_counts=tuple(sorted(entity_counts.items())),
        transformations=transformations,
        requires_review=bool(RESIDUAL_RISK_PATTERN.search(masked))
        or requires_context_review(masked)
        or requires_unresolved_review(text),
    )
