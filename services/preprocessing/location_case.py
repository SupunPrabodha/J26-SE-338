"""Conservative case probe for bounded English locative fields, original offsets.

No place dictionary or source normalization. Only ASCII field casing is probed
with the installed English NER; common nominal/descriptive phrases abstain.
This is not arbitrary geographical/address or multilingual recognition.
"""

import regex

from preprocessing.contextual_detection import ContextSpan

VERSION = "c2-location-case-v1"
# Ordinary English colour-state complements ('in red', 'in black', ...).
# Contextual abstention only: not a place/name blacklist or an NER veto.
COLOURS = frozenset(
    "red blue green black white yellow orange purple brown pink grey gray gold silver cyan magenta".split()
)
FIELD = regex.compile(
    r"(?<![\p{L}\p{M}\p{N}_])(?i:it[ \t]+is[ \t]+in)[ \t]+"
    r"(?P<value>[A-Za-z]+(?:[-'][A-Za-z]+)*(?:[ \t]+[A-Za-z]+(?:[-'][A-Za-z]+)*){0,3})"
    r"(?=[ \t]*(?:[.!?;\r\n]|$))"
)


def detect_locations(text):
    """Return model-corroborated locations, never a blanket 'in + word' rule.

    Lowercase-field POS vetoes common nouns, determiners, verbs and function
    words. This intentionally misses some real places tagged as common nouns.
    The title-case field must be one exact LOC/GPE span in the parsed locative frame.
    ASCII-only probing guarantees offset lengths; marks/joiners are not rewritten.
    """
    matches = tuple(FIELD.finditer(text))
    if not matches:
        return ()
    from preprocessing.presidio_anonymization import _get_engines

    engine = _get_engines()[0].nlp_engine
    if not hasattr(engine, "nlp"):
        return ()
    nlp = engine.nlp["en"]
    found = []
    for match in matches:
        start, end = match.span("value")
        value = text[start:end]
        # The parsed grammar supplies this fixed local frame. Outside text,
        # emoji and whitespace remain untouched, and offsets map from the value.
        prefix = "It is in "
        lower = nlp(prefix + value.lower())
        tokens = [t for t in lower if t.idx >= len(prefix) and not t.is_space]
        if not tokens or any(
            t.is_stop
            or t.text.casefold() in COLOURS
            or t.pos_ in {"NOUN", "VERB", "AUX", "DET", "ADP", "CCONJ", "SCONJ", "ADV", "NUM"}
            for t in tokens
        ):
            continue
        probe = nlp(prefix + value.title())
        if any(
            e.start_char == len(prefix)
            and e.end_char == len(prefix) + len(value)
            and e.label_ in {"LOC", "GPE"}
            for e in probe.ents
        ):
            found.append(ContextSpan(start, end, "LOCATION", match.start()))
    return tuple(found)
