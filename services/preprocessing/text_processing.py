"""Conservative derived text; no language routing, semantic rewriting or gates."""

import unicodedata

import regex

NORMALIZATION_METHOD = "c2-nfc-whitespace-v1"
TOKENIZATION_METHOD = "c2-grapheme-words-v1"
OFFSET_UNIT = "unicode_code_points"
PLACEHOLDER = regex.compile(
    r"\[(?:PERSON|LOCATION|EMAIL|EMAIL_ADDRESS|PHONE|PHONE_NUMBER|STUDENT_ID)\]"
)
GRAPHEME = regex.compile(r"\X")
CONNECTORS = {"'", "’", "-"}


def normalize_text(text: str) -> str:
    """NFC, trim and collapse Unicode whitespace to one ASCII space."""
    return " ".join(unicodedata.normalize("NFC", text).split())


def _word(cluster: str) -> bool:
    return all(
        unicodedata.category(character)[0] in {"L", "M", "N"} or character in {"\u200c", "\u200d"}
        for character in cluster
    )


def tokenize_text(text: str) -> tuple[tuple[str, ...], tuple[tuple[int, int], ...]]:
    """Words, intact placeholders and punctuation/emoji graphemes with [start,end).

    Offsets count Python Unicode code points, not UTF-16 units or UTF-8 bytes.
    All non-whitespace graphemes are retained. Internal apostrophes/hyphens stay
    with word tokens; this is not morphology, sentence splitting or annotation.
    """
    clusters = list(GRAPHEME.finditer(text))
    tokens = []
    offsets = []
    index = 0
    while index < len(clusters):
        cluster = clusters[index]
        if cluster.group().isspace():
            index += 1
            continue
        start = cluster.start()
        end = cluster.end()
        placeholder = PLACEHOLDER.match(text, start)
        if placeholder:
            # Keep a mark attached to the closing bracket with its grapheme too.
            while end < placeholder.end():
                index += 1
                end = clusters[index].end()
        elif _word(cluster.group()):
            while index + 1 < len(clusters):
                following = clusters[index + 1]
                if _word(following.group()):
                    index += 1
                    end = following.end()
                elif (
                    following.group() in CONNECTORS
                    and index + 2 < len(clusters)
                    and _word(clusters[index + 2].group())
                ):
                    index += 2
                    end = clusters[index].end()
                else:
                    break
        tokens.append(text[start:end])
        offsets.append((start, end))
        index += 1
    return tuple(tokens), tuple(offsets)
