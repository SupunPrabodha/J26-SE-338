# C2 development data-quality policy

This milestone checks automated prerequisites for anonymized synthetic records. It does not identify language, perform linguistic normalization/tokenization/annotation, approve a dataset release, or validate student wellbeing meaning. The existing `config/release-policy.json` remains unchanged: synthetic-only operation and human release approval are required. A true `release_ready` means automated prerequisites passed; it is not C1 approval or publication authority.

The public imports in `preprocessing.data_quality` remain available. `quality_policy.py` contains the validated policy and implementation. `run_preprocessing_pipeline(records, strategy="regex", quality_policy=QualityPolicy(...))` preserves the Regex default and supports the existing three strategies. No shared wire contracts, service mock, database schema or C1 workflow changed.

## Gate and precedence

Every unresolved REVIEW or REJECT blocks release. Empty batches fail. Status precedence is REJECT > REVIEW > PASS; every detected issue is retained in a fixed order even when a more severe issue determines the status. A batch containing both REVIEW and REJECT produces both quality blocking reasons. `build_quality_summary` and the pipeline use the same quality-gate helper.

Blocking reasons appear in this fixed order, when applicable:

1. `empty_batch`
2. `data_quality_rejected`
3. `data_quality_review_required`
4. `privacy_review_required`
5. `release_privacy_gate_failed`

The privacy gate still independently checks supported structured identifiers, safe columns and identifiers. It now rejects non-string fields and malformed rows without coercing arbitrary objects to strings. Missing/invalid text and IDs never reach anonymizers as invalid text. Invalid records remain represented as rejected outputs; they are not silently removed. Missing input fields default to `None`, then receive explicit missing-field issues. Unsupported batch shapes raise fixed ValueError messages that exclude submitted values.

## Explicit settings and comparison keys

`config/quality-policy.json` records `short_text_review_below=3` and `comparison_case_insensitive=true`. Constructors validate a positive integer threshold (excluding booleans) and a boolean comparison flag. The threshold is retained from the existing implementation and is **not research-approved**. It is a development review signal, never a rejection solely for short text. The pipeline accepts a validated `QualityPolicy`; repository regression evidence uses the documented default settings and fails clearly for other settings rather than manufacturing matching expectations. Config changes require revised expectations and owner research review.

Text duplicate comparison key: Unicode NFC, collapse Unicode whitespace runs to one ASCII space and trim edges, then casefold when configured. This key is used only for comparisons; anonymized source text is preserved exactly. No NFKC, accent/mark stripping, joiner removal or fuzzy matching occurs. Sinhala combining marks and meaningful ZWJ/U+200D and ZWNJ/U+200C are retained. Canonically equivalent Sinhala vowel forms compare consistently. Short-text length uses source text after edge-whitespace trimming, in Unicode code points, not the comparison key or linguistic/grapheme length.

IDs must be strings. Edge whitespace is trimmed; matching is case-sensitive, without NFC, casefold or internal-whitespace collapsing. Thus `Case` and `case` are different IDs, while an ID and its edge-padded form collide. Cc/Cf/Cs code points within the trimmed ID are invalid. Numeric/boolean/collection IDs are invalid, not converted. A matching text key indicates **possible duplicate text or a masking collision**, not proof that original submissions were identical. All matching records require review, with no merging or deletion.

## Rules and expected statuses

| Condition | Issue | Status contribution |
|---|---|---|
| Unsupported record shape | `malformed_record` | REJECT |
| Missing/edge-whitespace-only ID | `missing_record_id` | REJECT |
| Non-string ID or control/format/surrogate in ID | `invalid_record_id` | REJECT |
| Repeated trimmed ID | `duplicate_record_id` | REJECT for all occurrences |
| Missing text (`None`) | `missing_text` | REJECT |
| Non-string text | `invalid_text` | REJECT |
| Surrogate code point (Unicode Cs) | `invalid_unicode_text` | REJECT before anonymization |
| Text empty after whitespace handling | `empty_text` | REJECT |
| Nonempty trimmed text shorter than 3 code points | `very_short_text` | REVIEW |
| Only supported placeholders and non-content punctuation/marks | `placeholder_only_text` | REVIEW |
| No usable content without placeholders | `no_usable_content` | REVIEW |
| U+FFFD replacement character | `replacement_character` | REVIEW |
| Cc except tab/LF/CR; Cf except ZWNJ/ZWJ | `suspicious_control_character` | REVIEW |
| Repeated anonymized text comparison key | `duplicate_text` | REVIEW for all occurrences |
| Non-boolean privacy-review flag | `invalid_privacy_review_flag` | REJECT |
| Unresolved privacy-review flag | `privacy_review_required` | REVIEW and pipeline privacy-review blocking |

Usable content means at least one Unicode letter (L*), number (N*) or other symbol (So, including common emoji) after removing the existing supported masking placeholders. U+FFFD does not count as usable. Punctuation, whitespace, combining marks or joiners alone require review; they are never stripped from the output. Mathematical symbols alone are not a wellbeing-content assertion. These rules are heuristic triage signals, not semantic quality decisions. Unlisted placeholders are not assumed to be supported anonymizer tokens.

Replacement/control signals are checked on both the original valid input and anonymized output. Original signals survive even if an anonymizer masks the affected characters. Tabs/newlines, meaningful joiners, variation selectors, Sinhala marks, punctuation and emoji are preserved. Punctuation-only input may require review; no text is rejected merely for being short or containing ordinary punctuation/emoji.

## Reproducible aggregate evidence

```powershell
.\.venv\Scripts\python.exe scripts/run.py preprocessing.quality_report
```

This runs explicit policy-derived synthetic expectations and writes `artifacts/c2-data-quality/results.json` and `artifacts/c2-data-quality/quality-report.md`. A mismatch writes truthful observed evidence and exits nonzero. Missing strategy dependencies/models fail clearly; no candidate is skipped. Reports include configuration, case/execution counts, expected-versus-observed statuses/issues/ordered blocking reasons, aggregate PASS/REVIEW/REJECT and issue counts, automated release-blocking outcomes, revision and source/config fingerprints. They contain no submitted text, detected values or individual record identifiers. Scenario categories and manually assigned language slices are aggregate fixture metadata, not language-identification output.

There are 48 in-memory scenarios covering English, Sinhala, Romanized Sinhala and code-mixed inputs, expanded to 76 executions because pipeline scenarios run once per strategy. Direct quality scenarios run once. The 90 evaluated records include strategy repetitions; they are not independent observations. Expected outcomes come from the rules above. These regressions verify implementation behavior, not independent research quality or anonymization performance. Previously recorded anonymization results and the selection PDF are preserved.

See [verification evidence](../../docs/evidence/c2-data-quality-milestone.md) for actual checks and limitations.
