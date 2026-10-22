# C2 current quality and privacy evidence

Documentation consolidation, 2026-10-15. Runtime reference:
`c2adc3083dfc8a4a7702bca8d724b55919750c34`. No runtime changes, evaluations,
tests or builds were performed for this report. Historical results below are
reused with their original scope; they are not new measurements of every rule.

## Quality rules

Actual method: custom deterministic `QualityPolicy` and `assess_records()` in
`services/preprocessing/quality_policy.py`, re-exported by `data_quality.py`.
There is no separate quality-method version constant; the commit and policy
settings identify the implementation. Recorded checkpoint environment: Python
3.12.10, Unicode database 15.0.0; standard-library `re`, `unicodedata`,
`collections`, `dataclasses` and `enum`, with no external quality framework.

- Defaults: `short_text_review_below=3`, `comparison_case_insensitive=True`.
  These are development settings, not research-approved thresholds.
- REJECT: malformed records, missing/invalid text or IDs, invalid Unicode,
  empty text, duplicate record IDs, non-boolean privacy-review flags.
- REVIEW: very short content, placeholder-only/unusable content, replacement
  characters, suspicious controls, duplicate masked text, privacy-review flags.
- Duplicate text keys use NFC, whitespace collapse and optional casefold;
  `text_comparison_key()` never rewrites source text. Matching keys can be
  masking collisions; records are not automatically merged or removed.
- `text_review_signals()` preserves original-input warnings even if masking
  removes affected characters. Sinhala marks, meaningful joiners, punctuation
  and emoji are retained. No semantic wellbeing-quality assessment is claimed.

Quality assessment finishes before Language ID. Normalization/tokenization
produce separate derived fields and do not change quality decisions.
Detailed rule definitions: [existing quality policy documentation](../../research/c2-dataset-pipeline/data-quality.md).

## Privacy checks

Actual method: `assess_release()` / `build_release_summary()` in `privacy_gate.py`,
plus anonymizer review signals. No independent privacy-model package or universal
residual-PII detector is used. The gate uses anonymized text, not normalized text.

Checks cover required/forbidden columns, malformed fields/records, invalid or
duplicate IDs, empty anonymized content and residual supported email, Sri Lankan
mobile and two-letter/eight-digit student-ID patterns. Student-ID recognition
does not imply support for every identifier type.

`requires_context_review()` checks bounded surviving name contexts;
`requires_unresolved_review()` retains original unresolved context evidence.
`relationship_requires_review()` provides the versioned relationship review-only
signal. Invalid review flags fail closed. Existing masking placeholders are not
residual identifiers. A placeholder does not clear remaining name-like content.
These checks do not reliably find arbitrary missed PERSON/LOCATION entities.

## Review and blocking

Quality precedence is REJECT > REVIEW > PASS, retaining all ordered issues.
`quality_blocking_reasons()` and `run_preprocessing_pipeline()` produce applicable
reasons in this order:

1. `empty_batch`
2. `data_quality_rejected`
3. `data_quality_review_required`
4. `privacy_review_required`
5. `release_privacy_gate_failed`

Every unresolved REVIEW/REJECT, empty batch or failed privacy gate blocks
automated release. Structural quality PASS is separate from privacy assessment.
Review/quarantine is not correct entity detection or successful masking.
Known informal Sinhala/Romanized name misses, relationship misclassification and
bounded LOCATION coverage remain; see [role/kinship evidence](c2-role-kinship-v3.md)
and [current checkpoint limitations](c2-preprocessing-checkpoint.md).

## Release approval

`release_ready=True` means only that implemented automated prerequisites passed.
Authorized human approval is still required; no publication, participant ingestion
or complete-anonymization certification follows. Annotate, dataset Validate and
Versioned Release remain pending in the demo. Existing C1 approval authority and
synthetic-only release restrictions are unchanged.

## Existing results, provenance and reproduction

The [2026-10-12 milestone](c2-data-quality-milestone.md) recorded 48 synthetic
policy scenarios, 76 executions and 90 evaluated records including strategy
repeats. All expected outcomes matched: PASS 16, REVIEW 38, REJECT 36;
automated gates passed in 15 executions and blocked in 61. Expectations derive
from the policy, not independent human labels; repeats are not independent samples.
Those historical totals are not updated for later contextual/privacy additions.
The [c2adc308 checkpoint](c2-preprocessing-checkpoint.md) separately records its
regression, Docker and browser verification. Test passes are not privacy accuracy.

Recorded historical reproduction commands, **not executed for this update**:

```text
python scripts/run.py preprocessing.quality_report --policy research/c2-dataset-pipeline/config/quality-policy.json --output artifacts/c2-data-quality
python scripts/run.py preprocessing.quality_pdf --results artifacts/c2-data-quality/results.json
```

These belong to the original milestone/configuration and existing local artifacts;
running them on newer runtime is a new evaluation, not reproduction of unchanged
historical scores. Preserve old output and use a fresh output path. PDF conversion
reads recorded results; it does not perform a new evaluation. No competing quality
or privacy framework was benchmarked, and this evidence establishes no approved
privacy-release threshold or independent research validation.

## Stage method/comparison map

| Stage | Actual implementation | Executed comparisons | Documentation-only / not demonstrated |
| --- | --- | --- | --- |
| Anonymization | Presidio English NER plus versioned C2 rules; Regex remains global default | Historical Regex/Presidio/Hybrid benchmark and separately recorded correction comparisons | Offline rejected candidates are not current runtime; old scores are not current aggregate accuracy |
| Quality/privacy | Custom policy and bounded deterministic checks above | Expected-versus-observed policy scenarios and implementation regressions | No alternative framework comparison or universal privacy-safety measurement |
| Language ID | `c2-rule-language-v1.2` | v1/v1.1/v1.2 on fixed synthetic labels and development diagnostics | fastText documentation reviewed, not executed |
| Normalize | `c2-nfc-whitespace-v1` | NFC+whitespace vs whitespace-only on the same 16 frozen cases | NFKC reviewed, not executed |
| Tokenize | `c2-grapheme-words-v1`, regex graphemes | Current vs whitespace splitting on the same 16 cases / 75 gold spans | regex WORD reviewed, not executed; no spaCy/SentencePiece comparison |

Stage reports: [anonymization provenance](c2-anonymization-milestone.md),
[active contextual runtime](c2-contextual-runtime-v1.md),
[Language ID](c2-language-id-v1.md), [normalization](c2-normalization-v1.md),
[tokenization](c2-tokenization-v1.md). Historical reports remain unchanged.
