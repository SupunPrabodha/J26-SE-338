# C2 normalization evidence report

Purpose: produce a separate stable `normalized_text` after Language ID while
retaining `anonymized_text`, all quality/privacy policies and release blocking.
Actual configuration: `c2-nfc-whitespace-v1` in
`services/preprocessing/text_processing.py`, Python 3.12.10 Unicode database
15.0.0; canonical NFC, trim/collapse Unicode whitespace to one ASCII space.
Case, negation, punctuation, emoji, combining-mark equivalence, joiners and
masking placeholders are preserved. No spelling replacement, translation,
transliteration, stemming or stop-word removal.

Selection rationale: conservative canonical equivalence with a small, auditable
transform. [Python normalization documentation](https://docs.python.org/3.12/library/unicodedata.html#unicodedata.normalize)
and [whitespace splitting](https://docs.python.org/3.12/library/stdtypes.html#str.split)
were reviewed. NFC+whitespace and whitespace-only reference were **actually
executed on the same frozen inputs**. NFKC compatibility folding was reviewed
only, not executed or adopted; no best-performing claim.

Fixture provenance: 16 fixed, manually specified synthetic development cases in
`scripts/c2_preparation_evaluate.py:FROZEN`, covering four language metadata
groups, weak/unknown content, Sinhala marks/joiners, negation, emoji, placeholders,
decomposed accents and whitespace. Some reuse existing diagnostic constructions;
not independent human review or held-out validation. Expected normalized strings
were specified before execution and were not derived from predictions.

| Method | Exact expected strings | Operational preservation errors |
|---|---:|---:|
| NFC + whitespace | 16/16 | 0 |
| Whitespace-only reference | 15/16 | 0 |

The reference fails the decomposed café canonical-form case. Preservation means
non-whitespace content is canonically equivalent under NFC, **not measured
semantic accuracy**. No normalization abstention/failure occurred on this pack;
invalid/empty inputs retain existing quality rejection/review independently.
Mean/median/max stage wall time .1219/.00185/.8143 ms, one 16-case CPU pass;
reference .00109/.0010/.0026 ms. Scheduling noise, no load/memory evaluation.

Limits: whitespace collapse removes paragraph/formatting distinctions; NFC may
change code-point representation. No original-to-normalized offset mapping or
semantic/language-specific normalization is claimed. Expand evaluation with
reviewed formatting-sensitive cases before changing policy. Untested next
comparison: at most one NFKC diagnostic against unchanged labels plus separately
frozen compatibility-sensitive cases; do not adopt content-changing folding merely
to improve a score. No such experiment is run in this checkpoint.

Exact reproduction (new output directory required):

```powershell
.venv\Scripts\python.exe scripts\run.py scripts.c2_preparation_evaluate --output-dir artifacts/c2-evidence/text-preparation/reproduction-normalization
.venv\Scripts\python.exe -m pytest tests/unit/test_c2_text_processing.py tests/unit/test_c2_language_id.py tests/integration/test_c2_demo.py
```

The reusable script also records tokenization and current Language ID timing;
its preserved baseline-result timing comparison requires the existing local
ignored Language ID report. Accuracy/preservation results above come from the
16-case aggregate `artifacts/c2-evidence/text-preparation/provisional-v1/report.json`,
not unit-test counts. [Combined original measurement/provenance](c2-text-preparation-v1.md)
is preserved rather than duplicated as a new historical run.
See [Language ID](c2-language-id-v1.md), [tokenization](c2-tokenization-v1.md),
[anonymization evidence](c2-anonymization-milestone.md),
[active role/privacy limitations](c2-role-kinship-v3.md), and
[quality/privacy evidence](c2-data-quality-milestone.md).
