# C2 provisional text-preparation baseline — 2026-10-14

Stage-specific checkpoint reports reuse this original measurement record:
[Language ID](c2-language-id-v1.md), [normalization](c2-normalization-v1.md),
[tokenization](c2-tokenization-v1.md). Historical results below are preserved.

Current working tree on `feature/c2-anonymization-pipeline`, HEAD
`65e4db35c775dafa6bd9939b2cf56fc1e291da51`. Existing edits and historical
evidence preserved; no commits/pushes. No runtime anonymizer, analyzer language,
threshold, quality/privacy policy or release condition was changed.

## Implemented methods and order

**Anonymize → existing Data Quality → Language ID → Normalize → Tokenize.**
Language ID still analyses unchanged anonymized text after quality assessment.
`anonymized_text` remains untouched. Derived `normalized_text` uses
`c2-nfc-whitespace-v1`: canonical NFC, trim and collapse Unicode whitespace
(including newlines/tabs) to one ASCII space. Case, negation, punctuation, emoji,
joiners and placeholders stay intact; no spelling correction, translation,
transliteration, stemming or stop-word removal. Canonically equivalent mark
sequences can change code-point representation; original offsets are not reused.

`c2-grapheme-words-v1` uses the already locked `regex` package's `\X` graphemes,
groups letter/mark/number/joiner clusters into words, retains internal apostrophes
and hyphens, preserves known placeholders as one token, and emits punctuation/
emoji graphemes separately. A combining mark attached to a placeholder's closing
bracket stays attached, rather than introducing an unsafe grapheme boundary.
This language-independent baseline also tokenizes uncertain/unknown inputs. It
does not establish linguistic word segmentation, sentence analysis or annotation.
Decimals split around punctuation; languages without spaces may produce coarse
word runs. No text is dropped except whitespace separators.

`tokens` and `token_offsets` accompany normalized text. Each offset is a zero-based
**[start, end) Unicode code-point** pair in `normalized_text`, not UTF-8 bytes,
UTF-16 units, grapheme indexes or original-input offsets. JavaScript must slice
`Array.from(normalized_text)`, not directly use code-point offsets in `.slice()`.
Shared C2 contracts add optional derived fields for older-response compatibility;
JSON Schema, both OpenAPI documents and TypeScript were regenerated together.
Existing mock/C1 protocol remains unchanged. No persistence/migration is needed.

## Method selection: reviewed versus executed

Official documentation was consulted in a bounded review, not a broad tool/model
search. Documentation does not constitute measured performance on C2 inputs.

| Stage | Documentation-reviewed alternative/reference | Executed on the same frozen labelled inputs? |
|---|---|---|
| Language ID | [fastText lid.176](https://fasttext.cc/docs/en/language-identification.html): official labels include en/si, two distributed models, UTF-8 input and CC-BY-SA 3.0 model licensing. The documented label set is not a separate Romanized/code-mixed classification task. | **No**. No download, install, training or hosted inference. Only current `c2-rule-language-v1` executed on its existing 33 cases. No comparative Language ID winner is claimed. |
| Normalize | [Python 3.12 Unicode normalization](https://docs.python.org/3.12/library/unicodedata.html#unicodedata.normalize): NFC canonical composition versus NFKC compatibility folding. [str.split](https://docs.python.org/3.12/library/stdtypes.html#str.split) defines whitespace splitting/collapsing. | NFC+whitespace and whitespace-only reference **both executed on the same 16 cases**. NFKC was **reviewed only**, because compatibility folding is outside the conservative current policy. |
| Tokenize | [regex official README](https://github.com/mrabarnett/mrab-regex#matching-a-single-grapheme-x) documents grapheme `\X`; its WORD flag offers Unicode word boundaries. Python's `str.split` is a whitespace reference. | Current grapheme-word method and whitespace splitting **both executed on the same 16 cases and identical gold normalized text**. WORD-boundary segmentation was **reviewed only**, not executed. |

These choices provide a small auditable offline baseline using installed packages,
not proof of a best-performing method. No model alternative was activated.

## Actual measured evidence

Reproducible aggregate JSON (no fixture text or detected values):
`artifacts/c2-evidence/text-preparation/provisional-v1/report.json`.
Frozen labelled cases and the evaluation implementation are in
`scripts/c2_preparation_evaluate.py`; source hashes, HEAD and versions are recorded.
The 16 manually specified synthetic cases cover Sinhala, English, Romanized,
mixed, weak/unknown inputs, marks/joiners, emoji, whitespace, negation and
placeholders. Some constructions reuse regression diagnostics. **All are
development evidence**, not untouched final cases, independent human annotations
or research validation. Gold tokens were specified before execution, not derived
from predictions. No labels/cases were changed after seeing results.

| Normalization method | Exact normalized matches | Operational preservation errors |
|---|---:|---:|
| NFC + whitespace | 16/16 | 0 |
| Whitespace-only reference | 15/16 | 0 |

The reference retains the decomposed café accent, failing canonical normalized
gold on one case. Preservation means non-whitespace content remains canonically
equivalent under NFC. It is **not a measured semantic-accuracy claim** or a
general human judgement of meaning preservation.

| Tokenizer | Exact sequences | TP / FP / FN token spans | Token-span P / R / F1 | Placeholder errors | Offset / unsafe-boundary / content errors |
|---|---:|---|---|---:|---|
| Current grapheme words | 16/16 | 75 / 0 / 0 | 1 / 1 / 1 | 0 | 0 / 0 / 0 |
| Whitespace reference | 4/16 | 36 / 17 / 39 | .6792 / .4800 / .5625 | 6 | 0 / 0 / 0 |

Metrics are exact **token text+span** agreement with this small development gold,
not entity detection, multilingual NLP accuracy or annotation correctness.
Whitespace splitting merges punctuation and adjacent placeholders with words;
it preserves content and offsets but fails the required segmentation policy.

Language ID reuses the unchanged 33-case report under
`artifacts/c2-evidence/language-id/rule-baseline-v1/report.json`. Actual re-execution
confirmed **zero prediction changes**. Sinhala 6/6, English 4/6, Romanized 3/6,
code-mixed 2/6 match intended original languages: **15/24 language cases** matched,
**7/24 abstained**, and **2/24 returned wrong provisional labels**. Unknown and
ambiguous controls returned their expected unknown/uncertain labels, 9/9. Across
all 33, 16 results are unknown/uncertain. The two mixed→English errors follow
existing masking that removes Romanized evidence before this stage. No alternative
was executed on these language inputs; [Language ID evidence](c2-language-id-v1.md)
documents criteria and individual limitations. Scores are not probabilities.

### Runtime, not a load benchmark

One local CPU pass, 16 short derived-text inputs and 33 reused Language ID inputs;
imports are excluded from stage times. No repeats, warm-up optimization, memory
measurement or concurrency/load test was performed. These timings are descriptive
and include scheduling noise; they do not establish a speed winner.

| Method | Mean / median / max milliseconds per input |
|---|---|
| NFC + whitespace | .1219 / .00185 / .8143 |
| Whitespace-only normalization | .00109 / .0010 / .0026 |
| Current tokenizer | .2205 / .0923 / 1.1327 |
| Whitespace tokenization | .01105 / .00695 / .0483 |
| Language ID stage | .02667 / .0261 / .0533 |

The 33 full pipeline calls totalled 5896.04 ms, median 10.69 ms and maximum
5340.82 ms; the first call includes Presidio/spaCy model initialization. This
is different from stage-only runtime. Exact Python/Unicode/regex/spaCy versions
are recorded in the aggregate report; no dependency versions were changed.

## Bounded next-comparison plan — not executed

Freeze reviewed language/token labels and policy before any future execution.
Previously used 33/16 cases remain diagnostics; add a small separately reserved
set only after human review of ambiguous language and token-boundary labels.
Evaluate at most **one additional method per stage**, without tuning on reserved
results: an isolated local fastText model with immutable weights/hash and license
check; NFKC+whitespace only as a compatibility-change diagnostic; and regex WORD
segmentation with explicit placeholder protection. Use identical inputs per
stage and unchanged labels, count errors and abstentions separately, retain all
known failures, measure offsets/Unicode/content/placeholder integrity and CPU
runtime. Do not collapse Romanized/mixed labels into English/Sinhala merely to
make a model score well. No adoption unless preservation and existing release
controls survive; no claim of calibrated confidence or independent validation.

## UI and verification

Page: **http://localhost:3001/c2-demo**, private development counsellor sign-in.
Centered 1120px maximum, balanced input/output desktop columns, stacked mobile
cards. Stepper sits below the heading: Anonymize, Data Quality, Language ID,
Normalize, Tokenize, Annotate, Validate, Versioned Release. Confirmed executions
are green, review/error are amber/red with text, pending stages are gray. Without
intermediate backend events, the blue spinner represents overall processing;
there is no fabricated active stage. Annotate, annotated-dataset Validate and
Versioned Release remain Pending even if existing automated gates pass.
Technical configuration, language reasons and token offsets are expandable;
privacy/human-release warnings remain visible. Accessible status/alert toasts
reflect actual responses. Reset, edits/logout and sequencing invalidate stale
results; no browser persistence or participant-data input was introduced.

Checks executed so far: full Python **910 passed, 23 xfailed**, 116.21s; frontend
focused **45 passed**, full **61 passed**. Lint/typecheck, contract drift and full
suite compatibility, repository/CI structure, scoped Ruff/format and whitespace
checks passed. Known 63 global C3 Ruff errors were not rerun or modified; reuse
the previous recorded result. The first new Python focused run had 157 passes
and one desired-output failure for Hybrid `mge nama neluni`; prior Docker evidence
already records the same false introductory PERSON span [0,8). Desired gold is
retained with a strict expected-failure mark; no detector was changed to conceal
it. The demo's Presidio and Regex outputs still preserve the introduction.
An initial frontend typecheck found the schema generator's tuple/unknown typing;
the additive C2 offset schema now uses constrained two-integer lists, with identical
JSON pair shape, and regeneration/typecheck pass. Existing C1 tuple fields were
not edited.

Docker images built successfully. Docker Desktop stopped before startup and was
restarted; no volumes were reset. Affected services restarted healthy; existing
45-execution authenticated demo smoke passed. Actual local-Python/Docker parity
passed all **70** protected contextual/contact cases. Comparing their stored
measurements to the prior Language ID checkpoint confirmed unchanged spans,
transformations, quality status and release/blocking results for **all three
strategies**, unchanged runtime configuration and unchanged anonymizer source
hashes. All 33 Language ID predictions were also unchanged. This comparison
retains existing failures; it does not turn parity into accuracy.

Edge 155.0.4283.45 passed 73 real page runs (70 reused protected cases plus
three actual-response fixtures covering normalization/emoji, empty rejection
and relationship privacy review). Before/After, derived text, tokens and code-point
slices match actual responses. Visual inspection caught the initial stylesheet
ordering defect that kept narrow input/output columns side by side despite no
horizontal overflow; the base rules were moved before media overrides. A new
browser geometry assertion requires genuinely stacked mobile cards. The first
reorder accidentally split a media selector and caused a CSS build parse error;
the block boundary was corrected and the subsequent Docker build passed. These
were UI implementation defects, not preprocessing comparison errors. Final
browser verification then passed all 73 cases again, including exact rendered
token-offset table values, code-point slicing, stepper placement, no overflow,
genuinely stacked 390px cards, sign-in, Reset/logout and no browser storage.
Final desktop and mobile screenshots were visually inspected under
`.local/c2-demo-browser-13b9ce04-09e7-444c-acda-7602d23c3d58`.
Preprocessing/full-test results were reused after the CSS-only correction rather
than rerunning the full suite. Lint and the final frontend Docker build passed.

Decision: **retain the implemented methods as a provisional baseline**. There
is no supported best-performing claim, calibrated language confidence or privacy
release threshold. Alternative Language ID/WORD/NFKC performance remains unmeasured.

### Reproduction commands

```powershell
.venv\Scripts\python.exe scripts\run.py scripts.c2_preparation_evaluate --output-dir artifacts/c2-evidence/text-preparation/provisional-v1
.venv\Scripts\python.exe -m pytest tests/unit/test_c2_text_processing.py tests/unit/test_c2_language_id.py tests/integration/test_c2_demo.py
.venv\Scripts\python.exe -m pytest
npm run lint
npm run typecheck
npm test -- tests/frontend/c2-demo.test.tsx
npm test
.venv\Scripts\python.exe scripts\run.py scripts.generate_contracts --check
npm run contracts:check
.venv\Scripts\python.exe -X utf8 scripts/check_repository.py
.venv\Scripts\python.exe scripts/check_ci.py
.venv\Scripts\ruff.exe check scripts/c2_preparation_evaluate.py services/preprocessing/text_processing.py services/preprocessing/pipeline.py packages/contracts/src/research_contracts/__init__.py tests/unit/test_c2_text_processing.py
.venv\Scripts\ruff.exe format --check scripts/c2_preparation_evaluate.py services/preprocessing/text_processing.py services/preprocessing/pipeline.py packages/contracts/src/research_contracts/__init__.py tests/unit/test_c2_text_processing.py
git diff --check
docker compose build preprocessing counsellor-dashboard
docker compose up -d --no-deps --wait preprocessing orchestrator counsellor-dashboard
.venv\Scripts\python.exe scripts\run.py scripts.c2_contextual_verify --output-dir artifacts/c2-evidence/text-preparation/provisional-v1/docker-parity --browser-inputs .local/c2-text-preparation-browser-inputs.json
.venv\Scripts\python.exe scripts\run.py scripts.c2_demo_smoke
node scripts/c2_demo_browser.mjs .local/c2-text-preparation-browser-inputs.json
```

Evidence commands refuse to overwrite output: use fresh paths to reproduce.
The browser-input file was extended with the three texts from actual responses
in `tests/fixtures/synthetic/c2-text-processing.json`, using `processed`, `empty`
and `review` case IDs. Fixtures/results were never substituted into live API
responses. `preservation.json` records comparisons with previous evidence.

Files affected: `services/preprocessing/text_processing.py`, `pipeline.py`;
authoritative shared C2 record fields and regenerated C2 schemas, both OpenAPI
documents and TypeScript declarations; C2 `page.tsx`, `demo.css`, new
`PipelineStepper.tsx`; unit/frontend tests and the synthetic actual-response
fixture; `scripts/c2_preparation_evaluate.py`, C2 browser verifier; this evidence
document and `c2-demo-page.md`. Existing unrelated working-tree changes remain
preserved and unstaged. No C1 authentication, C3 modelling or C4 research changes.

Remaining limits: rule Language ID ambiguity, anonymization evidence loss,
known Sinhala/Romanized name misses/false masking, pre-existing Hybrid overmasking,
non-linguistic token boundaries and collapsed paragraph whitespace. Annotation,
dataset validation and versioned human-authorized release are not implemented.
