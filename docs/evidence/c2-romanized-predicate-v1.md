# Romanized predicate PERSON correction v1

2026-10-14. Baseline is the current working tree, including the uncommitted demo,
not merely checkpoint 65e4db35. Existing protection suite before edits: 175 passed,
1 known xfailed. Original raw SpacyRecognizer predictions: PERSON [11,21) and
[35,45), score 0.85, in the two previously reported diagnostics. Their selected
outputs are falsely masked. Current contextual name introductions remain correct.

## Predeclared single candidate and acceptance

Hypothesis: a bounded first-person experiential clause has a topic postposition
and a terminal inflected predicate that English NER can mistake for PERSON.
Recognize sentence-start Mata/mt/මට, one to eight topic tokens, gana/gena/ගැන,
then one letter token ending in ai. These are grammatical markers/inflection,
not a dictionary of names, emotion words or complete fixture sentences.
Only SpacyRecognizer PERSON results fully contained in the predicate role may
be removed. No other entity, threshold, strategy or model changes.

Abstain if an explicit name introduction overlaps the role; if the existing
English pipeline, analyzing the bounded clause independently, tags the topic
as VERB/AUX or the terminal predicate as a proper noun; or if the role's Unicode
boundaries are unsafe. Separate clause analysis avoids prior introductions changing
the English tagger's treatment of the same following sentence. English POS tags
are an abstention signal, not validated Romanized Sinhala grammar or language ID.
Broader/partial PERSON spans are left intact rather than discard nearby names.

Freeze this one configuration before fresh held-out inference. Acceptance:
both existing diagnostics corrected, every protected output unchanged, zero
baseline-correct gold spans lost in development and separate held-out fixtures,
structured PII and placeholders retained, no unsafe boundaries or trace/render
disagreement. Measure missed entities and false masking together. New fixtures
are synthetic developer annotations, not independent research validation. Previously
inspected diagnostics/development records are never counted as fresh held-out data.
If a condition fails, keep the correction offline. Do not weaken the conditions.

An initial harness incorrectly treated six contact fixtures containing the
reported false predicate as already-correct full outputs; it rejected removal of
that false predicate despite preserving every correct contact span. This harness
error was corrected before held-out inference: baseline-exact outputs stay
byte-identical, and all baseline-correct spans and gold character coverage remain
protected even in outputs with existing false masking. Initial evidence is retained.
No runtime configuration or fixture expectation changed to resolve the harness error.

Evidence will be stored separately under ignored
`artifacts/c2-evidence/anonymization/romanized-predicate-v1`.

## Executed result: activated with conservative abstention

The one frozen candidate passed development and the separately frozen 12-case
held-out evaluation, without changing thresholds, fixture labels or configuration
after held-out results. Runtime selection version is now
**c2-contextual-fields-v1+c2-romanized-predicate-v1**. Raw analyzer predictions
are unchanged; only the identified spaCy PERSON predicate spans are excluded
from masking. Runtime counts, transformations and original-offset evaluation
share the selected results. No NLP model/strategy changes or new dependencies.

Actual outputs, verified in Python, rebuilt Docker and the dashboard:

| Fictional diagnostic | Before | After |
|---|---|---|
| Mata exams gana dukai. | Mata exams [PERSON]. | Mata exams gana dukai. |
| Mage nama Nimal Perera. Mata exams gana dukai. | Mage nama [PERSON]. Mata exams [PERSON]. | Mage nama [PERSON]. Mata exams gana dukai. |
| Mata met Gana Dukai. | Mata met [PERSON]. | Mata met [PERSON]. |
| mata met gana dukai. | mata met [PERSON]. | mata met [PERSON]. |

Previously verified `mge nama neluni`, full English/Sinhala introductions, ordinary
Sinhala self statements, bounded Sinhala residence, combined five-entity masking,
placeholders and Unicode/emoji behaviours retain their expected outputs. The model
still proposes confidence 0.85 PERSON on the reported predicate; that raw confidence
is not an accuracy probability. Independently processing the clause prevents a
preceding introduced name from changing English POS treatment of the same next
sentence. Missing provenance/engine information causes abstention, not suppression.

| Set | Cases | Exact misses before → after | Fully unmasked PII before → after | Unnecessary masking characters before → after |
|---|---:|---|---|---|
| Development, including protections and 40 reviewed development records | 122 | 32 → 32 | 22 → 22 | 360 → 220 |
| New frozen held-out synthetic regressions | 12 | 1 → 1 | 1 → 1 | 44 → 24 |

**Zero previously correct entity spans or gold masking characters were lost** in
either set. No protected baseline-exact output changed. No unsafe Unicode boundary
or trace/render disagreement. The historical annotation reserved partition and
recorded benchmark were not inferred or used for tuning. New held-out fixtures
are developer-labelled synthetic regressions, not independent research validation.
They are now inspected evidence and must not be called untouched future tests.

Remaining held-out errors are genuine and unchanged: the short `mt grades` context
abstains under the English POS rule, capitalized predicate Dukai is treated as
proper-noun ambiguity, and a contact case retains four falsely masked characters
outside the predicate role. Raviai was not detected before or after. Broader
PERSON spans, placeholders inside topic fields, predicates without the supported
inflection, non-terminal/other-person clauses and POS ambiguities can remain
incorrect. Informal Supun/Senali and Ms. aprna remain outside this correction.
This does not establish complete name detection or reliable Romanized grammar.
Quality PASS/gate success still does not establish anonymization correctness,
authorize human release or prove zero privacy risk.

## Actual verification and reproduction

```powershell
# Before editing: current working-tree protection suite
.venv/Scripts/python.exe scripts/run.py pytest tests/unit/test_c2_contextual_detection.py tests/unit/test_c2_student_id_selection.py tests/unit/test_c2_pii_coverage.py tests/unit/test_c2_anonymization.py tests/unit/test_c2_anonymization_evaluation.py -q -o addopts= --basetemp=.local/pytest-predicate-baseline --tb=short
# Single fixed candidate; fresh held-out only after development passes
.venv/Scripts/python.exe scripts/run.py scripts.c2_predicate_evaluate --output-dir artifacts/c2-evidence/anonymization/romanized-predicate-v1/evaluation
.venv/Scripts/python.exe scripts/run.py pytest tests/unit/test_c2_romanized_predicate.py tests/unit/test_c2_contextual_detection.py tests/unit/test_c2_student_id_selection.py tests/unit/test_c2_pii_coverage.py tests/unit/test_c2_presidio_development.py tests/unit/test_c2_demo_person_samples.py tests/unit/test_c2_demo_romanized_diagnostics.py -q -o addopts= --basetemp=.local/pytest-predicate-focused-final --tb=short
.venv/Scripts/python.exe scripts/run.py pytest -q -o addopts= --basetemp=.local/pytest-predicate-full-final --tb=short
docker compose up -d --build --wait --no-deps preprocessing orchestrator
.venv/Scripts/python.exe scripts/run.py scripts.c2_predicate_verify --output-dir artifacts/c2-evidence/anonymization/romanized-predicate-v1/parity --browser-inputs .local/c2-predicate-browser-inputs.json
node .local/c2-predicate-browser.mjs
.venv/Scripts/python.exe scripts/run.py scripts.generate_contracts --check
.venv/Scripts/python.exe -X utf8 scripts/check_repository.py
.venv/Scripts/python.exe scripts/check_ci.py
npm run contracts:check
npm run lint
npm run typecheck
npm test -- --reporter=dot
git diff --check
```

Before edits: **175 passed, 1 known xfailed**. Focused final suite: **202 passed,
3 known xfailed**. Full Python after final runtime changes: **647 passed, 4 known
xfailed** (83.45s), one existing Starlette/httpx warning. Four resolved diagnostic
xfail marks were removed; their original gold/expected outputs were retained.
The quality-versus-correctness regression now uses another remaining false mask,
and raw prediction evidence asserts the reported PERSON is not selected for masking.
Initial full tests exposed a missing-metadata mock compatibility issue; conservative
getattr handling fixed it without changing protected assertions or actual model
predictions. Final test-only whitespace formatting was verified separately.

Scoped Ruff and formatting pass for the changed C2 files. Contract drift,
compatibility (full suite), repository/privacy, CI structure, frontend lint/typecheck,
**48 frontend tests** and diff whitespace checks pass. Repository-wide Ruff still
has **63 existing C3 failures**; C3 and the global CI workflow were untouched.

Docker Desktop was initially stopped; it was started hidden, then affected services
rebuilt and became healthy. **All 82 real authenticated Docker responses equal
local Python**, preserve original synthetic input and return no-store. Edge
155.0.4283.45 verified every actual Before/After, transformations, quality/gates,
ordered reasons, counts, eight stages, limitations, Reset/logout and narrow 390px
Sinhala rendering. The corrected Nimal/predicate screenshot was visually inspected.
Report/screenshots: `.local/c2-demo-browser-b79fe2ff-1170-4d01-be2d-4e796515b718`.
No credential screenshots, browser storage, text logs or hosted inference.

Evidence: `initial-baseline.json` (registry/raw spans/POS/selected offsets/hashes),
`offline/report.json` (retained initial harness rejection), `evaluation/report.json`
(development/held-out comparison), `aggregate.md`, `parity/report.json` and
`manifest.json`. These local artifacts remain ignored; aggregate reports omit
fixture text and detected values. Source hashes, frozen fixture hash and unchanged
historical annotation reserved hash record provenance. For reproduction use fresh
paths; the tool disables only this guard for the working-tree baseline and restores
it with finally. All prior contextual/student-ID work remains active.

URL: **http://localhost:3001/c2-demo**. Use the existing private development
counsellor login. No commits, pushes, stash, reset, checkout-overwrite or discarded
work. All existing edits and historical reports are preserved.
