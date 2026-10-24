# C2 paragraph-context development investigation v5

## Predeclared protocol (before candidate inference)

Current working-tree baseline: experimental GLiNER
`gliner-name-labels-v4-context-demo-v1`, model `urchade/gliner_multi-v2.1`,
revision `443d26d654e0324125a96bebd8e796c14ff2efe6`, labels `person name` and
`location name`, threshold 0.7, existing UnicodeWordSplitter and structured PII
recognizers. No model download, training or label/threshold search.

Two user-supplied fictional paragraphs are inspected development evidence, not
held-out evaluation. Their Markdown email links are preserved literally. The
other two originally mentioned paragraphs were not supplied. Additional small
synthetic fixtures use AI-proposed typed name/place spans, not independently
reviewed gold. Existing studies remain unchanged.

Initial actual inference reproduces two Sinhala LOCATION misses and one
Romanized relationship PERSON miss. Nested decoded diagnostic scores at 0.05
are not raw logits: correct Sinhala location spans score 0.582579 and 0.565403;
the Romanized full name scores 0.283579. Runtime threshold remains 0.7. Adapter
and final selection agree; no unsafe boundary was observed. Paragraph word counts
are 108 and 101; no word-length truncation warning was emitted. This does not
prove every subword representation is linguistically adequate.

Bounded comparison, fixed before running candidates:

1. Current whole-text v4 plus existing grammar.
2. Sentence-context v4, same prompts and threshold, original-offset slices,
   plus existing grammar. Existing structured recognition remains whole-text.
3. Conservative augmentation: retain every baseline span; add non-overlapping
   sentence-context predictions at 0.7. Baseline/structured spans and placeholders
   win overlaps. Conflicting predictions abstain, rather than replacing entity
   types or guessing boundaries. This is repeated context inference with the same
   model, not independent residual validation.

Acceptance on development: improve exact typed-span PERSON/LOCATION F1; no loss
of any baseline-correct entity or structured coverage; no increase in unnecessary
masking or misses in any language slice; no new false masking on ordinary
negative controls; no Unicode/placeholder failure. Evaluate all cases, including
review-blocked ones, independently of gates. Report runtime. Do not weaken these
conditions after results. If no candidate qualifies, retain the current runtime;
do not run a new reserved set merely to tune or rescue a failed candidate.

If one qualifies, freeze one configuration and a separate varied evaluation set
before its inference, grouping related casing variants. Reference labels are
synthetic proposals; no independent-validation or universal-anonymity claim.

Runtime and demo remain unchanged while this offline probe is evaluated.

## Development-derived bounded addendum (before derivation/fresh evaluation)

Both sentence-only and all-entity augmentation failed. All five additional false
spans in augmentation were PERSON, while its four extra exact LOCATION spans
were correct on this inspected development set. The Romanized relationship
PERSON miss was not recovered. This motivates one narrower candidate, derived
from already saved predictions without rerunning inference: retain the whole-text
baseline and add only non-overlapping sentence-context LOCATION predictions at
the unchanged 0.7 threshold. Baseline PERSON predictions are not suppressed,
filtered or retyped. No word/name list, grammatical exception or lower threshold.

This fourth configuration was NOT predeclared in the initial three-way study;
it is explicitly selected using development evidence. The original results and
acceptance conditions remain unchanged. If it qualifies, freeze its exact code
and separate new evaluation fixtures before inference; do not tune on those
results. This is a possible partial LOCATION correction, not a solution for the
remaining Romanized relationship PERSON failures.

## Measured results and partial adoption

Runtime configuration: `gliner-name-labels-v4-location-context-demo-v2`.
Only the LOCATION-only supplement is active in `gliner_demo.py`; the
sentence-only and all-entity augmentation configurations remain rejected.
Existing PERSON spans, entity types, structured recognizers, thresholds,
UnicodeWordSplitter, global Regex default, quality and release policy are
unchanged. Single-window input needs no duplicate inference. Windows are
punctuation/newline-delimited original slices; supported dotted titles are not
split and email/decimal interior dots without following whitespace are not
sentence boundaries. This is conservative context segmentation, not a complete
multilingual sentence tokenizer or independent residual detector.

Original code-point spans for the reported misses:

| Development mention | Whole-text diagnostic score | Active flat output at 0.7 | Sentence LOCATION score | New final span |
|---|---:|---|---:|---|
| Sinhala location `[24,28)` | .582579 | absent | .830595 | LOCATION `[24,28)` |
| Sinhala location `[157,163)` | .565403 | absent | .800410 | LOCATION `[157,163)` |
| Romanized relationship name `[172,192)` | .283579 | absent | not a LOCATION candidate | still absent |

These were low-evidence model predictions rejected by the configured threshold,
not lost selected spans. The old Sinhala residence grammar also does not cover
these colloquial `ප්‍රදේශයේ ජීවත් වෙනවා` clauses. No blanket residence-field
rule or lower threshold was added. Original substring/Unicode offsets remain
valid; the model's existing tokenizer warnings are not claimed resolved.

Before/after excerpts, taken from actual Python pipeline output:

- `මම මාතර ප්‍රදේශයේ ජීවත් වෙනවා.` → `මම [LOCATION] ප්‍රදේශයේ ජීවත් වෙනවා.`
- `ඇය මහනුවර ප්‍රදේශයේ ජීවත් වෙනවා.` → `ඇය [LOCATION] ප්‍රදේශයේ ජීවත් වෙනවා.`
- `Mage yaluwa Tharushi Senewiratne [LOCATION] wala inne.` is **unchanged**;
  the full relationship name remains exposed. Whole-text locations and the
  introduced name in that paragraph retain their earlier masks.

PERSON+LOCATION exact typed-span metrics (structured spans excluded here):

| Split/configuration | Cases | TP | FP | FN | Precision | Recall | F1 |
|---|---:|---:|---:|---:|---:|---:|---:|
| Development baseline | 34 | 27 | 8 | 11 | .7714 | .7105 | .7397 |
| Development sentence-only, rejected | 34 | 28 | 9 | 10 | .7568 | .7368 | .7467 |
| Development all-entity augmentation, rejected | 34 | 31 | 13 | 7 | .7045 | .8158 | .7561 |
| Development LOCATION-only | 34 | 31 | 8 | 7 | .7949 | .8158 | .8052 |
| Frozen evaluation baseline | 16 | 11 | 5 | 5 | .6875 | .6875 | .6875 |
| Frozen evaluation LOCATION-only | 16 | 14 | 5 | 2 | .7368 | .8750 | .8000 |

Sentence-only lost **three baseline-correct entities** and increased Romanized
misses. All-entity augmentation retained baseline entities but increased
unnecessary masking **58 → 71 characters**, with five new false PERSON spans.
The LOCATION-only candidate retains all baseline-correct entities, with no
per-language increase in missed entities or unnecessary masking. All 16 earlier
verified GLiNER outputs remain identical, including protected introduced names,
ordinary Romanized predicates and combined contacts. This does not erase the
baseline's existing false masks.

Frozen evaluation, 4 records and 2 PERSON/2 LOCATION references per language:

| Language | PERSON TP/FP/FN, unchanged | LOCATION TP/FP/FN before → after | LOCATION F1 before → after |
|---|---|---|---|
| English | 2/1/0 | 2/0/0 → 2/0/0 | 1.0000 → 1.0000 |
| Sinhala | 2/1/0 | 0/0/2 → 1/0/1 | .0000 → .6667 |
| Romanized Sinhala | 1/1/1 | 1/0/1 → 2/0/0 | .6667 → 1.0000 |
| Code-mixed | 2/2/0 | 1/0/1 → 2/0/0 | .6667 → 1.0000 |

Evaluation LOCATION totals: **4/0/4 → 7/0/1**. PERSON totals stay **7/5/1**.
Email, phone and student ID each have **4 TP, 0 FP, 0 FN**, before and after.
The development pack has no phone references, so phone accuracy is **not
measured there**; the generic evaluator's empty-set F1=1 convention is not
reported as measured phone performance. All-entity evaluation F1 including
contacts is .8214 → .8814; do not confuse it with the PERSON/LOCATION F1 above.

Fully exposed gold entities fall **11 → 7** in development and **5 → 2** in
evaluation; partial masking is zero in both configurations on these sets.
Unnecessary masking stays **58 characters** in development and **12** in
evaluation. Five existing evaluation false masks remain. No unsafe Unicode
boundary or exact-boundary type error occurred. No new ordinary-negative false
mask was introduced by the adopted candidate. Evaluation records are unique,
with no duplicate text across the two splits; this is a small synthetic study
with AI-proposed references, not independent validation. Now-inspected evaluation
cases must become development evidence in any later tuning.

Remaining evaluation misses are Sinhala LOCATION `වැලිමඩ` and Romanized PERSON
`Vihanga Udawatta`. The supplied relationship name also remains missed in
development. No name/place dictionary or output substitution was introduced.

Additional sentence-context latency: development median **486.32 ms**, max
**2329.24 ms**; evaluation median **759.05 ms**, max **1121.94 ms**, excluding
shared model load. Actual new Python pipeline first paragraph (cold load
included) **26.23 s**, second paragraph **3.34 s**. These are local timings,
not a production benchmark; memory was not remeasured.

## Privacy and implementation verification

The actual new Python pipeline executed **34 cases**: both supplied paragraphs,
16 frozen evaluation records and 16 protected records. Every output matched its
measured candidate/protected expectation; every run retained
`experimental_anonymizer_not_release_validated` and blocked release.
Both supplied paragraphs have quality PASS and privacy gate PASSED with no
automated review signal. **That includes the exposed Romanized relationship
name**: residual auditing does not reliably detect this unsupported context.
No signal is not verified anonymity, and quality PASS is not semantic NER
correctness. Human approval and existing privacy/release restrictions remain.

Affected Python suite: **102 passed**, one existing Starlette/httpx warning.
Final fixture/offset subset: **7 passed**, validating both frozen packs; these
overlap the affected-suite tests and are not added as 7 new accuracy cases. Frontend:
**56 passed**, lint/typecheck passed. Contract drift/TypeScript compatibility,
scoped Ruff, repository privacy and CI-structure checks passed. An initial
comparison harness failed on its first case with
`TypeError: dict() got multiple values for keyword argument 'gold'`; only result
collection was corrected and the frozen comparison completed. No label,
threshold or criterion was changed to hide that failure.

**Actual Docker-backed Edge browser: 34/34 complete responses match Python**,
including both supplied paragraphs, all 16 evaluation records and all 16
protected records. The executed response metadata is
`gliner-name-labels-v4-location-context-demo-v2`. Reset/edit late-response checks,
release-block rendering, unlabelled NOT_MEASURED accuracy, visible provenance and
desktop 1366/mobile 390 px (scale 1.0) overflow checks passed. Screenshots of the
supplied Sinhala Before/After were inspected. Local captures/report:
`.local/c2-demo-browser-060b161f-3724-4ac6-b92d-2961befc2b29/`.
The inherited harness's generic Presidio label is not a newly executed Presidio
comparison in this run: all 34 cases here selected GLiNER. Prior baseline API
verification remains separately recorded in the deployment report.

Only preprocessing and counsellor-dashboard containers were recreated. The
shared Python base was built using the orchestrator Compose build target, but
the running orchestrator, databases, volumes and other components were preserved.
No model/dependency changes, full benchmark restart, full-suite rerun, account
changes, commits or pushes. The demo URL is **http://localhost:3001/c2-demo**.
First request after recreation retains the documented cold-load delay; warm
execution is available after verification. The Sinhala paragraph's downstream
Language ID is uncertain; no Language ID rule was changed to improve this result.

## Evidence and reproduction

Local aggregate evidence:
`artifacts/c2-evidence/anonymization/paragraph-context-v5/`.
`protocol.json` and `evaluation-protocol.json` freeze fixtures/configuration;
`initial-diagnosis.json` records diagnostic nested scores/offsets;
`protected-and-runtime-raw.json` records actual flat 0.7 spans and protected
retention; `development-results.json`, `location-only-development.json`,
`evaluation-results.json`, `decision.json` and `python-runtime.json` retain all
outcomes without fixture text or detected values. Full fictional responses stay
in ignored `.local` verification files, never substituted into runtime output.

```powershell
.local\c2-gliner-cpu-env\Scripts\python.exe -X utf8 .local/c2-paragraph-diagnose.py
.local\c2-gliner-cpu-env\Scripts\python.exe -X utf8 scripts/c2_paragraph_context_evaluate.py
.venv\Scripts\python.exe -X utf8 .local/c2-derive-location-window.py
.local\c2-gliner-cpu-env\Scripts\python.exe -X utf8 scripts/c2_location_window_evaluate.py
.venv\Scripts\python.exe scripts/c2_paragraph_context_report.py
.local\c2-gliner-cpu-env\Scripts\python.exe -X utf8 .local/c2-v5-protected.py
.local\c2-gliner-cpu-env\Scripts\python.exe -X utf8 .local/c2-v5-runtime-python.py
.venv\Scripts\python.exe -m pytest tests/unit/test_c2_gliner_context_windows.py tests/unit/test_c2_gliner_demo.py tests/unit/test_c2_generalization_v3.py tests/unit/test_c2_residual_privacy.py tests/integration/test_c2_demo.py -p no:cacheprovider --basetemp=.local/c2-paragraph-v5-20261024-b --maxfail=2
npm test -- tests/frontend/c2-demo.test.tsx tests/frontend/c2-validation.test.tsx
.venv\Scripts\python.exe -m pytest tests/unit/test_c2_gliner_context_windows.py -p no:cacheprovider --basetemp=.local/c2-paragraph-fixtures-20261024-a
docker compose build orchestrator counsellor-dashboard
docker compose -f docker-compose.yml -f docker-compose.c2-gliner.yml build preprocessing
docker compose -f docker-compose.yml -f docker-compose.c2-gliner.yml up -d --no-deps preprocessing counsellor-dashboard
node .local/c2-v5-browser.mjs
```

Completed inference/report commands refuse to overwrite their evidence. The
historical pre-adoption comparison must use its frozen baseline implementation;
it must not silently compare the new runtime against itself. See
[deployment/configuration](c2-gliner-demo-v4.md),
[prior rejected comparisons](c2-generalization-v4.md),
[residual-check limitations](c2-residual-output-v1.md) and
[quality/privacy policy](c2-quality-privacy-v1.md).
