"""Complementary output-only privacy audit, not an anonymity/NER certificate.

This auditor does not call the anonymizer, its NER, contextual detector or span
selector. Explicit identifying key/value fields must contain only the expected
placeholder; lexical residue is a policy failure. Less-specific prose signals
and placeholder-type contradictions require review rather than claimed PII.
No text, matched values or spans are exposed by this interface or logged.
"""

from dataclasses import dataclass

import regex

VERSION = "c2-residual-output-v1"
SOURCE = "services/preprocessing/residual_privacy.py"
PLACEHOLDER = regex.compile(r"\[(?:PERSON|LOCATION|EMAIL|PHONE|STUDENT_ID)\]")
FIELD = regex.compile(
    r"(?:^|[;\n\r])[ \t]*(?P<key>(?i:(?:full[ \t]+)?name|location|address)|නම|ලිපිනය)"
    r"[ \t]*:[ \t]*(?P<value>[^;\n\r]*)"
)
PERSON_CONTEXT = regex.compile(
    r"(?<![\p{L}\p{M}\p{N}_])(?:(?i:my\s+name\s+is|(?:mage|mge|eyge)\s+nama)|(?:මගේ|මගෙ)\s+නම)\s+"
    r"|(?<![\p{L}\p{M}\p{N}_])(?i:my|his|her|mage|mge|eyge|\[PERSON\])[ \t]+(?i:girlfriend|boyfriend)[ \t]+"
)
LOCATION_CONTEXT = regex.compile(
    r"(?<![\p{L}\p{M}\p{N}_])(?i:(?:live|stay|reside)\s+in|it\s+is\s+in)[ \t]+"
)
SINHALA_RESIDENCE = regex.compile(r"මම[ \t]+(?P<value>[^.!?;\r\n]+?)[ \t]+ජීවත්[ \t]+වෙමි")
WORD = regex.compile(r"[\p{L}\p{N}][\p{L}\p{M}\p{N}\u200c\u200d'’\-]*")
# Function words delimit supported prose fields; not entity-name blacklists.
CLAUSE = regex.compile(r"(?i:i|and|but|mata|mt|mage|mge|mama|is|are|was|were)|මට|මම|සහ")


@dataclass(frozen=True)
class ResidualSignal:
    rule_id: str
    status: str
    reason: str


def _value_signals(value, expected, *, strict):
    placeholders = tuple(PLACEHOLDER.finditer(value))
    signals = []
    if any(m.group() != f"[{expected}]" for m in placeholders):
        signals.append(
            ResidualSignal(
                "placeholder_type", "REVIEW", "identifying_context_placeholder_type_disagreement"
            )
        )
    lexical = PLACEHOLDER.sub(" ", value)
    # A strict identifying field is not allowed to retain any lexical payload.
    if strict and WORD.search(lexical):
        signals.append(
            ResidualSignal(
                "person_field" if expected == "PERSON" else "location_field",
                "FAIL",
                "lexical_residue_in_explicit_identifying_field",
            )
        )
    return signals


def _prose_signals(value, expected):
    # Evaluate only the immediate field head. A correctly masked value followed
    # by a new clause must not turn that clause into a residual identifier.
    placeholder = PLACEHOLDER.match(value)
    tail = value[placeholder.end() :] if placeholder else value
    signals = _value_signals(placeholder.group() if placeholder else "", expected, strict=False)
    word = WORD.match(tail.lstrip(" \t"))
    if word and not CLAUSE.fullmatch(word.group()):
        signals.append(
            ResidualSignal(
                "person_context" if expected == "PERSON" else "location_context",
                "REVIEW",
                "unresolved_lexical_content_in_identifying_context",
            )
        )
    return signals


def assess_output(text):
    """Inspect actual anonymized text only. Empty tuple means NO_SIGNAL, not safe.

    Structured syntax is the existing release policy, rechecked on output; it is
    correlated with masking rules, not independent statistical validation.
    Explicit fields are a bounded export-policy invariant, not arbitrary NER.
    """
    from preprocessing.privacy_gate import EMAIL_PATTERN, PHONE_PATTERN, STUDENT_ID_PATTERN

    if not isinstance(text, str) or not text.strip():
        return ()
    signals = []
    for label, pattern in (
        ("email", EMAIL_PATTERN),
        ("phone", PHONE_PATTERN),
        ("student_id", STUDENT_ID_PATTERN),
    ):
        if pattern.search(text):
            signals.append(ResidualSignal(label, "FAIL", "supported_structured_identifier_remains"))
    for field in FIELD.finditer(text):
        expected = (
            "PERSON"
            if regex.fullmatch(r"(?i:(?:full\s+)?name)|නම", field.group("key"))
            else "LOCATION"
        )
        signals.extend(_value_signals(field.group("value"), expected, strict=True))
    for pattern, label in ((PERSON_CONTEXT, "PERSON"), (LOCATION_CONTEXT, "LOCATION")):
        for match in pattern.finditer(text):
            signals.extend(_prose_signals(text[match.end() :], label))
    for match in SINHALA_RESIDENCE.finditer(text):
        signals.extend(_prose_signals(match.group("value"), "LOCATION"))
    return tuple(dict.fromkeys(signals))
