"""C2 predicate-role correction v1; synthetic regression evidence, not language ID."""

import regex

from preprocessing.contextual_detection import WORD

VERSION = "c2-romanized-predicate-v1"
CLAUSE = regex.compile(
    r"(?:^|(?<=[.!?\n]))[ \t]*"
    r"(?P<body>(?i:Mata|mt)|මට)[ \t]+"
    r"(?P<topic>" + WORD + r"(?:[ \t]+" + WORD + r"){0,7})[ \t]+"
    r"(?P<role>(?i:gana|gena)|ගැන)[ \t]+"
    r"(?P<predicate>\p{L}[\p{L}\p{M}\u200c\u200d]*(?i:ai))"
    r"(?=[ \t]*(?:[.!?\n]|$))"
)


def roles(text, analyzer, contextual_fields):
    """Original offsets; use existing English POS only to abstain conservatively."""
    if not getattr(analyzer, "nlp_engine", None):
        return ()
    found = []
    for match in CLAUSE.finditer(text):
        start, end = match.start("role"), match.end("predicate")
        if any(
            s.entity_type == "PERSON" and s.start < end and s.end > start for s in contextual_fields
        ):
            continue
        body_start = match.start("body")
        artifacts = analyzer.nlp_engine.process_text(text[body_start:end], "en")
        topic_start, topic_end = match.span("topic")
        predicate_start = match.start("predicate")
        tokens = artifacts.tokens
        if any(
            t.pos_ in {"VERB", "AUX"}
            for t in tokens
            if topic_start <= t.idx + body_start < topic_end
        ):
            continue
        if any(t.pos_ == "PROPN" for t in tokens if t.idx + body_start >= predicate_start):
            continue
        found.append((start, end))
    return tuple(found)


def select_without_predicates(text, analyzer, selected, contextual_fields):
    """No global PERSON veto; keep partial/broader and non-spaCy results intact."""
    predicate_roles = roles(text, analyzer, contextual_fields)
    return [
        r
        for r in selected
        if not (
            r.entity_type == "PERSON"
            and (getattr(r, "recognition_metadata", None) or {}).get("recognizer_name")
            == "SpacyRecognizer"
            and any(start <= r.start < r.end <= end for start, end in predicate_roles)
        )
    ]
