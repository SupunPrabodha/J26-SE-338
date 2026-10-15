"""Conservative offline rule evidence after anonymization and quality checks.

This provisional stage is not a trained language classifier. Latin script alone
cannot distinguish English, Romanized Sinhala or other Latin-script languages.
Masking placeholders are excluded; source text is never normalized or rewritten.
"""

import re
import unicodedata
from dataclasses import dataclass

VERSION = "c2-rule-language-v1.2"
PLACEHOLDER = re.compile(
    r"\[(?:PERSON|LOCATION|EMAIL|EMAIL_ADDRESS|PHONE|PHONE_NUMBER|STUDENT_ID)\]"
)
WORDS = re.compile(r"[a-z]+", re.IGNORECASE)
# Function words/grammatical expressions, not names or fixture identifiers.
# Two distinct markers and at least three Latin tokens are required per group.
ENGLISH = frozenset(
    "i my our we you your is are am the about feel have was with today this it in and but worried tired".split()
)
ROMANIZED = frozenset(
    "mata mt mage mge ape eyge mama nisa gana gena gna nama duki dukai bayai byi hari hondai mahansiyi inne yanawa thiyenawa".split()
)
SHORT_NAME_INTRODUCTION = re.compile(r"\A\s*(?:mage|mge|eyge)\s+nama\b", re.IGNORECASE)
SHORT_VISIBLE_INTRODUCTION = re.compile(
    r"\A\s*(?:mage|mge|eyge)\s+nama(?:\s|[^\w])*\Z", re.IGNORECASE
)


def explicit_short_introduction(text: str) -> bool:
    """Complete two-word possessive-name field; PHs supply no language evidence.

    Require adjacent introduction words in the original anonymized text and only
    punctuation/whitespace/emoji after removing placeholders. Quoted fragments,
    words separated by a placeholder and other two-word marker pairs abstain.
    """
    return bool(
        SHORT_NAME_INTRODUCTION.match(text)
        and SHORT_VISIBLE_INTRODUCTION.fullmatch(PLACEHOLDER.sub(" ", text))
    )


@dataclass(frozen=True)
class LanguageIdentification:
    language: str
    status: str
    reason: str
    method: str = VERSION
    uncertain: bool = True


def identify_language(text: str) -> LanguageIdentification:
    """Report script evidence conservatively; never route anonymization or gates."""
    visible = PLACEHOLDER.sub(" ", text)
    scripts = set()
    for character in visible:
        if not unicodedata.category(character).startswith("L"):
            continue
        name = unicodedata.name(character, "")
        scripts.add(
            "sinhala" if name.startswith("SINHALA ") else "latin" if "LATIN" in name else "other"
        )
    if not scripts:
        return LanguageIdentification("unknown", "unknown", "no_language_letters_after_masking")
    if "other" in scripts:
        return LanguageIdentification("unknown", "unknown", "unsupported_script_evidence")
    if scripts == {"sinhala"}:
        return LanguageIdentification(
            "sinhala", "provisional", "sinhala_script_evidence_only", uncertain=False
        )
    tokens = WORDS.findall(visible.lower())
    english = len(tokens) >= 3 and len(set(tokens) & ENGLISH) >= 2
    short_introduction = explicit_short_introduction(text)
    romanized = short_introduction or len(tokens) >= 3 and len(set(tokens) & ROMANIZED) >= 2
    if "sinhala" in scripts:
        if english:
            return LanguageIdentification(
                "code-mixed", "provisional", "sinhala_script_and_english_markers", uncertain=False
            )
        if set(tokens) & ROMANIZED:
            return LanguageIdentification(
                "sinhala",
                "provisional",
                "sinhala_language_with_romanized_mixed_script_evidence",
                uncertain=False,
            )
        return LanguageIdentification(
            "uncertain", "uncertain", "mixed_script_without_supported_lexical_evidence"
        )
    if english and romanized:
        return LanguageIdentification(
            "code-mixed", "provisional", "english_and_romanized_markers", uncertain=False
        )
    if romanized:
        return LanguageIdentification(
            "romanized-si",
            "provisional",
            "explicit_romanized_name_introduction"
            if short_introduction
            else "multiple_romanized_markers",
            uncertain=False,
        )
    if english:
        return LanguageIdentification(
            "english", "provisional", "multiple_english_markers", uncertain=False
        )
    return LanguageIdentification(
        "uncertain", "uncertain", "insufficient_or_ambiguous_latin_evidence"
    )
