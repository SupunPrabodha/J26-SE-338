"""Unicode-safe original-offset utilities retained from calibration v2.

Rejected calibration experiments and fixture pools are not runtime dependencies.
"""

import unicodedata

import regex


def splits_boundary(text, offset):
    return (
        offset < len(text)
        and (unicodedata.category(text[offset]).startswith("M") or text[offset] in "\u200c\u200d")
    ) or (offset > 0 and text[offset - 1] in "\u200c\u200d")


class UnicodeWordSplitter:
    """Original-offset words include marks/joiners; remaining symbols use graphemes.

    No normalization, predicted-span expansion, gold matching or language routing.
    This replaces upstream re's mark-excluding word split before inference.
    """

    pattern = regex.compile(
        r"[\p{L}\p{N}_][\p{L}\p{N}\p{M}_\u200c\u200d]*(?:[-_][\p{L}\p{N}_][\p{L}\p{N}\p{M}_\u200c\u200d]*)*|\X"
    )

    def __call__(self, text):
        for match in self.pattern.finditer(text):
            if not match.group().isspace():
                yield match.group(), match.start(), match.end()
