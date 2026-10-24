"""Provisional language evidence and unchanged anonymization/quality gates."""

import pytest
from preprocessing import pipeline
from preprocessing.language_id import VERSION, identify_language
from preprocessing.pipeline import PipelineInput, run_preprocessing_pipeline
from research_contracts import C2CustomDemoRequest

from scripts.c2_language_categories_evaluate import CATEGORY_CASES
from scripts.c2_language_short_evaluate import DIAGNOSTICS


@pytest.mark.parametrize("case_id,expected,text", CATEGORY_CASES)
def test_category_policy_development_cases(case_id, expected, text):
    assert identify_language(text).language == expected


def test_mixed_script_evidence_round_trips_actual_demo_contract():
    from preprocessing.demo import execute_custom

    result = execute_custom(C2CustomDemoRequest(strategy="presidio", text="විභාග නිසා mata බයයි"))
    language = result.records[0].language_identification
    assert language.language == "sinhala"
    assert language.reason == "sinhala_language_with_romanized_mixed_script_evidence"
    assert language.method == VERSION


@pytest.mark.parametrize(
    "text,expected",
    [
        ("විභාග නිසා මට බයයි. 🙂", "sinhala"),
        ("මම අද මහන්සියි.", "sinhala"),
        ("I feel worried about exams.", "english"),
        ("Our studies are difficult today.", "english"),
        ("Mata exams gana dukai.", "romanized-si"),
        ("mage nama [PERSON] mt exam gna byi", "romanized-si"),
        ("මට I feel worried about exams.", "code-mixed"),
        ("Mata exams gana dukai but I feel tired.", "code-mixed"),
        ("මට exams pressure තියෙනවා.", "uncertain"),
        ("OK", "uncertain"),
        ("Aparna Supun", "uncertain"),
        ("bonjour salut monde", "uncertain"),
        ("I I I", "uncertain"),
        ("123 🙂", "unknown"),
        ("", "unknown"),
        ("[PERSON] [LOCATION] [EMAIL] [PHONE] [STUDENT_ID]", "unknown"),
        ("தமிழ்", "unknown"),
    ],
)
def test_language_evidence(text, expected):
    before = text.encode("utf-8")
    result = identify_language(text)
    assert result.language == expected
    assert result.method == VERSION
    assert result.uncertain == (expected in {"unknown", "uncertain"})
    assert text.encode("utf-8") == before


def test_original_unicode_and_placeholder_boundaries():
    assert identify_language("මගේ නම [PERSON]. ක්‍රියා 🙂").language == "sinhala"
    assert identify_language("[PERSON] I feel tired.") == identify_language("I feel tired.")


def test_actual_stage_order_and_anonymized_input(monkeypatch):
    events = []
    original_anonymize = pipeline.anonymize_text
    original_quality = pipeline.assess_records
    original_language = pipeline.identify_language

    def anonymize(text):
        events.append("anonymize")
        return original_anonymize(text)

    def quality(records, **kwargs):
        events.append("quality")
        return original_quality(records, **kwargs)

    def language(text):
        events.append("language")
        assert "fictional@example.com" not in text
        return original_language(text)

    monkeypatch.setattr(pipeline, "anonymize_text", anonymize)
    monkeypatch.setattr(pipeline, "assess_records", quality)
    monkeypatch.setattr(pipeline, "identify_language", language)
    result = run_preprocessing_pipeline(
        [PipelineInput("sample", "I feel tired. fictional@example.com")]
    )
    assert events == ["anonymize", "quality", "language"]
    assert result.records[0].language_identification.language == "english"


@pytest.mark.parametrize("strategy", ["regex", "presidio", "hybrid"])
@pytest.mark.parametrize(
    "text",
    [
        "",
        "[PERSON]",
        "mge nama neluni",
        "Mata exams gana dukai.",
        "මම අද මහන්සියි.",
        "It is in malabe",
        "ape grp leader supun. eyge girlfriend Neluni . ey hrim npurui",
    ],
)
def test_language_result_never_changes_existing_policy_or_masks(monkeypatch, text, strategy):
    from preprocessing.language_id import LanguageIdentification

    inputs = [PipelineInput("sample", text)]
    normal = run_preprocessing_pipeline(inputs, strategy=strategy)
    monkeypatch.setattr(
        pipeline,
        "identify_language",
        lambda _: LanguageIdentification("unknown", "unknown", "no_language_letters_after_masking"),
    )
    alternate = run_preprocessing_pipeline(inputs, strategy=strategy)
    assert normal.quality_summary == alternate.quality_summary
    assert normal.privacy_summary == alternate.privacy_summary
    assert normal.release_ready == alternate.release_ready
    assert normal.blocking_reasons == alternate.blocking_reasons
    a, b = normal.records[0], alternate.records[0]
    assert (
        a.anonymized_text,
        a.transformations,
        a.quality_status,
        a.quality_issues,
        a.requires_privacy_review,
    ) == (
        b.anonymized_text,
        b.transformations,
        b.quality_status,
        b.quality_issues,
        b.requires_privacy_review,
    )


def test_legacy_hint_optional_and_not_analyzer_configuration():
    from preprocessing.demo import execute_custom

    body = C2CustomDemoRequest(strategy="presidio", text="My name is Jane Miller. I feel tired.")
    assert body.language_hint == "unsure"
    outputs = [
        execute_custom(body.model_copy(update={"language_hint": hint})).records[0]
        for hint in ("sinhala", "english", "romanized-si", "code-mixed", "unsure")
    ]
    assert all(output == outputs[0] for output in outputs)
    assert outputs[0].anonymized_text == "My name is [PERSON]. I feel tired."


@pytest.mark.parametrize(
    "case_id,expected,text",
    DIAGNOSTICS,
)
def test_short_phrase_development_diagnostics(request, case_id, expected, text):
    if case_id == "quoted-english":
        request.node.add_marker(
            pytest.mark.xfail(
                strict=True,
                reason="Existing generic marker rules misclassify English quoting Romanized words; unchanged by short-phrase correction.",
            )
        )
    result = identify_language(text)
    assert result.language == expected
    assert result.method == VERSION


def test_actual_reported_phrase_and_introduced_name_keep_other_stage_fields():
    from preprocessing.demo import execute_custom

    for text in ("Mge nama [PERSON]", "mge nama neluni"):
        result = execute_custom(C2CustomDemoRequest(strategy="presidio", text=text))
        record = result.records[0]
        assert record.anonymized_text == text.replace("neluni", "[PERSON]")
        assert record.language_identification.language == "romanized-si"
        assert record.language_identification.reason == "explicit_romanized_name_introduction"
        assert record.normalized_text == record.anonymized_text
        assert record.tokens == [text.split()[0], "nama", "[PERSON]"]
        assert record.quality_status == "PASS"
        assert not record.requires_privacy_review
        assert result.release_ready
