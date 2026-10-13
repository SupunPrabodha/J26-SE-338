"""C2 contextual fields v1: original offsets, bounded explicit introductions.

No name/place dictionary, normalization, language-hint routing or model changes.
Explicit fields are lexical proposals, not a claim of arbitrary NER support.
"""

from dataclasses import dataclass

import regex

VERSION = "c2-contextual-fields-v1"
WORD = r"\p{L}[\p{L}\p{M}\u200c\u200d]*(?:[-'’]\p{L}[\p{L}\p{M}\u200c\u200d]*)*"
TOKEN = regex.compile(WORD)
# Clause boundaries, not a global veto on possible names.
BOUNDARY = regex.compile(
    r"(?i:and|but|i|feel|feels|live|lives|mata|mt|mama|mage|mge|gana|dukai|duki|email|phone|call|contact|student)|මට|මම|මගේ|මගෙ|නිසා|ගැන|සහ|ජීවත්"
)
INTRO = regex.compile(
    r"(?<![\p{L}\p{M}\p{N}_])(?:(?i:my\s+name\s+is|(?:mage|mge)\s+nama)|(?:මගේ|මගෙ)\s+නම)\s+"
)
ENGLISH_SELF = regex.compile(r"(?<![\p{L}\p{M}\p{N}_])(?i:i\s+am|i['’]m)\s+(?=[A-Z])")
LOCATION_INTRO = regex.compile(r"(?<![\p{L}\p{M}\p{N}_])(?i:(?:live|stay|reside)\s+in)\s+(?=[A-Z])")
SINHALA_LOCATION = regex.compile(
    r"(?<![\p{L}\p{M}\p{N}_])මම\s+(?P<value>"
    + WORD
    + r"(?:[ \t]+"
    + WORD
    + r"){0,3})\s+ජීවත්\s+වෙමි(?![\p{L}\p{M}\p{N}_])"
)
# A declared address field, terminated by sentence punctuation/newline/semicolon.
# Only numbered street-like fields (not free arbitrary prose) are supported.
ADDRESS = regex.compile(
    r"(?<![\p{L}\p{M}\p{N}_])(?i:my\s+(?:fictional\s+)?address\s+is|mage\s+lipinaya|mge\s+lipinaya|address:)\s+|(?<![\p{L}\p{M}\p{N}_])(?:මගේ\s+ලිපිනය|ලිපිනය)\s+"
)
ADDRESS_VALUE = regex.compile(
    r"(?:අංක\s+)?[0-9]{1,5}[ \t]*,[ \t]*"
    + WORD
    + r"(?:[ \t]+"
    + WORD
    + r"){0,3}(?:,[ \t]*"
    + WORD
    + r"(?:[ \t]+"
    + WORD
    + r"){0,2})?|[0-9]{1,5}[ \t]+"
    + WORD
    + r"(?:[ \t]+"
    + WORD
    + r"){0,3}(?:,[ \t]*"
    + WORD
    + r"(?:[ \t]+"
    + WORD
    + r"){0,2})?"
)


@dataclass(frozen=True)
class ContextSpan:
    start: int
    end: int
    entity_type: str
    context_start: int


def field(text, start, maximum=4):
    end = start
    for _ in range(maximum):
        match = TOKEN.match(text, end)
        if not match or BOUNDARY.fullmatch(match.group()):
            break
        if match.end() < len(text) and (text[match.end()].isalnum() or text[match.end()] in "_@"):
            break
        end = match.end()
        separator = regex.match(r"[ \t]+", text[end:])
        if not separator:
            break
        next_start = end + separator.end()
        next_word = TOKEN.match(text, next_start)
        if not next_word or BOUNDARY.fullmatch(next_word.group()):
            break
        end = next_start
    return end if end > start and not text[end - 1].isspace() else len(text[:end].rstrip())


def detect_contextual(text):
    """Name fields: 1–4 words; a fifth unbounded word rejects the whole field.

    Stops at punctuation, explicit clause boundaries or newlines. Ambiguous bare
    'මම + word' is deliberately not a name introduction. Address fields require
    a bounded numbered surface, not simply a LOCATION model prediction.
    """
    found = []
    for pattern, label in (
        (INTRO, "PERSON"),
        (ENGLISH_SELF, "PERSON"),
        (LOCATION_INTRO, "LOCATION"),
    ):
        for match in pattern.finditer(text):
            end = field(text, match.end())
            if end <= match.end():
                continue
            remainder = regex.match(r"[ \t]+(" + WORD + r")", text[end:])
            if remainder and not BOUNDARY.fullmatch(remainder.group(1)):
                continue
            found.append(ContextSpan(match.end(), end, label, match.start()))
    for match in SINHALA_LOCATION.finditer(text):
        start, end = match.span("value")
        # Adverbial endings do not establish a residence field. Ambiguous places
        # with these endings are left to existing NER, not globally vetoed.
        if text[start:end].endswith(("ින්", "ෙන්")):
            continue
        found.append(ContextSpan(start, end, "LOCATION", match.start()))
    for match in ADDRESS.finditer(text):
        value = ADDRESS_VALUE.match(text, match.end())
        if value and (value.end() == len(text) or text[value.end()] in ".!?;\r\n"):
            found.append(ContextSpan(value.start(), value.end(), "LOCATION", match.start()))
    return tuple(s for s in found if text[s.end - 1] not in "\u200c\u200d")
