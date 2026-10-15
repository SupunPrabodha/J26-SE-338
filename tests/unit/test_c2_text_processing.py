"""Derived text integrity, exact offsets, stage order and unchanged release rules."""

import unicodedata

import pytest
import regex
from preprocessing import pipeline
from preprocessing.pipeline import PipelineInput, run_preprocessing_pipeline
from preprocessing.text_processing import normalize_text, tokenize_text


@pytest.mark.parametrize(
    "text",
    [
        "  I do NOT feel well.\n\tI can't sleep! 🙂  ",
        "මට\tබයයි. ක්‍රියා කිරීම\nඅපහසුයි. 🙂",
        "Mage nama [PERSON]. Mata exams gana dukai.",
        "මට exams pressure තියෙනවා. [EMAIL]",
        "Unknown: café e\u0301; no spelling replacement!",
        "[PERSON][LOCATION] [EMAIL] [PHONE] [STUDENT_ID]",
        "👩🏽‍💻 👨‍👩‍👧‍👦 🇱🇰 ❤️ 😀",
        "a\u200cb ක්‍රියාව; 12.5, isn't, well-being…",
        "",
        " \t\n",
        "தமிழ் 中文 العربية",
        "[PERSON]\u0301",
    ],
)
def test_normalization_and_token_boundaries(text):
    normalized = normalize_text(text)
    assert normalized == " ".join(unicodedata.normalize("NFC", text).split())
    assert normalize_text(normalized) == normalized
    tokens, offsets = tokenize_text(normalized)
    assert len(tokens) == len(offsets)
    boundaries = {0, len(normalized)} | {
        edge for match in regex.finditer(r"\X", normalized) for edge in match.span()
    }
    covered = set()
    previous_end = 0
    for token, (start, end) in zip(tokens, offsets, strict=True):
        assert previous_end <= start < end <= len(normalized)
        assert start in boundaries and end in boundaries
        assert normalized[start:end] == token
        covered.update(range(start, end))
        previous_end = end
    assert covered == {i for i, char in enumerate(normalized) if not char.isspace()}
    assert "".join(tokens) == "".join(normalized.split())


def test_precise_tokens_and_code_point_offsets_after_emoji():
    text = "🙂 I can't NOT [PERSON], ක්‍රියා! 👩🏽‍💻"
    tokens, offsets = tokenize_text(text)
    assert tokens == ("🙂", "I", "can't", "NOT", "[PERSON]", ",", "ක්‍රියා", "!", "👩🏽‍💻")
    assert offsets[1] == (2, 3)  # Emoji occupies one code point, two UTF-16 units.
    assert tokens[-1] == text[slice(*offsets[-1])]


def test_placeholders_stay_single_tokens_adjacent_to_words_and_punctuation():
    tokens, _ = tokenize_text("Hi[PERSON],[EMAIL][PHONE][STUDENT_ID][LOCATION]!")
    assert tokens == (
        "Hi",
        "[PERSON]",
        ",",
        "[EMAIL]",
        "[PHONE]",
        "[STUDENT_ID]",
        "[LOCATION]",
        "!",
    )


def test_full_stage_order_and_language_input_unchanged(monkeypatch):
    events = []
    for name, label in [
        ("anonymize_text", "anonymize"),
        ("assess_records", "quality"),
        ("identify_language", "language"),
        ("normalize_text", "normalize"),
        ("tokenize_text", "tokenize"),
    ]:
        original = getattr(pipeline, name)

        def wrapper(*args, _original=original, _label=label, **kwargs):
            events.append(_label)
            if _label == "language":
                assert args[0] == "I feel  tired.\n[EMAIL] 🙂"
            return _original(*args, **kwargs)

        monkeypatch.setattr(pipeline, name, wrapper)
    result = run_preprocessing_pipeline(
        [PipelineInput("fictional", "I feel  tired.\nfixture@example.com 🙂")]
    )
    assert events == ["anonymize", "quality", "language", "normalize", "tokenize"]
    record = result.records[0]
    assert record.anonymized_text == "I feel  tired.\n[EMAIL] 🙂"
    assert record.normalized_text == "I feel tired. [EMAIL] 🙂"


@pytest.mark.parametrize("strategy", ["regex", "presidio", "hybrid"])
@pytest.mark.parametrize(
    "text,expected",
    [
        ("mge nama neluni", "mge nama [PERSON]"),
        ("My name is Jane Miller.", "My name is [PERSON]."),
        ("මගේ නම නිමල් පෙරේරා.", "මගේ නම [PERSON]."),
        ("මම අද මහන්සියි.", "මම අද මහන්සියි."),
        ("මම කොළඹ ජීවත් වෙමි.", "මම [LOCATION] ජීවත් වෙමි."),
        (
            "Mage nama Nimal Perera. Mata exams gana dukai.",
            "Mage nama [PERSON]. Mata exams gana dukai.",
        ),
        ("Mata exams gana dukai.", "Mata exams gana dukai."),
        (
            "ape supervisior ms aparna. ape grp leader supun",
            "ape supervisior ms [PERSON]. ape grp leader [PERSON]",
        ),
        ("mge nngi senali", "mge nngi [PERSON]"),
    ],
)
def test_protected_masking_exactly_unchanged(request, strategy, text, expected):
    if strategy == "hybrid" and text == "mge nama neluni":
        request.node.add_marker(
            pytest.mark.xfail(
                strict=True,
                reason="Existing Hybrid introduction overmasking confirmed in pre-increment Language ID Docker evidence; Presidio demo unchanged.",
            )
        )
    record = run_preprocessing_pipeline(
        [PipelineInput("fictional", text)], strategy=strategy
    ).records[0]
    assert record.anonymized_text == expected
    assert record.normalized_text == normalize_text(expected)


@pytest.mark.parametrize("strategy", ["regex", "presidio", "hybrid"])
@pytest.mark.parametrize(
    "texts",
    [
        [],
        [""],
        [None],
        ["[PERSON]"],
        ["I feel tired."] * 2,
        ["ape grp leader supun. eyge girlfriend Neluni . ey hrim npurui"],
        ["My name is Jane Miller. I live in London. fixture@example.com 0771234567 IT12345678"],
    ],
)
def test_derivation_never_changes_masking_language_quality_or_release(monkeypatch, strategy, texts):
    inputs = [PipelineInput(f"fictional-{i}", text) for i, text in enumerate(texts)]
    actual = run_preprocessing_pipeline(inputs, strategy=strategy)
    monkeypatch.setattr(pipeline, "normalize_text", lambda _: "Different derived text")
    monkeypatch.setattr(pipeline, "tokenize_text", lambda _: ((), ()))
    alternate = run_preprocessing_pipeline(inputs, strategy=strategy)
    assert actual.quality_summary == alternate.quality_summary
    assert actual.privacy_summary == alternate.privacy_summary
    assert actual.release_ready == alternate.release_ready
    assert actual.blocking_reasons == alternate.blocking_reasons
    for a, b in zip(actual.records, alternate.records, strict=True):
        assert (
            a.anonymized_text,
            a.transformations,
            a.quality_status,
            a.quality_issues,
            a.requires_privacy_review,
            a.language_identification,
        ) == (
            b.anonymized_text,
            b.transformations,
            b.quality_status,
            b.quality_issues,
            b.requires_privacy_review,
            b.language_identification,
        )
