"""Unicode utility and adapter configuration regressions, not a calibration rerun."""

import pytest
from preprocessing.multilingual_calibration import UnicodeWordSplitter, splits_boundary
from preprocessing.multilingual_candidate import MultilingualCandidate
from preprocessing.span_evaluation import EntitySpan


@pytest.mark.parametrize(
    "text",
    [
        "මගේ නම නිමල් පෙරේරා.",
        "🙂 ශ්‍රියා කතා කළා!",
        "X\u0301 and exam-stress",
        "👩‍👩‍👧‍👦 support",
        "මගේ නම ශ්‍රි\u200dයා.",
    ],
)
def test_unicode_splitter_preserves_original_offsets_and_graphemes(text):
    tokens = list(UnicodeWordSplitter()(text))
    assert tokens
    for token, start, end in tokens:
        assert token == text[start:end]
        assert not splits_boundary(text, start)
        assert not splits_boundary(text, end)
    assert "".join(token for token, _, _ in tokens) == "".join(text.split())


def test_ascii_word_segmentation_still_includes_hyphen_and_underscore():
    assert [token for token, _, _ in UnicodeWordSplitter()("exam-stress name_one.")] == [
        "exam-stress",
        "name_one",
        ".",
    ]


def test_threshold_changes_selection_without_altering_score_order_or_text():
    class Model:
        def predict_entities(self, text, labels, **options):
            assert labels == ["person", "location"]
            assert options["threshold"] == 0.3
            return [
                {"start": 0, "end": 4, "label": "person", "score": 0.4, "text": text[:4]},
                {"start": 0, "end": 3, "label": "location", "score": 0.35, "text": text[:3]},
            ]

    assert MultilingualCandidate(Model(), structured=lambda _: (), threshold=0.3).detect(
        "Name."
    ) == (EntitySpan(0, 4, "PERSON"),)


@pytest.mark.parametrize("threshold", [True, 0, 1, float("nan"), "0.5"])
def test_invalid_experimental_threshold_rejected(threshold):
    with pytest.raises(ValueError):
        MultilingualCandidate(None, threshold=threshold)
