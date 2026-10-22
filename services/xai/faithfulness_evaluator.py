"""Component 4 Faithfulness Evaluation Engine.

Provides model-backed evaluation of LIME and SHAP explanations via:
- Unicode-aware tokenization preserving Sinhala combining marks, matras, and ZWJ conjuncts.
- Occurrence-level attribution alignment and subword aggregation.
- Deterministic ranking of supporting features for the fixed explained class.
- Progressive deletion (comprehensiveness) and retention (sufficiency) with protected span preservation.
- Seeded random deletion trials for statistical baseline comparison.
- Deletion AOPC (Area Over the Perturbation Curve) across completed nonzero steps.
- Bounded batch inference with deduplication, deadline checks, and honest partial reporting.
"""

from __future__ import annotations

import logging
import math
import random
import re
import time
from typing import TYPE_CHECKING

from research_contracts import (
    C4FaithfulnessOccurrence,
    C4FaithfulnessResponse,
    C4FaithfulnessStepResult,
    C4InternalFaithfulnessRequest,
)

if TYPE_CHECKING:
    from xai.classifier_interface import BatchPredictionClassifier

logger = logging.getLogger(__name__)

# Server-side bounded execution limits
MAX_TEXT_LENGTH = 2000
MAX_REMOVAL_STEPS = 50
MAX_RANDOM_TRIALS = 20
DEFAULT_RANDOM_TRIALS = 5
DEFAULT_SEED = 42
TIMEOUT_SECONDS = 12.0
INFERENCE_BATCH_SIZE = 16

# Regex patterns for protected tokens (anonymization placeholders, mentions, URLs, numbers)
PLACEHOLDER_REGEX = re.compile(
    r"^(\[[A-Za-z0-9_]+\]|@[A-Za-z0-9_]+|https?://\S+)$", re.IGNORECASE
)
NUMBER_REGEX = re.compile(r"^\d+([.,]\d+)*$")


class WordOccurrence:
    """Represents a specific token occurrence in the original text with character offsets."""

    def __init__(
        self,
        occurrence_id: str,
        word: str,
        start: int,
        end: int,
        is_word: bool,
        is_protected: bool,
    ) -> None:
        self.occurrence_id = occurrence_id
        self.word = word
        self.start = start
        self.end = end
        self.is_word = is_word
        self.is_protected = is_protected
        self.weight: float = 0.0
        self.rank: int = 0


def tokenize_text(text: str) -> list[WordOccurrence]:
    """Tokenize text into words and protected spans with exact Unicode character offsets.

    Preserves Sinhala Unicode combining marks, matras, and ZWJ conjuncts (U+0D80 to U+0DFF,
    combining diacritics U+0300 to U+036F, and ZWJ/ZWNJ U+200C/U+200D).
    """
    pattern = re.compile(
        r"(\[[A-Za-z0-9_]+\]|@[A-Za-z0-9_]+|https?://\S+|\d+(?:[.,]\d+)*|[\w\u0d80-\u0dff\u0300-\u036f\u200c\u200d]+|[^\w\s\u0d80-\u0dff\u0300-\u036f\u200c\u200d]+|\s+)",
        re.UNICODE,
    )
    word_pattern = re.compile(
        r"^[\w\u0d80-\u0dff\u0300-\u036f\u200c\u200d]+$", re.UNICODE
    )

    occurrences: list[WordOccurrence] = []
    word_idx = 0

    for match in pattern.finditer(text):
        piece = match.group(0)
        start, end = match.start(), match.end()

        is_protected = bool(
            PLACEHOLDER_REGEX.match(piece) or NUMBER_REGEX.match(piece)
        )
        is_word = bool(not is_protected and word_pattern.match(piece))

        occ_id = f"word_{word_idx}" if is_word else f"tok_{start}_{end}"
        if is_word:
            word_idx += 1

        occurrences.append(
            WordOccurrence(
                occurrence_id=occ_id,
                word=piece,
                start=start,
                end=end,
                is_word=is_word,
                is_protected=is_protected,
            )
        )
    return occurrences


def align_attributions_to_occurrences(
    text: str,
    occurrences: list[WordOccurrence],
    tokens: list[str],
    weights: list[float],
) -> tuple[bool, str]:
    """Map attribution weights to word occurrences using documented alignment rules.

    Rules:
    1. If explanation tokens sequence exactly matches the word occurrences sequence,
       perform direct 1-to-1 positional assignment.
    2. If tokens match words by string:
       - For words that occur exactly ONCE, map attribution directly.
       - For words that occur MULTIPLE times:
         If explanation tokens provide distinct entries matching the count and relative
         order of occurrences, map in sequence.
         If the explanation provides an ambiguous single weight for multiple occurrences,
         return False without guessing occurrence-level weights.
    3. If tokens are subwords (e.g. SentencePiece/BPE fragments), aggregate subwords into
       containing word spans by summation.
    """
    word_occs = [o for o in occurrences if o.is_word]
    if not word_occs:
        return False, "No valid word occurrences found in text."

    clean_tokens = [t.strip() for t in tokens if t and t.strip()]
    if not clean_tokens:
        return False, "Explanation attributions contain no tokens."

    # Strategy 1: Exact sequential match (e.g. from whitespace-split LIME/SHAP on clean text)
    if len(clean_tokens) == len(word_occs):
        sequential_match = True
        for tok, occ in zip(clean_tokens, word_occs, strict=False):
            # Strip common punctuation for matching
            tok_norm = re.sub(r"[^\w\u0d80-\u0dff\u0300-\u036f\u200c\u200d]", "", tok).lower()
            occ_norm = occ.word.lower()
            if tok_norm and occ_norm and tok_norm != occ_norm and tok_norm not in occ_norm and occ_norm not in tok_norm:
                sequential_match = False
                break
        if sequential_match:
            for w, occ in zip(weights, word_occs, strict=False):
                occ.weight = float(w)
            return True, "Sequential 1-to-1 attribution alignment succeeded."

    # Strategy 2: Occurrence frequency analysis to detect ambiguous tokens
    # Group occurrences by normalized word
    occ_by_word: dict[str, list[WordOccurrence]] = {}
    for occ in word_occs:
        key = occ.word.lower()
        occ_by_word.setdefault(key, []).append(occ)

    # Group explanation tokens by normalized word
    tok_entries: dict[str, list[float]] = {}
    for tok, w in zip(tokens, weights, strict=False):
        tok_clean = re.sub(r"^[ _\s]+|[ _\s]+$", "", str(tok))
        tok_norm = tok_clean.lower()
        if tok_norm:
            tok_entries.setdefault(tok_norm, []).append(float(w))

    # Check for ambiguity: multiple occurrences in text but fewer/ambiguous entries in explanation
    for word_norm, occ_list in occ_by_word.items():
        if len(occ_list) > 1:
            tok_weights = tok_entries.get(word_norm, [])
            if 0 < len(tok_weights) < len(occ_list):
                return (
                    False,
                    f"Ambiguous attribution alignment: word '{occ_list[0].word}' occurs {len(occ_list)} times in text, "
                    f"but explanation provides only {len(tok_weights)} weight(s). Occurrence weights cannot be guessed.",
                )

    # Strategy 3: Map unambiguous single words or sequentially repeated entries
    assigned_any = False
    for word_norm, occ_list in occ_by_word.items():
        tok_weights = tok_entries.get(word_norm, [])
        if len(tok_weights) == len(occ_list):
            for occ, w in zip(occ_list, tok_weights, strict=False):
                occ.weight = float(w)
                assigned_any = True
        elif len(occ_list) == 1 and len(tok_weights) == 1:
            occ_list[0].weight = float(tok_weights[0])
            assigned_any = True

    # Strategy 4: Subword aggregation if tokens are subwords (contain ' ' or piece fragments)
    if not assigned_any:
        # Check if subwords aggregate into word spans
        # Aggregate subword attributions into word spans by summation
        subwords_matched = 0
        for occ in word_occs:
            word_sub_weight = 0.0
            matched_for_word = False
            for tok, w in zip(tokens, weights, strict=False):
                tok_clean = tok.replace(" ", "").strip().lower()
                if tok_clean and tok_clean in occ.word.lower():
                    word_sub_weight += float(w)
                    matched_for_word = True
            if matched_for_word:
                occ.weight = word_sub_weight
                subwords_matched += 1
        if subwords_matched > 0:
            return True, "Subword attributions aggregated into word spans via summation."
        return False, "Could not reliably map explanation tokens to word occurrences in source text."

    return True, "Attribution alignment succeeded."


def build_deleted_text(
    original_text: str,
    occurrences_to_delete: list[WordOccurrence],
) -> str:
    """Construct modified text by deleting specified occurrences and normalizing whitespace."""
    if not occurrences_to_delete:
        return original_text

    # Sort deletions by start offset
    sorted_occs = sorted(occurrences_to_delete, key=lambda o: o.start)
    pieces: list[str] = []
    last_idx = 0

    for occ in sorted_occs:
        if occ.start > last_idx:
            pieces.append(original_text[last_idx:occ.start])
        last_idx = max(last_idx, occ.end)

    if last_idx < len(original_text):
        pieces.append(original_text[last_idx:])

    combined = "".join(pieces)
    # Normalize multiple whitespace to single space, trimming edges
    normalized = re.sub(r"[ \t]+", " ", combined).strip()
    return normalized


def build_keep_text(
    original_text: str,
    all_occurrences: list[WordOccurrence],
    occurrences_to_keep: set[str],
) -> str:
    """Construct modified text keeping ONLY specified occurrences and protected tokens.

    Preserves protected spans (e.g. [STUDENT_NAME], @user, numbers) consistently.
    """
    to_delete = [
        o
        for o in all_occurrences
        if o.is_word
        and not o.is_protected
        and o.occurrence_id not in occurrences_to_keep
    ]
    return build_deleted_text(original_text, to_delete)


def evaluate_faithfulness(
    req: C4InternalFaithfulnessRequest,
    classifier: BatchPredictionClassifier,
) -> C4FaithfulnessResponse:
    """Compute faithfulness metrics (comprehensiveness, sufficiency gap, random baseline, AOPC)."""
    start_time = time.time()
    model_id = getattr(classifier, "model_id", classifier.model_version)
    model_version = classifier.model_version
    model_revision = getattr(classifier, "model_revision", None)

    # 1. Validate text length
    if not req.text or not req.text.strip():
        return C4FaithfulnessResponse(
            explanation_id=req.explanation_id,
            method=req.method,
            explained_class=req.explained_class,
            baseline_probability=0.0,
            outcome="TEXT_MISMATCH",
            outcome_message="Input text cannot be empty.",
            is_development=True,
        )

    if len(req.text) > MAX_TEXT_LENGTH:
        return C4FaithfulnessResponse(
            explanation_id=req.explanation_id,
            method=req.method,
            explained_class=req.explained_class,
            baseline_probability=0.0,
            outcome="OVERLENGTH_TEXT",
            outcome_message=f"Input text exceeds maximum allowed length of {MAX_TEXT_LENGTH} characters.",
            is_development=True,
        )

    # 2. Verify model revision compatibility
    if (
        req.model_revision
        and req.model_revision != "main"
        and model_revision
        and model_revision != "main"
        and req.model_revision != model_revision
    ):
        return C4FaithfulnessResponse(
            explanation_id=req.explanation_id,
            method=req.method,
            explained_class=req.explained_class,
            baseline_probability=0.0,
            model_id=model_id,
            model_version=model_version,
            model_revision=model_revision,
            outcome="INCOMPATIBLE_MODEL",
            outcome_message=(
                f"Explanation was generated with model revision '{req.model_revision}', "
                f"which differs from active classifier revision '{model_revision}'."
            ),
            is_development=True,
        )

    # 3. Resolve explained class against classifier label set
    labels = classifier.class_labels
    target_idx = None
    for idx, lbl in enumerate(labels):
        if lbl.lower() == req.explained_class.lower():
            target_idx = idx
            break

    if target_idx is None:
        return C4FaithfulnessResponse(
            explanation_id=req.explanation_id,
            method=req.method,
            explained_class=req.explained_class,
            baseline_probability=0.0,
            model_id=model_id,
            model_version=model_version,
            model_revision=model_revision,
            outcome="INCOMPATIBLE_MODEL",
            outcome_message=f"Explained class '{req.explained_class}' is not in classifier labels: {labels}.",
            is_development=True,
        )

    fixed_explained_class = labels[target_idx]

    # 4. Compute actual original explained-class probability p0
    try:
        baseline_probs = classifier.predict_proba([req.text])[0]
        p0 = float(baseline_probs[target_idx])
    except Exception as exc:
        logger.exception("Initial classifier prediction failed: %s", exc)
        return C4FaithfulnessResponse(
            explanation_id=req.explanation_id,
            method=req.method,
            explained_class=fixed_explained_class,
            baseline_probability=0.0,
            model_id=model_id,
            model_version=model_version,
            model_revision=model_revision,
            outcome="INFERENCE_FAILED",
            outcome_message=f"Classifier prediction on original text failed: {exc}",
            is_development=True,
        )

    # 5. Tokenize text into Unicode word occurrences
    occurrences = tokenize_text(req.text)
    word_occs = [o for o in occurrences if o.is_word]
    total_words = len(word_occs)

    if total_words == 0:
        return C4FaithfulnessResponse(
            explanation_id=req.explanation_id,
            method=req.method,
            explained_class=fixed_explained_class,
            baseline_probability=p0,
            model_id=model_id,
            model_version=model_version,
            model_revision=model_revision,
            outcome="NO_SUPPORTING_WORDS",
            outcome_message="Input text contains no evaluatable words.",
            is_development=True,
        )

    # 6. Map attributions to word occurrences
    tokens_to_use = req.tokens
    weights_to_use = req.weights
    if not tokens_to_use and req.contributions:
        tokens_to_use = [c.token for c in req.contributions]
        weights_to_use = [c.weight for c in req.contributions]

    align_ok, align_msg = align_attributions_to_occurrences(
        req.text, occurrences, tokens_to_use, weights_to_use
    )
    if not align_ok:
        return C4FaithfulnessResponse(
            explanation_id=req.explanation_id,
            method=req.method,
            explained_class=fixed_explained_class,
            baseline_probability=p0,
            model_id=model_id,
            model_version=model_version,
            model_revision=model_revision,
            outcome="UNSUPPORTED_ALIGNMENT",
            outcome_message=align_msg,
            is_development=True,
        )

    # 7. Filter eligible supporting words (weight > 0 for explained class, not protected)
    supporting_words = [
        o for o in word_occs if o.weight > 0 and not o.is_protected
    ]
    if not supporting_words:
        return C4FaithfulnessResponse(
            explanation_id=req.explanation_id,
            method=req.method,
            explained_class=fixed_explained_class,
            baseline_probability=p0,
            model_id=model_id,
            model_version=model_version,
            model_revision=model_revision,
            outcome="NO_SUPPORTING_WORDS",
            outcome_message="The selected explanation contains no features that positively contribute to the explained class.",
            is_development=True,
        )

    # 8. Deterministic ranking: highest weight first, tie-break by start offset then word string
    ranked_occs = sorted(
        supporting_words,
        key=lambda o: (-o.weight, o.start, o.word),
    )
    for rank_idx, occ in enumerate(ranked_occs, start=1):
        occ.rank = rank_idx

    ranked_contracts = [
        C4FaithfulnessOccurrence(
            occurrence_id=o.occurrence_id,
            word=o.word,
            start=o.start,
            end=o.end,
            weight=o.weight,
            rank=o.rank,
        )
        for o in ranked_occs
    ]

    # 9. Compute removal budget
    total_eligible = len(ranked_occs)
    budget = total_eligible
    budget_requested = total_eligible

    if req.max_removal_words is not None:
        budget_requested = max(1, req.max_removal_words)
        budget = min(budget_requested, total_eligible)
    elif req.max_removal_pct is not None:
        pct = max(1.0, min(100.0, float(req.max_removal_pct)))
        computed_budget = int(round(total_words * (pct / 100.0)))
        budget_requested = max(1, computed_budget)
        budget = min(budget_requested, total_eligible)
    else:
        budget = min(10, total_eligible)
        budget_requested = budget

    budget = max(1, min(budget, MAX_REMOVAL_STEPS, total_eligible))

    # 10. Generate seeded random deletion sequences from the eligible word universe
    # Eligible word universe: non-protected words in text
    eligible_universe = [o for o in word_occs if not o.is_protected]
    random_trials_count = max(1, min(req.random_trials, MAX_RANDOM_TRIALS))
    seed = req.seed if req.seed is not None else DEFAULT_SEED

    # Pre-generate deletion sequences for all trials
    trial_sequences: list[list[WordOccurrence]] = []
    for t_idx in range(random_trials_count):
        rng = random.Random(seed + t_idx * 1000)
        # Sample budget words from universe without replacement
        sample_k = min(budget, len(eligible_universe))
        sampled = rng.sample(eligible_universe, k=sample_k)
        trial_sequences.append(sampled)

    # 11. Prepare texts for batch evaluation
    # Deletion texts for k=1..budget
    deletion_texts: list[str] = []
    for k in range(1, budget + 1):
        del_occs = ranked_occs[:k]
        del_text = build_deleted_text(req.text, del_occs)
        deletion_texts.append(del_text)

    # Keep texts for k=1..budget
    keep_texts: list[str] = []
    for k in range(1, budget + 1):
        keep_ids = {o.occurrence_id for o in ranked_occs[:k]}
        k_text = build_keep_text(req.text, occurrences, keep_ids)
        keep_texts.append(k_text)

    # Random deletion texts: matrix [trial_idx][k-1]
    random_texts_matrix: list[list[str]] = []
    for t_seq in trial_sequences:
        t_texts: list[str] = []
        for k in range(1, budget + 1):
            rand_del_occs = t_seq[:k]
            r_text = build_deleted_text(req.text, rand_del_occs)
            t_texts.append(r_text)
        random_texts_matrix.append(t_texts)

    # Collect all unique text variants for deduplicated batch inference
    all_needed_texts_set = {req.text}
    for dt in deletion_texts:
        all_needed_texts_set.add(dt)
    for kt in keep_texts:
        all_needed_texts_set.add(kt)
    for row in random_texts_matrix:
        for rt in row:
            all_needed_texts_set.add(rt)

    unique_texts = list(all_needed_texts_set)

    # 12. Run batched inference with deadline monitoring
    prob_cache: dict[str, float] = {req.text: p0}
    texts_to_infer = [t for t in unique_texts if t != req.text]
    total_inferences = 0
    stopped_early = False
    stopping_reason: str | None = None

    for i in range(0, len(texts_to_infer), INFERENCE_BATCH_SIZE):
        # Check deadline before each batch
        if (time.time() - start_time) > TIMEOUT_SECONDS:
            stopped_early = True
            stopping_reason = f"Execution deadline ({TIMEOUT_SECONDS}s) reached during batch inference."
            break

        batch = texts_to_infer[i : i + INFERENCE_BATCH_SIZE]
        try:
            batch_probs = classifier.predict_proba(batch)
            total_inferences += len(batch)
            for text_str, p_row in zip(batch, batch_probs, strict=False):
                prob_cache[text_str] = float(p_row[target_idx])
        except Exception as exc:
            logger.exception("Batch inference failed: %s", exc)
            stopped_early = True
            stopping_reason = f"Batch inference failed: {exc}"
            break

    # 13. Determine completed steps based on available cached results
    completed_steps_count = 0
    for k in range(1, budget + 1):
        del_text = deletion_texts[k - 1]
        if del_text in prob_cache:
            completed_steps_count = k
        else:
            break

    if completed_steps_count == 0:
        return C4FaithfulnessResponse(
            explanation_id=req.explanation_id,
            method=req.method,
            explained_class=fixed_explained_class,
            baseline_probability=p0,
            model_id=model_id,
            model_version=model_version,
            model_revision=model_revision,
            outcome="INFERENCE_FAILED",
            outcome_message=stopping_reason or "Inference failed before completing any deletion steps.",
            is_development=True,
        )

    # 14. Compute per-step metrics
    step_results: list[C4FaithfulnessStepResult] = []
    comprehensiveness_drops: list[float] = []

    for k in range(1, completed_steps_count + 1):
        del_text = deletion_texts[k - 1]
        p_del = prob_cache[del_text]
        comp_drop = p0 - p_del
        comprehensiveness_drops.append(comp_drop)

        # Sufficiency
        keep_text = keep_texts[k - 1]
        p_keep = prob_cache.get(keep_text)
        suff_gap = (p0 - p_keep) if p_keep is not None else None

        # Random baseline across completed trials for this step k
        completed_trial_drops: list[float] = []
        for t_idx in range(len(trial_sequences)):
            r_text = random_texts_matrix[t_idx][k - 1]
            if r_text in prob_cache:
                completed_trial_drops.append(p0 - prob_cache[r_text])

        n_trials = len(completed_trial_drops)
        rand_mean_drop = (sum(completed_trial_drops) / n_trials) if n_trials > 0 else None
        rand_mean_prob = (p0 - rand_mean_drop) if rand_mean_drop is not None else None

        rand_std = None
        if n_trials > 1 and rand_mean_drop is not None:
            variance = sum((d - rand_mean_drop) ** 2 for d in completed_trial_drops) / (n_trials - 1)
            rand_std = math.sqrt(variance)
        elif n_trials == 1:
            rand_std = 0.0

        diff_from_rand = (
            (comp_drop - rand_mean_drop)
            if rand_mean_drop is not None
            else None
        )

        step_occs = ranked_occs[:k]
        removed_words = [o.word for o in step_occs]
        removed_ids = [o.occurrence_id for o in step_occs]

        step_results.append(
            C4FaithfulnessStepResult(
                step=k,
                removed_words=removed_words,
                removed_occurrence_ids=removed_ids,
                modified_text=del_text,
                remaining_probability=p_del,
                comprehensiveness_drop=comp_drop,
                keep_remaining_probability=p_keep,
                sufficiency_gap=suff_gap,
                random_mean_probability=rand_mean_prob,
                random_mean_drop=rand_mean_drop,
                random_std_drop=rand_std,
                random_trial_count=n_trials,
                difference_from_random=diff_from_rand,
            )
        )

    # 15. Compute Deletion AOPC (mean of p0 - p(deleted input) across completed nonzero steps)
    aopc = (
        sum(comprehensiveness_drops) / len(comprehensiveness_drops)
        if comprehensiveness_drops
        else None
    )

    last_step = step_results[-1]
    final_comp_drop = last_step.comprehensiveness_drop
    final_suff_gap = last_step.sufficiency_gap
    final_rand_mean_drop = last_step.random_mean_drop
    final_diff_rand = last_step.difference_from_random

    execution_time_ms = round((time.time() - start_time) * 1000.0, 2)
    outcome = "PARTIAL" if (stopped_early or completed_steps_count < budget) else "SUCCESS"
    outcome_msg = (
        f"Evaluated {completed_steps_count} deletion step(s) across {random_trials_count} random trial(s)."
        if outcome == "SUCCESS"
        else f"Partial evaluation: completed {completed_steps_count}/{budget} steps. {stopping_reason or ''}".strip()
    )

    return C4FaithfulnessResponse(
        explanation_id=req.explanation_id,
        method=req.method,
        explained_class=fixed_explained_class,
        baseline_probability=p0,
        model_id=model_id,
        model_version=model_version,
        model_revision=model_revision,
        outcome=outcome,
        outcome_message=outcome_msg,
        ranked_words=ranked_contracts,
        steps=step_results,
        aopc=aopc,
        final_comprehensiveness_drop=final_comp_drop,
        final_sufficiency_gap=final_suff_gap,
        final_random_mean_drop=final_rand_mean_drop,
        final_difference_from_random=final_diff_rand,
        total_eligible_words=total_eligible,
        budget_requested=budget_requested,
        budget_evaluated=completed_steps_count,
        completed_steps=completed_steps_count,
        completed_trials=random_trials_count,
        total_inferences=total_inferences + 1,  # include baseline
        execution_time_ms=execution_time_ms,
        seed=seed,
        stopping_reason=stopping_reason,
        is_development=True,
    )
