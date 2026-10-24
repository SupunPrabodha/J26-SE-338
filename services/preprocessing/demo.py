"""Disposable fictional scenarios owned exclusively by preprocessing."""

from contextlib import contextmanager
from dataclasses import asdict

from research_common.config import settings
from research_common.web import SafeError
from research_contracts import (
    C2CustomDemoRequest,
    C2CustomDemoResponse,
    C2DemoCatalogue,
    C2DemoRecord,
    C2DemoRequest,
    C2DemoResponse,
    C2DemoScenario,
    ErrorCode,
)

from preprocessing.pipeline import PipelineInput, run_preprocessing_pipeline
from preprocessing.quality_policy import DEFAULT_QUALITY_POLICY

# Literal fictional fixtures; custom input has a separate ephemeral boundary.
SCENARIOS = (
    (
        "english-person",
        "English fictional name",
        "english",
        ("My name is Nimal Perera. I feel worried about exams.",),
    ),
    ("sinhala-person", "Sinhala fictional name", "sinhala", ("මගේ නම නිමල් පෙරේරා. විභාග නිසා බයයි.",)),
    (
        "romanized-person",
        "Romanized Sinhala fictional name",
        "romanized-si",
        ("Mage nama Nimal Perera. Mata exams gana dukai.",),
    ),
    (
        "code-mixed-person",
        "Code-mixed fictional name",
        "code-mixed",
        ("මගේ නම Nimal Perera. Exams ගැන බයයි.",),
    ),
    (
        "english-ordinary",
        "English ordinary wellbeing",
        "english",
        ("I feel worried about exams, but talking helps. 🙂",),
    ),
    (
        "english",
        "English fictional contact",
        "english",
        ("I feel tired about exams. Email practice@example.com.",),
    ),
    ("sinhala", "Sinhala fictional example", "sinhala", ("විභාග නිසා බයයි.",)),
    (
        "romanized",
        "Romanized Sinhala fictional example",
        "romanized-si",
        ("Mata exams gana dukai.",),
    ),
    ("code-mixed", "Code-mixed fictional example", "code-mixed", ("මට exams pressure තියෙනවා.",)),
    ("short", "Short meaningful content", "english", ("OK",)),
    ("empty", "Empty content", "not-applicable", ("",)),
    ("placeholder-only", "Placeholder-only content", "not-applicable", ("[EMAIL] [PERSON]",)),
    (
        "duplicate",
        "Duplicate fictional records",
        "english",
        ("I feel tired about exams.", "I feel tired about exams."),
    ),
    (
        "masking-collision",
        "Distinct fictional contacts masked alike",
        "english",
        ("practice@example.com about exams.", "rehearsal@example.com about exams."),
    ),
    ("empty-batch", "Empty batch", "not-applicable", ()),
)


def development_demo():
    if settings().environment != "development":
        raise SafeError(ErrorCode.NOT_FOUND, 404)


def metadata(row):
    scenario_id, label, language, texts = row
    return C2DemoScenario(
        scenario_id=scenario_id, label=label, language_label=language, record_count=len(texts)
    )


def catalogue():
    return C2DemoCatalogue(
        scenarios=[metadata(row) for row in SCENARIOS],
        strategies=["regex", "presidio", "hybrid", "gliner"],
    )


def execute(body: C2DemoRequest):
    row = next(row for row in SCENARIOS if row[0] == body.scenario_id)
    inputs = tuple(PipelineInput(f"synthetic-{i + 1}", text) for i, text in enumerate(row[3]))
    with safe_demo_execution():
        result = run_preprocessing_pipeline(
            inputs,
            strategy=body.strategy,
            quality_policy=DEFAULT_QUALITY_POLICY,
            experimental_demo=body.strategy == "gliner",
        )
    return C2DemoResponse(
        scenario=metadata(row),
        strategy=body.strategy,
        anonymization_configuration=configuration(body.strategy),
        records=[
            C2DemoRecord(original_text=source.text, **asdict(output))
            for source, output in zip(inputs, result.records, strict=True)
        ],
        quality_summary=result.quality_summary,
        privacy_summary=result.privacy_summary,
        validation_summary=result.validation_summary,
        release_ready=result.release_ready,
        blocking_reasons=result.blocking_reasons,
    )


def execute_custom(body: C2CustomDemoRequest):
    # The manual hint never routes detection or changes existing quality policy.
    inputs = (PipelineInput("synthetic-custom", body.text),)
    with safe_demo_execution():
        result = run_preprocessing_pipeline(
            inputs,
            strategy=body.strategy,
            quality_policy=DEFAULT_QUALITY_POLICY,
            experimental_demo=body.strategy == "gliner",
        )
    return C2CustomDemoResponse(
        language_hint=body.language_hint,
        strategy=body.strategy,
        anonymization_configuration=configuration(body.strategy),
        records=[C2DemoRecord(original_text=body.text, **asdict(result.records[0]))],
        quality_summary=result.quality_summary,
        privacy_summary=result.privacy_summary,
        validation_summary=result.validation_summary,
        release_ready=result.release_ready,
        blocking_reasons=result.blocking_reasons,
    )


def configuration(strategy):
    if strategy == "gliner":
        from preprocessing.gliner_demo import VERSION

        return VERSION
    from preprocessing.span_evaluation import SELECTION_VERSION

    return strategy + ":" + SELECTION_VERSION


@contextmanager
def safe_demo_execution():
    try:
        yield
    except (RuntimeError, ImportError, OSError, ValueError):
        # SafeError contains no model path, request text or upstream exception.
        raise SafeError(ErrorCode.DEPENDENCY_UNAVAILABLE, 503) from None
