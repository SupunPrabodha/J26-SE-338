"""Component 4 Counterfactual Explanation Generator.

Provides bounded, model-backed counterfactual generation using token deletions and
configurable language-specific replacement rules. Reuses BatchPredictionClassifier
with CardiffNLP twitter-xlm-roberta-base-sentiment checkpoint.
Preserves Sinhala Unicode combining marks, matras, and ZWJ conjuncts.
"""

from __future__ import annotations

import difflib
import hashlib
import logging
import re
import time
from typing import TYPE_CHECKING

import numpy as np
from research_contracts import (
    C4CounterfactualRequest,
    C4CounterfactualResponse,
    C4ManualEvaluationRequest,
    C4ManualEvaluationResponse,
    CounterfactualCandidate,
    EditOperation,
    TextSpanDiff,
    TextSpanLock,
)

if TYPE_CHECKING:
    from xai.classifier_interface import BatchPredictionClassifier

logger = logging.getLogger(__name__)

# Server-side bounded search limits
DEFAULT_MAX_CANDIDATES = 40
DEFAULT_MAX_EDITS = 2
DEFAULT_MAX_TEXT_LENGTH = 2000
DEFAULT_TIMEOUT_SECONDS = 10.0
INFERENCE_BATCH_SIZE = 16

# Regex patterns for protected tokens
PLACEHOLDER_REGEX = re.compile(
    r"^(\[[A-Za-z0-9_]+\]|@[A-Za-z0-9_]+|https?://\S+)$", re.IGNORECASE
)
NUMBER_REGEX = re.compile(r"^\d+([.,]\d+)*$")

# Language-specific replacement dictionaries for sentiment exploration
# Supported languages documented: English, Sinhala, Romanized Sinhala, Code-mixed
REPLACEMENTS_ENGLISH_TO_POSITIVE_OR_NEUTRAL: dict[str, list[str]] = {
    "overwhelmed": ["busy", "coping", "fine"],
    "stressed": ["managing", "calm", "relaxed"],
    "cannot": ["can"],
    "cant": ["can"],
    "can't": ["can"],
    "terrible": ["fine", "okay", "good"],
    "bad": ["okay", "good"],
    "hopeless": ["optimistic", "fine"],
    "depressed": ["fine", "hopeful"],
    "anxious": ["calm", "prepared"],
    "hate": ["like", "enjoy"],
    "fail": ["pass", "complete"],
    "failing": ["passing", "progressing"],
    "pressure": ["balance", "routine"],
    "exhausted": ["rested", "okay"],
    "hard": ["manageable", "fine"],
    "difficult": ["manageable", "doable"],
    "sad": ["okay", "content"],
    "worried": ["content", "calm"],
    "fear": ["confidence", "peace"],
    "struggling": ["learning", "managing"],
    "tired": ["rested", "ready"],
    "pain": ["relief", "comfort"],
    "crying": ["resting"],
    "nobody": ["someone", "everyone"],
    "nothing": ["something"],
    "never": ["sometimes", "always"],
    "awful": ["acceptable", "okay"],
    "horrible": ["manageable"],
    "worthless": ["valued", "capable"],
    "panic": ["calm", "focus"],
    "nervous": ["composed", "ready"],
}

REPLACEMENTS_ENGLISH_TO_NEGATIVE: dict[str, list[str]] = {
    "great": ["okay", "difficult"],
    "good": ["okay", "bad"],
    "happy": ["neutral", "sad"],
    "love": ["tolerate", "dislike"],
    "excellent": ["okay", "poor"],
    "relaxed": ["busy", "stressed"],
    "calm": ["busy", "worried"],
    "hopeful": ["uncertain", "hopeless"],
    "confident": ["uncertain", "worried"],
    "easy": ["demanding", "difficult"],
    "peaceful": ["tense", "neutral"],
    "passed": ["struggled", "failed"],
    "passing": ["struggling", "failing"],
    "fine": ["stressed", "overwhelmed"],
    "enjoy": ["dislike", "hate"],
}

REPLACEMENTS_ENGLISH_TO_NEUTRAL: dict[str, list[str]] = {
    "terrible": ["average", "normal"],
    "horrible": ["ordinary", "standard"],
    "great": ["average", "moderate"],
    "amazing": ["standard", "normal"],
    "overwhelmed": ["busy"],
    "stressed": ["occupied"],
    "depressed": ["neutral"],
}

REPLACEMENTS_SINHALA: dict[str, list[str]] = {
    "පීඩනයක්": ["සහනයක්", "පාලනයක්"],
    "පීඩනය": ["සහනය", "සාමාන්‍යය"],
    "බයයි": ["සන්සුන්", "සාමාන්‍යයි"],
    "අමාරුයි": ["පුළුවන්", "පහසුයි"],
    "බැහැ": ["පුළුවන්"],
    "නොහැකි": ["හැකි"],
    "දුකයි": ["සතුටුයි", "හොඳයි"],
    "නරකයි": ["හොඳයි"],
    "කාර්යබහුලයි": ["සැහැල්ලුයි"],
    "කණගාටුයි": ["සතුටුයි"],
    "වෙහෙසයි": ["සුවපහසුයි"],
    "අසමත්": ["සමත්"],
    "කනස්සල්ලක්": ["සන්සුන්කමක්"],
    "බයක්": ["විශ්වාසයක්"],
}

REPLACEMENTS_ROMANIZED: dict[str, list[str]] = {
    "bayai": ["shape", "hodai"],
    "stress": ["shape", "cool", "normal"],
    "baha": ["puluwan"],
    "ba": ["puluwan"],
    "pressure": ["normal", "shape"],
    "amarui": ["puluwan", "lesiyi"],
    "aul": ["shape", "hodai"],
    "aulak": ["shape"],
    "awul": ["shape"],
    "karadara": ["shape", "hodai"],
    "dukka": ["hodai", "shape"],
    "mahansi": ["shape", "hodai"],
}


def _match_case(original: str, replacement: str) -> str:
    """Preserve title or upper case from the original token onto replacement."""
    if original.isupper():
        return replacement.upper()
    if original.istitle():
        return replacement.capitalize()
    return replacement


class TokenSpan:
    """Structured token or delimiter span within original text with exact character offsets."""

    def __init__(
        self,
        text: str,
        start: int,
        end: int,
        is_word: bool,
        is_protected: bool,
        is_locked: bool = False,
    ) -> None:
        self.text = text
        self.start = start
        self.end = end
        self.is_word = is_word
        self.is_protected = is_protected
        self.is_locked = is_locked


def tokenize_preserve(
    text: str, locked_spans: list[TextSpanLock] | None = None
) -> list[TokenSpan]:
    """Tokenize text into words, protected tokens, and punctuation/whitespace delimiters.

    Preserves Sinhala Unicode combining marks, matras, and ZWJ conjuncts as unified word tokens.
    Extracts exact character offsets [start, end].
    Enforces server-side word/span locking against validated offsets.
    """
    pattern = re.compile(
        r"(\[[A-Za-z0-9_]+\]|@[A-Za-z0-9_]+|https?://\S+|\d+(?:[.,]\d+)*|[\w\u0d80-\u0dff\u0300-\u036f\u200c\u200d]+|[^\w\s\u0d80-\u0dff\u0300-\u036f\u200c\u200d]+|\s+)",
        re.UNICODE,
    )
    tokens: list[TokenSpan] = []

    # Pre-validate locked spans: 0 <= start < end <= len(text)
    valid_locks: list[tuple[int, int]] = []
    if locked_spans:
        for lock in locked_spans:
            if 0 <= lock.start < lock.end <= len(text):
                if lock.text is not None and text[lock.start : lock.end] != lock.text:
                    continue
                valid_locks.append((lock.start, lock.end))

    word_pattern = re.compile(
        r"^[\w\u0d80-\u0dff\u0300-\u036f\u200c\u200d]+$", re.UNICODE
    )

    for match in pattern.finditer(text):
        piece = match.group(0)
        start, end = match.start(), match.end()

        is_protected = bool(
            PLACEHOLDER_REGEX.match(piece) or NUMBER_REGEX.match(piece)
        )
        is_word = bool(not is_protected and word_pattern.match(piece))

        # Check if this token intersects with any validated locked span
        is_locked = False
        if is_word and not is_protected and valid_locks:
            for l_start, l_end in valid_locks:
                if max(start, l_start) < min(end, l_end):
                    is_locked = True
                    break

        tokens.append(
            TokenSpan(
                text=piece,
                start=start,
                end=end,
                is_word=is_word,
                is_protected=is_protected,
                is_locked=is_locked,
            )
        )
    return tokens


def get_replacement_candidates(
    word: str, target_class: str, language: str | None
) -> list[str]:
    """Look up configurable language-specific replacement rules for a word."""
    lower_word = word.lower()
    results: list[str] = []

    # English rules
    if target_class in {"Positive", "Neutral"}:
        if lower_word in REPLACEMENTS_ENGLISH_TO_POSITIVE_OR_NEUTRAL:
            results.extend(
                [
                    _match_case(word, r)
                    for r in REPLACEMENTS_ENGLISH_TO_POSITIVE_OR_NEUTRAL[lower_word]
                ]
            )
    if target_class == "Negative":
        if lower_word in REPLACEMENTS_ENGLISH_TO_NEGATIVE:
            results.extend(
                [
                    _match_case(word, r)
                    for r in REPLACEMENTS_ENGLISH_TO_NEGATIVE[lower_word]
                ]
            )
    if target_class == "Neutral":
        if lower_word in REPLACEMENTS_ENGLISH_TO_NEUTRAL:
            results.extend(
                [
                    _match_case(word, r)
                    for r in REPLACEMENTS_ENGLISH_TO_NEUTRAL[lower_word]
                ]
            )

    # Sinhala rules
    if lower_word in REPLACEMENTS_SINHALA:
        results.extend(REPLACEMENTS_SINHALA[lower_word])

    # Romanized Sinhala rules
    if lower_word in REPLACEMENTS_ROMANIZED:
        results.extend(
            [_match_case(word, r) for r in REPLACEMENTS_ROMANIZED[lower_word]]
        )

    # Deduplicate while preserving order
    seen: set[str] = set()
    unique: list[str] = []
    for r in results:
        if r not in seen and r.lower() != lower_word:
            seen.add(r)
            unique.append(r)
    return unique


def build_candidate_text(
    token_spans: list[TokenSpan],
    edits: list[tuple[int, str | None]],
) -> tuple[str, list[EditOperation], list[TextSpanDiff]]:
    """Construct candidate text, precise edit operations with offsets, and diff spans."""
    edit_dict = {idx: repl for idx, repl in edits}
    reconstructed_pieces: list[str] = []
    diff_spans: list[TextSpanDiff] = []
    edit_operations: list[EditOperation] = []

    for idx, span in enumerate(token_spans):
        if idx in edit_dict:
            repl = edit_dict[idx]
            if repl is None:
                # Deletion
                edit_operations.append(
                    EditOperation(
                        op="delete",
                        index=idx,
                        original=span.text,
                        replacement=None,
                        start_offset=span.start,
                        end_offset=span.end,
                    )
                )
                diff_spans.append(
                    TextSpanDiff(
                        text=span.text,
                        type="deleted",
                        original_text=span.text,
                    )
                )
            else:
                # Replacement
                edit_operations.append(
                    EditOperation(
                        op="replace",
                        index=idx,
                        original=span.text,
                        replacement=repl,
                        start_offset=span.start,
                        end_offset=span.end,
                    )
                )
                reconstructed_pieces.append(repl)
                diff_spans.append(
                    TextSpanDiff(
                        text=repl,
                        type="replaced",
                        original_text=span.text,
                    )
                )
        else:
            # Unchanged
            reconstructed_pieces.append(span.text)
            diff_spans.append(
                TextSpanDiff(
                    text=span.text,
                    type="unchanged",
                    original_text=span.text,
                )
            )

    raw_text = "".join(reconstructed_pieces)
    clean_text = re.sub(r"  +", " ", raw_text).strip()
    return clean_text, edit_operations, diff_spans


def generate_counterfactuals(
    request: C4CounterfactualRequest,
    classifier: BatchPredictionClassifier,
) -> C4CounterfactualResponse:
    """Generate model-backed counterfactual candidates via bounded search."""
    start_time = time.perf_counter()
    target_class = request.target_class
    text = request.text.strip()

    # Enforce server-side bounds
    max_edits_allowed = min(max(1, int(request.max_edits or DEFAULT_MAX_EDITS)), 2)
    max_candidates_limit = min(
        max(5, int(request.max_candidates or DEFAULT_MAX_CANDIDATES)), 60
    )
    edit_mode = getattr(request, "edit_mode", "both") or "both"
    allow_delete = edit_mode in {"both", "delete_only"}
    allow_replace = edit_mode in {"both", "replace_only"}

    search_limits: dict[str, int | float | str] = {
        "max_text_length": DEFAULT_MAX_TEXT_LENGTH,
        "max_edits": max_edits_allowed,
        "max_candidates": max_candidates_limit,
        "edit_mode": edit_mode,
        "timeout_seconds": DEFAULT_TIMEOUT_SECONDS,
        "batch_size": INFERENCE_BATCH_SIZE,
    }

    class_labels = classifier.class_labels
    if target_class not in class_labels:
        return C4CounterfactualResponse(
            target_class=target_class,
            outcome="NO_COUNTERFACTUAL_FOUND",
            outcome_message=f"Target class '{target_class}' is not recognized by the classifier.",
            search_limits=search_limits,
            model_id=classifier.model_id,
            model_version=classifier.model_version,
            model_revision=classifier.model_revision,
        )

    # 1. Obtain verified original model prediction and probabilities
    orig_probs_raw = classifier.predict_proba([text])
    if len(orig_probs_raw) == 0:
        return C4CounterfactualResponse(
            target_class=target_class,
            outcome="UNAVAILABLE_MODEL",
            outcome_message="Classifier returned empty probabilities.",
            search_limits=search_limits,
            model_id=classifier.model_id,
            model_version=classifier.model_version,
            model_revision=classifier.model_revision,
        )

    orig_probs = {
        label: float(orig_probs_raw[0][i]) for i, label in enumerate(class_labels)
    }
    orig_predicted_idx = int(np.argmax(orig_probs_raw[0]))
    orig_predicted_class = class_labels[orig_predicted_idx]
    orig_target_prob = orig_probs.get(target_class, 0.0)

    # Check if text already predicts target class
    if orig_predicted_class == target_class:
        elapsed_ms = (time.perf_counter() - start_time) * 1000.0
        return C4CounterfactualResponse(
            target_class=target_class,
            original_predicted_class=orig_predicted_class,
            original_probabilities=orig_probs,
            outcome="ALREADY_TARGET_CLASS",
            outcome_message=(
                f"The input text is already classified as '{target_class}' "
                f"with probability {orig_target_prob:.4f}. No edits needed."
            ),
            candidates=[],
            best_candidate=None,
            search_limits=search_limits,
            model_id=classifier.model_id,
            model_version=classifier.model_version,
            model_revision=classifier.model_revision,
            execution_time_ms=round(elapsed_ms, 2),
            evaluated_candidate_count=0,
            successful_candidate_count=0,
            stopping_reason="ALREADY_TARGET_CLASS",
        )

    # 2. Tokenize and identify editable word positions
    token_spans = tokenize_preserve(text, request.locked_spans)
    editable_indices = [
        i
        for i, span in enumerate(token_spans)
        if span.is_word and not span.is_protected and not span.is_locked
    ]

    if not editable_indices:
        elapsed_ms = (time.perf_counter() - start_time) * 1000.0
        return C4CounterfactualResponse(
            target_class=target_class,
            original_predicted_class=orig_predicted_class,
            original_probabilities=orig_probs,
            outcome="NO_COUNTERFACTUAL_FOUND",
            outcome_message="All words in the input text are locked or protected. No edits permitted.",
            candidates=[],
            best_candidate=None,
            search_limits=search_limits,
            model_id=classifier.model_id,
            model_version=classifier.model_version,
            model_revision=classifier.model_revision,
            execution_time_ms=round(elapsed_ms, 2),
            evaluated_candidate_count=0,
            successful_candidate_count=0,
            stopping_reason="ALL_WORDS_LOCKED",
        )

    # 3. Fair candidate budget allocation across supported edit depths
    if max_edits_allowed >= 2:
        budget_1 = max_candidates_limit // 2
        budget_2 = max_candidates_limit - budget_1
    else:
        budget_1 = max_candidates_limit
        budget_2 = 0

    seen_texts: set[str] = {text}
    proposals_1: list[
        tuple[list[tuple[int, str | None]], str, list[EditOperation], list[TextSpanDiff]]
    ] = []

    # 3a. Depth 1 proposals: distribute evenly across all editable positions
    # Pass 1: deletions across positions
    if allow_delete:
        for idx in editable_indices:
            if len(proposals_1) >= budget_1:
                break
            cand_text, edit_ops, diffs = build_candidate_text(token_spans, [(idx, None)])
            if cand_text and cand_text not in seen_texts:
                seen_texts.add(cand_text)
                proposals_1.append(([(idx, None)], cand_text, edit_ops, diffs))

    # Pass 2: replacements across positions (round-robin)
    if allow_replace:
        repl_map: dict[int, list[str]] = {
            idx: get_replacement_candidates(
                token_spans[idx].text, target_class, request.language
            )
            for idx in editable_indices
        }
        max_repl_len = max((len(r) for r in repl_map.values()), default=0)
        for r_round in range(max_repl_len):
            if len(proposals_1) >= budget_1:
                break
            for idx in editable_indices:
                if len(proposals_1) >= budget_1:
                    break
                repls = repl_map[idx]
                if r_round < len(repls):
                    repl = repls[r_round]
                    cand_text, edit_ops, diffs = build_candidate_text(
                        token_spans, [(idx, repl)]
                    )
                    if cand_text and cand_text not in seen_texts:
                        seen_texts.add(cand_text)
                        proposals_1.append(([(idx, repl)], cand_text, edit_ops, diffs))

    # 3b. Depth 2 proposals: distribute pairwise across positions
    proposals_2: list[
        tuple[list[tuple[int, str | None]], str, list[EditOperation], list[TextSpanDiff]]
    ] = []
    if budget_2 > 0 and len(editable_indices) >= 2:
        # Generate pairs spread across the sentence
        pairs: list[tuple[int, int]] = []
        # Adjacent pairs first
        for i_pos in range(len(editable_indices) - 1):
            pairs.append((editable_indices[i_pos], editable_indices[i_pos + 1]))
        # Non-adjacent pairs spaced across
        for step in range(2, len(editable_indices)):
            for i_pos in range(0, len(editable_indices) - step, 2):
                pairs.append((editable_indices[i_pos], editable_indices[i_pos + step]))

        for i, j in pairs:
            if len(proposals_2) >= budget_2:
                break

            # Pairwise deletion
            if allow_delete:
                cand_text, edit_ops, diffs = build_candidate_text(
                    token_spans, [(i, None), (j, None)]
                )
                if cand_text and cand_text not in seen_texts:
                    seen_texts.add(cand_text)
                    proposals_2.append(([(i, None), (j, None)], cand_text, edit_ops, diffs))
                    if len(proposals_2) >= budget_2:
                        break

            # 1 replacement + 1 deletion
            if allow_replace and allow_delete:
                word_i = token_spans[i].text
                repls_i = get_replacement_candidates(word_i, target_class, request.language)
                for repl in repls_i[:1]:
                    cand_text, edit_ops, diffs = build_candidate_text(
                        token_spans, [(i, repl), (j, None)]
                    )
                    if cand_text and cand_text not in seen_texts:
                        seen_texts.add(cand_text)
                        proposals_2.append(([(i, repl), (j, None)], cand_text, edit_ops, diffs))
                        break
                if len(proposals_2) >= budget_2:
                    break

            # Pairwise replacement
            if allow_replace:
                word_i = token_spans[i].text
                word_j = token_spans[j].text
                repls_i = get_replacement_candidates(word_i, target_class, request.language)
                repls_j = get_replacement_candidates(word_j, target_class, request.language)
                if repls_i and repls_j:
                    cand_text, edit_ops, diffs = build_candidate_text(
                        token_spans, [(i, repls_i[0]), (j, repls_j[0])]
                    )
                    if cand_text and cand_text not in seen_texts:
                        seen_texts.add(cand_text)
                        proposals_2.append(
                            ([(i, repls_i[0]), (j, repls_j[0])], cand_text, edit_ops, diffs)
                        )

    proposals = (proposals_1 + proposals_2)[:max_candidates_limit]

    if not proposals:
        elapsed_ms = (time.perf_counter() - start_time) * 1000.0
        return C4CounterfactualResponse(
            target_class=target_class,
            original_predicted_class=orig_predicted_class,
            original_probabilities=orig_probs,
            outcome="NO_COUNTERFACTUAL_FOUND",
            outcome_message="No candidate perturbations could be formed within search constraints.",
            candidates=[],
            best_candidate=None,
            search_limits=search_limits,
            model_id=classifier.model_id,
            model_version=classifier.model_version,
            model_revision=classifier.model_revision,
            execution_time_ms=round(elapsed_ms, 2),
            evaluated_candidate_count=0,
            successful_candidate_count=0,
            stopping_reason="NO_PROPOSALS",
        )

    # 4. Batch prediction of candidate probabilities with deadline checking
    timeout_sec = DEFAULT_TIMEOUT_SECONDS
    successful_candidates: list[CounterfactualCandidate] = []
    evaluated_count = 0
    stopping_reason = "COMPLETED"

    for batch_start in range(0, len(proposals), INFERENCE_BATCH_SIZE):
        if time.perf_counter() - start_time > timeout_sec:
            stopping_reason = "TIMEOUT"
            break

        batch = proposals[batch_start : batch_start + INFERENCE_BATCH_SIZE]
        batch_texts = [p[1] for p in batch]
        try:
            cand_probs_raw = classifier.predict_proba(batch_texts)
        except Exception as exc:
            logger.exception("Batch candidate inference failed: %s", exc)
            return C4CounterfactualResponse(
                target_class=target_class,
                outcome="UNAVAILABLE_MODEL",
                outcome_message=f"Model inference failed during counterfactual evaluation: {exc}",
                search_limits=search_limits,
                model_id=classifier.model_id,
                model_version=classifier.model_version,
                model_revision=classifier.model_revision,
            )

        evaluated_count += len(batch)
        for idx_in_batch, (_edits, cand_text, edit_ops, diffs) in enumerate(batch):
            probs = {
                label: float(cand_probs_raw[idx_in_batch][j])
                for j, label in enumerate(class_labels)
            }
            cand_pred_idx = int(np.argmax(cand_probs_raw[idx_in_batch]))
            cand_pred_class = class_labels[cand_pred_idx]
            target_prob = probs.get(target_class, 0.0)
            target_delta = target_prob - orig_target_prob

            # Verify predicted class strictly flips to requested target
            if cand_pred_class == target_class:
                cand_id = (
                    f"cand_{hashlib.sha256(cand_text.encode('utf-8')).hexdigest()[:16]}"
                )
                successful_candidates.append(
                    CounterfactualCandidate(
                        candidate_id=cand_id,
                        candidate_text=cand_text,
                        edits=edit_ops,
                        edit_count=len(edit_ops),
                        predicted_class=cand_pred_class,
                        probabilities=probs,
                        target_probability=round(target_prob, 4),
                        target_probability_delta=round(target_delta, 4),
                        diff_spans=diffs,
                        minimality_rank=1,
                        minimality_description="Fewest edits found within this search.",
                        verified=True,
                    )
                )

    # 5. Deduplicate candidates and rank
    unique_successful: list[CounterfactualCandidate] = []
    seen_cand_texts: set[str] = set()
    for c in successful_candidates:
        if c.candidate_text and c.candidate_text not in seen_cand_texts:
            seen_cand_texts.add(c.candidate_text)
            unique_successful.append(c)

    # Rank by fewest edits ascending, then target probability descending
    unique_successful.sort(key=lambda c: (c.edit_count, -c.target_probability))

    for rank, cand in enumerate(unique_successful, start=1):
        cand.minimality_rank = rank
        cand.minimality_description = "Fewest edits found within this search."

    elapsed_ms = (time.perf_counter() - start_time) * 1000.0

    # Best candidate is rank 1; return up to 3 distinct alternatives
    best = unique_successful[0] if unique_successful else None
    alternatives = unique_successful[1:4] if len(unique_successful) > 1 else []

    if not unique_successful:
        outcome_status = "TIMEOUT" if stopping_reason == "TIMEOUT" else "NO_COUNTERFACTUAL_FOUND"
        outcome_msg = (
            f"Search deadline reached after evaluating {evaluated_count} candidate(s) "
            f"without finding a verified target flip."
            if stopping_reason == "TIMEOUT"
            else f"Within the bounded search limit of {evaluated_count} candidate(s) "
            f"and max {max_edits_allowed} edits, no counterfactual perturbed the verified "
            f"predicted class to '{target_class}'."
        )
        return C4CounterfactualResponse(
            target_class=target_class,
            original_predicted_class=orig_predicted_class,
            original_probabilities=orig_probs,
            outcome=outcome_status,
            outcome_message=outcome_msg,
            candidates=[],
            best_candidate=None,
            search_limits=search_limits,
            model_id=getattr(classifier, "model_id", getattr(classifier, "model_version", "unknown")),
            model_version=getattr(classifier, "model_version", "unknown"),
            model_revision=getattr(classifier, "model_revision", None),
            execution_time_ms=round(elapsed_ms, 2),
            evaluated_candidate_count=evaluated_count,
            successful_candidate_count=0,
            stopping_reason=stopping_reason,
        )

    timeout_note = " (search deadline reached; best candidates returned)" if stopping_reason == "TIMEOUT" else ""
    return C4CounterfactualResponse(
        target_class=target_class,
        original_predicted_class=orig_predicted_class,
        original_probabilities=orig_probs,
        outcome="SUCCESS",
        outcome_message=(
            f"Found {len(unique_successful)} verified counterfactual candidate(s){timeout_note}. "
            f"Smallest perturbation requires {best.edit_count} edit(s), shifting target "
            f"probability by {best.target_probability_delta:+.2%}."
        ),
        candidates=alternatives,
        best_candidate=best,
        search_limits=search_limits,
        model_id=getattr(classifier, "model_id", getattr(classifier, "model_version", "unknown")),
        model_version=getattr(classifier, "model_version", "unknown"),
        model_revision=getattr(classifier, "model_revision", None),
        execution_time_ms=round(elapsed_ms, 2),
        evaluated_candidate_count=evaluated_count,
        successful_candidate_count=len(unique_successful),
        stopping_reason=stopping_reason,
    )


def evaluate_manual_edit(
    request: C4ManualEvaluationRequest,
    classifier: BatchPredictionClassifier,
) -> C4ManualEvaluationResponse:
    """Evaluate counsellor manual edit against original text with verified model probabilities."""
    start_time = time.perf_counter()
    orig_text = request.original_text.strip()
    edited_text = request.edited_text.strip()
    target_class = request.target_class
    class_labels = classifier.class_labels

    # Run batch inference for original and edited texts together
    probs_raw = classifier.predict_proba([orig_text, edited_text])
    if len(probs_raw) < 2:
        raise ValueError("Model inference failed to evaluate manual edit")

    orig_probs = {
        label: float(probs_raw[0][i]) for i, label in enumerate(class_labels)
    }
    orig_pred_class = class_labels[int(np.argmax(probs_raw[0]))]

    edited_probs = {
        label: float(probs_raw[1][i]) for i, label in enumerate(class_labels)
    }
    edited_pred_class = class_labels[int(np.argmax(probs_raw[1]))]

    target_prob_before = orig_probs.get(target_class, 0.0)
    target_prob_after = edited_probs.get(target_class, 0.0)
    target_delta = target_prob_after - target_prob_before
    is_flip = bool(edited_pred_class == target_class)
    flip_status_label = (
        "Model flip verified"
        if is_flip
        else f"Target class not reached — predicted: {edited_pred_class}"
    )

    # Compute word-level diff and edit count
    orig_tokens = tokenize_preserve(orig_text)
    edited_tokens = tokenize_preserve(edited_text)

    orig_words = [t.text for t in orig_tokens if t.is_word or t.is_protected]
    edited_words = [t.text for t in edited_tokens if t.is_word or t.is_protected]

    matcher = difflib.SequenceMatcher(None, orig_words, edited_words)
    edits: list[EditOperation] = []
    diff_spans: list[TextSpanDiff] = []
    edit_count = 0

    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            for w in orig_words[i1:i2]:
                diff_spans.append(
                    TextSpanDiff(text=w + " ", type="unchanged", original_text=w)
                )
        elif tag == "delete":
            for idx, w in enumerate(orig_words[i1:i2], start=i1):
                edit_count += 1
                edits.append(
                    EditOperation(op="delete", index=idx, original=w, replacement=None)
                )
                diff_spans.append(
                    TextSpanDiff(text=w + " ", type="deleted", original_text=w)
                )
        elif tag == "insert":
            for idx, w in enumerate(edited_words[j1:j2], start=j1):
                edit_count += 1
                edits.append(
                    EditOperation(op="insert", index=idx, original=None, replacement=w)
                )
                diff_spans.append(
                    TextSpanDiff(text=w + " ", type="inserted", original_text=None)
                )
        elif tag == "replace":
            del_words = orig_words[i1:i2]
            ins_words = edited_words[j1:j2]
            edit_count += max(len(del_words), len(ins_words))
            for idx, (ow, nw) in enumerate(zip(del_words, ins_words, strict=False), start=i1):
                edits.append(
                    EditOperation(op="replace", index=idx, original=ow, replacement=nw)
                )
                diff_spans.append(
                    TextSpanDiff(text=nw + " ", type="replaced", original_text=ow)
                )
            if len(del_words) > len(ins_words):
                for idx, ow in enumerate(
                    del_words[len(ins_words) :], start=i1 + len(ins_words)
                ):
                    edits.append(
                        EditOperation(
                            op="delete", index=idx, original=ow, replacement=None
                        )
                    )
                    diff_spans.append(
                        TextSpanDiff(text=ow + " ", type="deleted", original_text=ow)
                    )
            elif len(ins_words) > len(del_words):
                for idx, nw in enumerate(
                    ins_words[len(del_words) :], start=j1 + len(del_words)
                ):
                    edits.append(
                        EditOperation(
                            op="insert", index=idx, original=None, replacement=nw
                        )
                    )
                    diff_spans.append(
                        TextSpanDiff(text=nw + " ", type="inserted", original_text=None)
                    )

    elapsed_ms = (time.perf_counter() - start_time) * 1000.0

    return C4ManualEvaluationResponse(
        target_class=target_class,
        original_predicted_class=orig_pred_class,
        original_probabilities=orig_probs,
        edited_predicted_class=edited_pred_class,
        edited_probabilities=edited_probs,
        target_probability_before=round(target_prob_before, 4),
        target_probability_after=round(target_prob_after, 4),
        target_probability_delta=round(target_delta, 4),
        is_flip=is_flip,
        flip_status_label=flip_status_label,
        edit_count=edit_count,
        edits=edits,
        diff_spans=diff_spans,
        model_id=getattr(classifier, "model_id", getattr(classifier, "model_version", "unknown")),
        model_version=getattr(classifier, "model_version", "unknown"),
        model_revision=getattr(classifier, "model_revision", None),
        execution_time_ms=round(elapsed_ms, 2),
    )
