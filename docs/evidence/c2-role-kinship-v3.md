# C2 role/kinship contextual correction v3

Predeclared 2026-10-14, before implementing/evaluating the augmentation.
Baseline is the current working tree, including honorific/role v2, predicate
guard, student-ID precedence and privacy gates. Historical studies are unchanged.

## Scope and acceptance

Support finite documented role spellings `supervisor`/`supervisior`,
`group leader`/`grp leader`; case-insensitive dotted/undotted titles; possessive
`mage`/`mge` + `nangi`/`nngi`. These are bounded apposition contexts, not a
general kinship or Romanized-language recognizer. Preserve introductory wording
and mask only 1–4 lexical name words. Stop at existing clause/function-word
boundaries. English POS remains an abstention aid, not language identification.
Romanized possessive contexts ending in a possible `-ai`/`-ui` predicate are ambiguous:
abstain from contextual masking and require review, rather than treating them as
names. This also abstains on possible genuine names with that ending; no global
name blacklist or NER suppression is authorized.

A role followed by a title is one parsed introduction. Only a successfully parsed
name licenses removal of overlapping PERSON/LOCATION coverage of that introduction.
Unknown fields, malformed alphanumeric continuations and uncertain boundaries
must retain actual output and block release through existing review fields.

Acceptance: exact named spans for declared unambiguous new development positives;
no added masking on declared negatives; no baseline-correct gold entities or gold
masking coverage lost on protected/reused development cases; original-text Unicode
boundaries and span/runtime agreement; review/release blocking for unresolved
supported contexts. Freeze separate held-out fixtures before development inference;
evaluate once after development passes, without changing expectations. Synthetic
tests are not independent research validation. All earlier inspected sets are reused
diagnostic/development evidence, not untouched final validation.

## Initial reproduction

Current Python and authenticated Docker agree: only the first reported name is
detected, via the contextual v2 title recognizer at [19,25); the second role name
and kinship name are missed. No raw spaCy entities occur in either input.
Both records are PASS, review=false, privacy PASSED, automated prerequisites=true.
Human release approval remains required. The screenshot's role-word masking was
not reproduced by this running snapshot; it is not evidence for global NER removal.

Baseline metadata/source snapshots are local ignored evidence at
`artifacts/c2-evidence/anonymization/role-kinship-v3/`.

## Implemented runtime and exact outputs

Selector: `c2-contextual-fields-v1+c2-romanized-predicate-v1+c2-role-kinship-v3`.
Registry: `c2-contextual-fields-v1+c2-role-kinship-v3` (PERSON/LOCATION).
Presidio 2.2.364, spaCy 3.8.16, en_core_web_sm 3.8.0 and thresholds are unchanged.
Global default remains Regex; the page explicitly executes Presidio. No model,
authentication, contract, quality-policy or other-member component changes.

The shared parser combines role/kinship and optional title into one introduction,
with original offsets covering only the name. Existing selection consequently
trims overlapping introductory PERSON/LOCATION coverage only after successful
parsing, preserving neighbouring and structured entities. Placeholder protection
uses that same combined context in Hybrid's second pass. No fuzzy typo matching,
name dictionary or global PERSON suppression. Rule weight 0.85 is not probability.

Both anonymizer wrappers retain the original unresolved-context boolean as well
as checking the masked output. Broad NER can erase an introduction without fully
covering an unbounded naming field; that must not erase its review signal. Existing
quality-policy/privacy/release routing honours this flag. Quarantine is blocking
metadata, not persisted text or a C1 review task. No logging or database writes.

Python, rebuilt Docker and actual dashboard agree exactly:

```text
Input:
ape supervisior ms aparna. ape grp leader supun
Before:
ape supervisior ms [PERSON]. ape grp leader supun
After:
ape supervisior ms [PERSON]. ape grp leader [PERSON]

Input / before:
mge nngi senali
After:
mge nngi [PERSON]
```

Selected PERSON offsets `[19,25)`, `[42,47)` and `[9,15)` come from the contextual
v3 recognizer. Transformation: `presidio:person`. Both are PASS, review=false,
privacy PASSED, automated prerequisites=true. Human approval is still required;
no flag does not establish universal privacy safety or semantic correctness.

Unresolved `mage nangi relora venira devina noravi kelira.` actually produces
`mage [PERSON] noravi kelira.`. That partial/broad mask is preserved, not called
successful. Original field evidence now makes it REVIEW, review=true, privacy
FAILED and automated gate Blocked. Ordered reasons: `data_quality_review_required`,
`privacy_review_required`, `release_privacy_gate_failed`. `mge nngi avira123.`
remains unchanged but blocked. Quality REVIEW reuses its existing privacy-flag
policy; structural quality is distinct from complete PII detection.

## Evaluation and remaining failures

Development: 23 new fixtures (12 positives/11 proposed negatives), three unresolved
diagnostics, and 171 reused fixture executions: 117 protected/context/predicate,
14 inspected v2 held fixtures, 40 author-self-reviewed annotation development
records. These overlap previous studies and are not independent validation.
AI-assisted user self-review is not independent review or agreement measurement.
Annotation reserved inference was not run; its unchanged SHA-256 remains
`9c300d16741afb0a97f982d8046700485bddd560ee0c548135f7dca2aa2d4794`.

Nine fresh held-out fixtures were frozen before development inference and first
evaluated after acceptance. Subsequent parity/browser checks reuse them. Nothing
was tuned to held results and no gold expectation changed.

| Measurement | Development before | After | Held before | After |
|---|---:|---:|---:|---:|
| Exact typed/span true positives | 143 | 152 | 3 | 5 |
| Exact typed/span false positives | 45 | 42 | 3 | 3 |
| Exact typed/span misses | 45 | 36 | 3 | 1 |
| Fully exposed entities | 29 | 23 | 2 | 0 |
| Unmasked gold characters | 324 | 255 | 12 | 0 |
| Unnecessary masking characters | 395 | 373 | 38 | 38 |
| Exact-span F1 | 0.7606 | 0.7958 | 0.5000 | 0.7143 |

No baseline-correct gold entities/coverage were lost, no declared negative gained
masking, and no Unicode/trace disagreement occurred. All unambiguous new development
**name** spans are exact. Structured gold stays in the metrics: the baseline
PERSON/PHONE tie in `kinship-contacts` masks the full phone but labels it PERSON.
Acceptance checks name spans and structured coverage/regression separately;
this typed/span failure is not removed from totals or claimed fixed.

Held failures remain:

- `Mge nangi rasini kumara mt exam gna byi` → `[PERSON] mt exam gna byi`:
  full name covered, but introduction also masked. English POS makes the bounded
  parser abstain, so the baseline broad NER span is retained.
- `mage nngi tanira. Mata classes gana dukai.` →
  `mage nngi [PERSON]. Mata classes [PERSON].`: name correct, pre-existing
  predicate false mask retained under the POS safeguard.
- `mge nangi sathutui.` retains a baseline broad false PERSON mask; original
  ambiguous-predicate evidence now requires privacy review and blocks release.

Six development negatives retain baseline masking of kinship wording or ordinary
predicates. Their unchanged expectations are strict expected failures. The
unpunctuated `mt exams ...` wellbeing tail is also a strict expected failure.
An attempted boundary extension did not overcome the existing POS abstention
and was removed. `romanized_predicate.py` is byte-identical to its initial snapshot.
Protected ordinary `Mata exams gana dukai.`, Nimal, Neluni, genuine Gana/Dukai
names, English/Sinhala introductions, Sinhala residence and combined contacts
retain their verified outputs. Untitled Supun/Senali, unmodelled names/locations,
ordinary nominal descriptions and indirect identifiers remain limited. Nominal
tags and word boundaries do not prove personhood; supported review signals do
not rule out arbitrary missed names.

Final comparison: `final-development/report.json`. First held inference:
`development-offset-review/report.json`. `aggregate.json` and `manifest.json`
include remaining failures, metrics and source/fixture hashes, without fixture text
or detected values. Earlier rejected intermediate checks are preserved. A new
unit-test construction initially miscounted literal offsets (32, not 30); this
was corrected against original text. Baseline replay uses pre-edit v2 functions
and original review/predicate routing, not commit 65e4db35 alone. No historical
report, rejected-candidate decision or annotation pack was overwritten.

## Actual checks and commands

From the root, use a new output directory for reproduction:

```powershell
.venv/Scripts/python.exe scripts/run.py scripts.c2_role_kinship_evaluate --baseline artifacts/c2-evidence/anonymization/role-kinship-v3/baseline_person_context.py --output-dir artifacts/c2-evidence/anonymization/role-kinship-v3/reproduction --skip-held-out
.venv/Scripts/python.exe scripts/run.py pytest tests/unit/test_c2_role_kinship.py tests/unit/test_c2_person_context.py tests/unit/test_c2_contextual_detection.py tests/unit/test_c2_student_id_selection.py tests/unit/test_c2_romanized_predicate.py -q -o addopts= --tb=short
.venv/Scripts/python.exe scripts/run.py pytest -q -o addopts= --basetemp=.local/pytest-role-kinship-v3-final --tb=short
npm run lint
npm run typecheck
npm test -- --reporter=dot
.venv/Scripts/python.exe scripts/run.py scripts.generate_contracts --check
npm run contracts:check
.venv/Scripts/python.exe -X utf8 scripts/check_repository.py
.venv/Scripts/python.exe scripts/check_ci.py
git diff --check
docker compose up -d --build --wait --no-deps preprocessing orchestrator
.venv/Scripts/python.exe scripts/run.py scripts.c2_role_kinship_verify --output-dir artifacts/c2-evidence/anonymization/role-kinship-v3/parity-final --browser-inputs .local/c2-role-kinship-v3-browser-inputs.json
.venv/Scripts/python.exe scripts/run.py scripts.c2_demo_smoke
node scripts/c2_demo_browser.mjs .local/c2-role-kinship-v3-browser-inputs.json
```

Results:

- Pre-edit protected: **124 passed, 2 xfailed**. Final focused: **174 passed,
  9 xfailed**. Full Python: **749 passed, 13 xfailed**, 104.46s, existing
  Starlette/httpx warning. Added xfails explicitly retain baseline errors;
  no protected expectation was weakened.
- Frontend lint/typecheck and **50 tests passed**; lint rerun after screenshot
  verification changes passed. Frontend presentation/runtime unchanged.
- Contract/TypeScript drift, full-suite compatibility, repository/privacy,
  CI structure and diff whitespace passed. Hosted CI not run.
- Scoped Ruff check/format passed on the eight Python paths below. Global Ruff:
  **63 existing C3 findings only** (I001 10, F401 10, E402 17, UP015 1,
  UP035 6, UP006 15, UP045 2, F541 2). No C3/rule changes.
- Preprocessing/orchestrator rebuilt healthy. **152 complete authenticated
  responses match Python**, originals/no-store preserved; all three strategies
  have span/render and Unicode integrity. C2 smoke: **45 live catalogue runs**,
  custom execution, auth/validation, logout and log-privacy checks passed.
- Actual Edge **155.0.4283.45**: 152 Before/After, exact whitespace, transformations,
  quality/privacy/gates/counts/ordered reasons and human approval match responses.
  Sign-in, eight stages, Reset/logout, no storage and 390px Sinhala passed.
  A focused three-case rerun captured corrected role/kinship and unresolved-review
  screenshots; those and the narrow view were actually inspected. Reports:
  `.local/c2-demo-browser-0990fae7-65a6-48fd-8702-b10302023fcd/report.json`,
  `.local/c2-demo-browser-7f81caff-1498-499f-b269-952b79ccb683/report.json`.

Scoped `.venv/Scripts/ruff.exe check` and `format --check` paths:

```text
services/preprocessing/person_context.py
services/preprocessing/role_kinship_regressions.py
services/preprocessing/span_evaluation.py
services/preprocessing/anonymization.py
services/preprocessing/presidio_anonymization.py
scripts/c2_role_kinship_evaluate.py
scripts/c2_role_kinship_verify.py
tests/unit/test_c2_role_kinship.py
```

Also changed for this increment: C2 `scripts/c2_demo_browser.mjs`, this document
and `c2-demo-page.md`. Local evidence/helpers remain ignored. Working URL:
**http://localhost:3001/c2-demo**. Existing edits, checkpoint 65e4db35 and offline
studies are preserved. Nothing staged, committed or pushed.
