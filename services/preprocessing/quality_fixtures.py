"""In-memory regression cases derived from development policy, not research validation."""

import unicodedata
from dataclasses import dataclass

from preprocessing.data_quality import QualityRecord
from preprocessing.pipeline import PipelineInput


@dataclass(frozen=True)
class QualityScenario:
    category: str
    language: str
    records: tuple[object, ...]
    expected_statuses: tuple[str, ...]
    expected_issues: tuple[tuple[str, ...], ...]
    pipeline: bool = False
    expected_privacy_block: bool = False


def build_quality_scenarios():
    cases = []
    for language, text in (
        ("english", "I feel tired about exams."),
        ("sinhala", "විභාග නිසා බයයි."),
        ("romanized", "Mata dukai."),
        ("code_mixed", "Mata exams pressure."),
    ):
        cases.append(
            QualityScenario(
                "valid", language, (PipelineInput("synthetic-valid", text),), ("PASS",), ((),), True
            )
        )
    # Explicit expected labels/issues come from the documented policy, not the evaluator.
    rows = (
        ("empty", "english", "", "REJECT", ("empty_text",)),
        ("whitespace", "sinhala", " \t\n\u00a0 ", "REJECT", ("empty_text",)),
        ("missing_text", "romanized", None, "REJECT", ("missing_text",)),
        ("invalid_text", "code_mixed", ["disposable"], "REJECT", ("invalid_text",)),
        ("short_english", "english", "OK", "REVIEW", ("very_short_text",)),
        ("short_sinhala", "sinhala", "බෑ", "REVIEW", ("very_short_text",)),
        ("short_romanized", "romanized", "ow", "REVIEW", ("very_short_text",)),
        ("short_code_mixed", "code_mixed", "ආ!", "REVIEW", ("very_short_text",)),
        ("placeholders", "english", "[EMAIL] [PERSON] !!!", "REVIEW", ("placeholder_only_text",)),
        ("no_content", "sinhala", "...?!", "REVIEW", ("no_usable_content",)),
        ("replacement", "romanized", "Mata \ufffd dukai.", "REVIEW", ("replacement_character",)),
        (
            "control",
            "code_mixed",
            "Mata\u0000 stress.",
            "REVIEW",
            ("suspicious_control_character",),
        ),
        (
            "bidi_control",
            "english",
            "I feel \u202e tired.",
            "REVIEW",
            ("suspicious_control_character",),
        ),
        (
            "whitespace_control",
            "english",
            "\f",
            "REJECT",
            ("empty_text", "suspicious_control_character"),
        ),
        ("surrogate", "english", "bad\ud800", "REJECT", ("invalid_unicode_text",)),
        (
            "joiners_emoji",
            "sinhala",
            "දුකයි 👩\u200d👩\u200d👧\u200d👦 ක්\u200dර ක\u200cම!",
            "PASS",
            (),
        ),
        ("multiline", "english", "I feel\ttired.\nNeed support!", "PASS", ()),
    )
    for category, language, text, status, issues in rows:
        cases.append(
            QualityScenario(
                category, language, (QualityRecord("synthetic-signal", text),), (status,), (issues,)
            )
        )
    for value, issue in (
        (None, "missing_record_id"),
        (" ", "missing_record_id"),
        (False, "invalid_record_id"),
        (123, "invalid_record_id"),
        ([], "invalid_record_id"),
        ("bad\u0000id", "invalid_record_id"),
    ):
        cases.append(
            QualityScenario(
                issue, "english", (QualityRecord(value, "I feel tired."),), ("REJECT",), ((issue,),)
            )
        )
    cases.extend(
        (
            QualityScenario(
                "sinhala_unicode_duplicate",
                "sinhala",
                (
                    QualityRecord("one", "කෝපයි."),
                    QualityRecord("two", unicodedata.normalize("NFD", "කෝපයි.")),
                ),
                ("REVIEW",) * 2,
                (("duplicate_text",),) * 2,
            ),
            QualityScenario(
                "romanized_duplicate",
                "romanized",
                (QualityRecord("one", "Mata Dukai."), QualityRecord("two", "mata   dukai.")),
                ("REVIEW",) * 2,
                (("duplicate_text",),) * 2,
            ),
            QualityScenario(
                "code_mixed_duplicate",
                "code_mixed",
                (
                    QualityRecord("one", "මට exams stress."),
                    QualityRecord("two", "මට\texams  STRESS."),
                ),
                ("REVIEW",) * 2,
                (("duplicate_text",),) * 2,
            ),
            QualityScenario(
                "pipeline_mixed_status",
                "english",
                (PipelineInput("one", "ok"), PipelineInput(None, "I feel tired.")),
                ("REVIEW", "REJECT"),
                (("very_short_text",), ("missing_record_id",)),
                True,
                True,
            ),
            QualityScenario(
                "duplicate_ids",
                "code_mixed",
                (QualityRecord("same", "I feel tired."), QualityRecord(" same ", "Mata dukai.")),
                ("REJECT", "REJECT"),
                (("duplicate_record_id",), ("duplicate_record_id",)),
            ),
            QualityScenario(
                "id_case_sensitive",
                "english",
                (QualityRecord("Case", "I feel tired."), QualityRecord("case", "I need support.")),
                ("PASS", "PASS"),
                ((), ()),
            ),
            QualityScenario(
                "unicode_whitespace_duplicate",
                "english",
                (
                    QualityRecord("one", "I feel café stress."),
                    QualityRecord("two", "  i\tfeel cafe\u0301   stress.\n"),
                ),
                ("REVIEW", "REVIEW"),
                (("duplicate_text",), ("duplicate_text",)),
            ),
            QualityScenario(
                "sinhala_whitespace_duplicate",
                "sinhala",
                (QualityRecord("one", "මට දුකයි."), QualityRecord("two", " මට\tදුකයි. ")),
                ("REVIEW", "REVIEW"),
                (("duplicate_text",), ("duplicate_text",)),
            ),
            QualityScenario(
                "privacy_flag",
                "code_mixed",
                (QualityRecord("one", "Mata stress.", requires_privacy_review=True),),
                ("REVIEW",),
                (("privacy_review_required",),),
            ),
            QualityScenario(
                "combined_precedence",
                "english",
                (
                    QualityRecord("same", "x", requires_privacy_review=True),
                    QualityRecord("same", "x", requires_privacy_review=True),
                ),
                ("REJECT", "REJECT"),
                (
                    (
                        "duplicate_record_id",
                        "very_short_text",
                        "duplicate_text",
                        "privacy_review_required",
                    ),
                )
                * 2,
            ),
            QualityScenario(
                "malformed_record", "english", (None,), ("REJECT",), (("malformed_record",),)
            ),
            QualityScenario(
                "invalid_privacy_flag",
                "english",
                (QualityRecord("one", "I feel tired.", requires_privacy_review="no"),),
                ("REJECT",),
                (("invalid_privacy_review_flag",),),
            ),
            QualityScenario("empty_batch", "english", (), (), (), True, True),
            QualityScenario(
                "masking_collision",
                "english",
                (
                    PipelineInput("one", "Contact fixture.one@example.com."),
                    PipelineInput("two", "Contact fixture.two@example.com."),
                ),
                ("REVIEW", "REVIEW"),
                (("duplicate_text",),) * 2,
                True,
            ),
            QualityScenario(
                "pipeline_short",
                "english",
                (PipelineInput("one", "ok"),),
                ("REVIEW",),
                (("very_short_text",),),
                True,
            ),
            QualityScenario(
                "pipeline_privacy",
                "code_mixed",
                (PipelineInput("one", "Unresolved marker @."),),
                ("REVIEW",),
                (("privacy_review_required",),),
                True,
                True,  # Existing review flag now also fails the separate privacy gate.
            ),
            QualityScenario(
                "pipeline_invalid_text",
                "english",
                (PipelineInput("one", None),),
                ("REJECT",),
                (("missing_text",),),
                True,
                True,
            ),
            QualityScenario(
                "pipeline_placeholder_only",
                "english",
                (PipelineInput("one", "[EMAIL]"),),
                ("REVIEW",),
                (("placeholder_only_text",),),
                True,
            ),
            QualityScenario(
                "pipeline_missing_id",
                "english",
                (PipelineInput(None, "I feel tired."),),
                ("REJECT",),
                (("missing_record_id",),),
                True,
                True,
            ),
            QualityScenario(
                "pipeline_invalid_id",
                "english",
                (PipelineInput(42, "I feel tired."),),
                ("REJECT",),
                (("invalid_record_id",),),
                True,
                True,
            ),
            QualityScenario(
                "pipeline_duplicate_ids",
                "english",
                (PipelineInput("same", "I feel tired."), PipelineInput("same", "I need support.")),
                ("REJECT",) * 2,
                (("duplicate_record_id",),) * 2,
                True,
                True,
            ),
        )
    )
    return tuple(cases)
