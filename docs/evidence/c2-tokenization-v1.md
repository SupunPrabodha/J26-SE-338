# C2 tokenization evidence report

Documentation reference: committed c2adc308. Actual method and executed reference
comparison are distinguished below; the 16-case measurements are preserved from
the original run, not rerun for the 2026-10-15 documentation consolidation.
See [current quality/privacy report](c2-quality-privacy-v1.md).

Purpose: expose actual tokens after normalization for every language category,
including uncertain/unknown, without changing masking or release decisions.
Configuration: `c2-grapheme-words-v1` in `services/preprocessing/text_processing.py`,
already locked `regex==2026.9.29`, Python 3.12.10. Unicode `\X` graphemes are grouped
into letter/mark/number/joiner word runs; internal apostrophes/hyphens stay with
words. Known masking placeholders stay intact as single tokens. Punctuation and
emoji are emitted as grapheme tokens; only whitespace separators are omitted.
Offsets are zero-based **[start,end) Unicode code points in normalized_text**,
not original offsets, UTF-16 units or UTF-8 bytes. Use `Array.from(text)` in JS.

Selection rationale: preserve Unicode boundaries, placeholders and meaningful
surface content with installed packages. The [official regex README](https://github.com/mrabarnett/mrab-regex#matching-a-single-grapheme-x)
documents grapheme and WORD-boundary support; [Python str.split](https://docs.python.org/3.12/library/stdtypes.html#str.split)
is the whitespace reference. Current tokenizer and whitespace splitting were
**executed on the same gold normalized inputs**. WORD segmentation was reviewed
only, not executed; no comparison with spaCy/SentencePiece or best-performing
claim is made.

Fixture provenance: the same 16 manually specified synthetic development cases
in `scripts/c2_preparation_evaluate.py:FROZEN`; 75 manually specified gold token
text/span pairs. Four language metadata groups and weak/unknown controls, with
marks/joiners, contractions, numbers, punctuation, emoji and adjacent placeholders.
Not independent linguistic annotation, participant data or untouched final cases.

| Method | Exact sequences | Token-span TP/FP/FN | P/R/F1 | Placeholder errors |
|---|---:|---|---|---:|
| Current | 16/16 | 75/0/0 | 1/1/1 | 0 |
| Whitespace reference | 4/16 | 36/17/39 | .6792/.4800/.5625 | 6 |

Both have zero measured offset, grapheme-boundary and non-whitespace-content
errors. The reference merges punctuation/adjacent placeholders with words.
Metrics are agreement with these specified token boundaries, **not entity
detection or general language/semantic accuracy**. No tokenizer abstention;
empty content returns empty tokens, while existing gates still block/review it.
One CPU pass mean/median/max stage wall times: current .2205/.0923/1.1327 ms,
reference .01105/.00695/.0483 ms. No memory/load benchmark or speed winner.

Limits: this is not morphology, sentence parsing or annotation. Decimals split
around punctuation; scripts without spaces can give coarse word runs. A mark
attached to a placeholder's closing bracket stays with its grapheme. Token/offset
policy needs domain review before downstream research use. Bounded unexecuted
next comparison: one regex WORD method with placeholder protection on unchanged
diagnostics plus separately frozen reviewed boundaries; retain all errors and
measure content/Unicode/offset preservation alongside exact agreement.

Exact reproduction, with a fresh output directory:

```powershell
.venv\Scripts\python.exe scripts\run.py scripts.c2_preparation_evaluate --output-dir artifacts/c2-evidence/text-preparation/reproduction-tokenization
.venv\Scripts\python.exe -m pytest tests/unit/test_c2_text_processing.py tests/integration/test_c2_demo.py
npm test -- tests/frontend/c2-demo.test.tsx
```

The script's preserved Language ID timing comparison requires the existing local
ignored baseline report; it is not a runtime dependency. Aggregate results reside
in `artifacts/c2-evidence/text-preparation/provisional-v1/report.json`.
[Original combined measurements/checks](c2-text-preparation-v1.md) remain unchanged.
See [normalization](c2-normalization-v1.md), [Language ID](c2-language-id-v1.md),
[anonymization provenance](c2-anonymization-milestone.md),
[active role/privacy limitations](c2-role-kinship-v3.md), and
[quality/privacy milestone](c2-data-quality-milestone.md). Unit-test passes and
UI/Docker parity are engineering checks separate from these measurements.
