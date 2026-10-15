"""Bounded title/role/kinship apposition v3; original offsets, no name list.

English grammatical tags are an abstention aid, not multilingual NER support.
They never suppress existing model predictions. Unbounded name-like fields are
privacy-review signals, not confident entity spans.
"""

import regex

from preprocessing.contextual_detection import TOKEN, WORD

VERSION = "c2-role-kinship-v3"
TITLE = regex.compile(r"(?<![\p{L}\p{M}\p{N}_])(?i:Ms|Mr|Mrs|Dr)\.?[ \t]+")
ROLE = regex.compile(
    r"(?<![\p{L}\p{M}\p{N}_])(?i:(?:our|my|ape)[ \t]+"
    r"(?:supervisor|supervisior|(?:group|grp)[ \t]+leader)|"
    r"(?:supervisor|supervisior|(?:group|grp)[ \t]+leader):)[ \t]+"
)
KINSHIP = regex.compile(r"(?<![\p{L}\p{M}\p{N}_])(?i:mage|mge)[ \t]+(?i:nangi|nngi)[ \t]+")
RELATIONSHIP_REVIEW_VERSION = "c2-relationship-review-v1"
RELATIONSHIP_SIGNAL = regex.compile(
    r"(?<![\p{L}\p{M}\p{N}_])(?i:mage|mge|eyge|my|his|her)[ \t]+"
    r"(?i:girlfriend|boyfriend)[ \t]+"
)
# Function words separate clauses/descriptions, not a global name blacklist.
GRAMMAR = regex.compile(
    r"(?i:ape|our|my|is|are|was|were|am|will|has|have|had|can|could|must|should|"
    r"would|to|of|for|with|before|after|means|the|a|an|this|that|who|whose)"
)
CLAUSE = regex.compile(
    r"(?i:and|but|i|feel|feels|live|lives|mata|mt|mama|mage|mge|email|phone|call|contact|student)"
    r"|මට|මම|මගේ|මගෙ|නිසා|ගැන|සහ|ජීවත්"
)
POSSESSIVE_NAME_SIGNAL = regex.compile(
    r"(?<![\p{L}\p{M}\p{N}_])(?i:mage|mge)[ \t]+(?:" + WORD + r"[ \t]+){0,2}(?i:nama)[ \t]+"
)


def _syntax(text):
    # Per-call local artifacts only: no text cache, persistence or logging.
    from preprocessing.presidio_anonymization import _get_engines

    engine = _get_engines()[0].nlp_engine
    if not hasattr(engine, "nlp"):
        return {}
    return {token.idx: (token.idx + len(token), token.pos_) for token in engine.nlp["en"](text)}


def _tag(text, start, end, syntax):
    # The English tokenizer need not model Sinhala marks/joiners as a word.
    # Do not use English POS to invent Sinhala name boundaries.
    if not regex.fullmatch(r"[A-Za-z]+(?:[-'’][A-Za-z]+)*", text[start:end]):
        return None
    tagged = syntax.get(start)
    return tagged[1] if tagged and tagged[0] == end else None


def _contexts(text):
    """Combine an apposition and optional title into one preserved introduction."""
    contexts, consumed_titles = [], set()
    for pattern in (ROLE, KINSHIP):
        for match in pattern.finditer(text):
            start = match.end()
            title = TITLE.match(text, start)
            if title:
                consumed_titles.add(title.start())
                start = title.end()
            romanized = bool(regex.match(r"(?i:ape|mage|mge)\b", match.group()))
            contexts.append((match.start(), start, romanized))
    contexts.extend(
        (m.start(), m.end(), False)
        for m in TITLE.finditer(text)
        if m.start() not in consumed_titles
    )
    return sorted(contexts)


def parse_contexts(text):
    """Return (confident name-only spans, unresolved name-like field starts).

    Ordinary copular descriptions (e.g. 'our supervisor is helpful') are outside
    the supported direct-apposition grammar. A title followed by a function
    word/description is not converted to a name. A fifth lexical name word,
    malformed continuation or uncertain Latin tag requires review instead.
    """
    matches = _contexts(text)
    if not matches:
        return (), ()
    syntax = _syntax(text)
    found, unresolved = [], []
    for context_start, start, romanized in matches:
        if text[start:].startswith("["):
            continue
        cursor, end, words = start, start, 0
        uncertain = False
        while True:
            word = TOKEN.match(text, cursor)
            if not word or CLAUSE.fullmatch(word.group()) or GRAMMAR.fullmatch(word.group()):
                break
            # Productive Romanized predicative endings are ambiguous with names.
            # Abstain for this possessive context only; do not veto model spans.
            if romanized and regex.fullmatch(r"(?i:[a-z]+(?:ai|ui))", word.group()):
                uncertain = True
                break
            if word.end() < len(text) and (
                text[word.end()].isalnum() or text[word.end()] in "_@\u200c\u200d"
            ):
                uncertain = True
                break
            tag = _tag(text, word.start(), word.end(), syntax)
            if tag in {"VERB", "AUX", "ADJ", "ADV", "ADP", "DET", "PRON", "CCONJ", "SCONJ"}:
                break
            if tag is None and regex.fullmatch(r"[A-Za-z]+", word.group()):
                uncertain = True
                break
            words += 1
            if words > 4 or word.group()[-1] in "\u200c\u200d":
                uncertain = True
                break
            end = word.end()
            gap = regex.match(r"[ \t]+", text[end:])
            if not gap:
                break
            cursor = end + gap.end()
        if uncertain:
            unresolved.append(start)
        elif words:
            found.append((start, end, context_start))
    return tuple(found), tuple(unresolved)


def requires_context_review(text):
    """Supported name contexts surviving masking require review, never 'safe'."""
    found, unresolved = parse_contexts(text)
    if found or unresolved:
        return True
    from preprocessing.contextual_detection import BOUNDARY, INTRO, detect_contextual

    if any(s.entity_type == "PERSON" for s in detect_contextual(text)):
        return True
    # Explicit introduction fields can be rejected as too long or partially
    # masked by NER. A placeholder does not clear remaining lexical identifiers.
    for pattern in (INTRO, TITLE, ROLE, KINSHIP, POSSESSIVE_NAME_SIGNAL):
        for context in pattern.finditer(text):
            start = context.end()
            placeholder = regex.match(
                r"\[(?:PERSON|STUDENT_ID|EMAIL|PHONE|LOCATION)\][ \t]*", text[start:]
            )
            if placeholder:
                start += placeholder.end()
            word = TOKEN.match(text, start)
            if pattern in (ROLE, KINSHIP) and word and word.group().casefold() in {"is", "was"}:
                gap = regex.match(r"[ \t]+", text[word.end() :])
                if gap:
                    start = word.end() + gap.end()
                    if regex.match(r"\[PERSON\]", text[start:]):
                        continue
                    word = TOKEN.match(text, start)
            if not word or BOUNDARY.fullmatch(word.group()) or GRAMMAR.fullmatch(word.group()):
                continue
            if TITLE.match(text, start):
                continue
            tag = _tag(text, word.start(), word.end(), _syntax(text))
            if tag in {None, "NOUN", "PROPN"}:
                return True
    return False


def requires_unresolved_review(text):
    """Retain original unresolved-field evidence even if NER erases its context.

    Only the boolean is propagated; no text or detected values leave the wrapper.
    """
    return bool(parse_contexts(text)[1]) or relationship_requires_review(text)


def relationship_requires_review(text):
    """Direct relationship apposition is unresolved, not a guessed PERSON span.

    Preserve the signal from original input even when NER erases its pronoun or
    gives a name a LOCATION label. Copular descriptions and known placeholders
    do not create this signal; arbitrary relationships remain unsupported.
    """
    for match in RELATIONSHIP_SIGNAL.finditer(text):
        start = match.end()
        if text[start:].startswith("["):
            continue
        word = TOKEN.match(text, start)
        if word and not GRAMMAR.fullmatch(word.group()) and not CLAUSE.fullmatch(word.group()):
            return True
    return False


def grammatical_suffix(text, start, end):
    """Only trim a wholly descriptive tail crossing a verified name boundary.

    Unknown/nominal/proper-name tokens veto trimming, preserving neighbouring
    names and baseline coverage. This is not a global filter on NER predictions.
    """
    syntax = _syntax(text)
    words = list(TOKEN.finditer(text, start, end))
    return (
        bool(words)
        and all(
            _tag(text, w.start(), w.end(), syntax)
            in {"VERB", "AUX", "ADJ", "ADV", "ADP", "DET", "PRON", "CCONJ", "SCONJ"}
            for w in words
        )
        and not regex.search(r"[^\p{L}\p{M} \t'’\-]", text[start:end])
    )


def protected_introductions(text):
    """Consumed title/role wording is not a new name beside a known placeholder."""
    return tuple(
        (context_start, start)
        for context_start, start, _ in _contexts(text)
        if regex.match(r"\[(?:PERSON|STUDENT_ID|EMAIL|PHONE|LOCATION)\]", text[start:])
    )
