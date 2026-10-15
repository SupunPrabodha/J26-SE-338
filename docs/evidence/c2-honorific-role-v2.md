# C2 honorific/role and residual-privacy checkpoint

Predeclared acceptance: retain all baseline-correct entities and their masking
coverage; no added masking on ordinary role/title negatives; exact name-only
offsets for the unambiguous new contexts; no unsafe Unicode boundaries; preserve
introduced names, residence, structured identifiers, placeholders and predicate
correction. New regression fixtures are synthetic development evidence, not
independent validation. A separate frozen held-out set is evaluated once after
development acceptance. No reviewed/reserved annotation partition is retuned.

Supported grammar is deliberately bounded: case-insensitive Ms/Mr/Mrs/Dr,
optional period and horizontal space; possessive supervisor/group-leader
apposition or an explicit role label ending in a colon. Names have one to four
Unicode lexical words, terminated by punctuation or a grammatical clause
boundary. Ordinary copular descriptions and metalinguistic title instructions
are outside this grammar. Existing English grammatical tagging provides only
an abstention signal on descriptive/verb continuations, never new NER labels or
a threshold change. Unknown name-like but unbounded continuations require
privacy review; arbitrary missed names cannot be automatically ruled out.

Privacy flags and release blocking remain separate from structural data quality.
The existing quality policy can also mark privacy-review records REVIEW: that
is a policy routing decision, not semantic quality measurement. Existing shared
response fields suffice; no contract or C1 workflow change is planned.

The runtime baseline is the current working tree, including the uncommitted
Romanized-predicate correction, not a reconstruction of commit 65e4db35.
Baseline metadata: `artifacts/c2-evidence/anonymization/honorific-role-v2/baseline.json`.
Historical reports and rejected title/model studies remain unchanged.

## Implemented runtime and privacy routing

Active selector: `c2-contextual-fields-v1+c2-romanized-predicate-v1+c2-honorific-role-v2`.
Registry entry: `c2-contextual-fields-v1+c2-honorific-role-v2`, PERSON/LOCATION,
NLP language `en`. Existing spaCy NER and thresholds remain active. Rule weight
0.85 is inherited from the current contextual rules, not an accuracy probability.
Presidio 2.2.364, spaCy 3.8.16 and en_core_web_sm 3.8.0 remain unchanged. No
download, training, model search or benchmark evaluation occurred. The global
strategy default remains Regex; the demo explicitly requests Presidio.

`person_context.py` adds name-only original offsets for titles and supported
role appositions. Existing full names are retained. English grammatical tagging
rejects descriptive first tokens and bounds following clauses. At a verified
new field boundary, a wholly descriptive NER suffix is trimmed; unknown/nominal
or proper-name tails veto that trim, preserving neighbouring entity coverage.
Consumed title/role wording before a masking placeholder is protected during
Hybrid's second pass. Structured recognizers, ID precedence and existing
placeholders are preserved. These shared proposals feed runtime, counts,
transformations and original-offset evaluation rather than a dashboard-only fix.

The shared contextual rules now use the existing English grammatical engine
as an abstention aid when these new contexts occur, including with Regex. This
does not switch strategies or introduce a new model; it does mean the new rules
depend on the installed locked English package. It is not language identification.
Sinhala combining marks/joiners, punctuation and emoji are unchanged.

Supported role grammar is `my/our/ape supervisor`, `my/our/ape group leader`,
or the explicit labels `Supervisor:` / `Group leader:`. It does not implement
arbitrary job titles, arbitrary copular descriptions or arbitrary name discovery.
Periods are optional on Ms/Mr/Mrs/Dr, casing is independent of name casing, and
horizontal whitespace is required. Missing separation, newlines, metalinguistic
uses and semantic ambiguity remain restricted or unresolved; no name dictionary
or global PERSON suppression is used.

Residual review is separate from masking. Supported name fields surviving
masking, malformed/unbounded fields and lexical text remaining after a placeholder
can trigger `requires_privacy_review`. Broader possessive Romanized naming
statements (`mage/mge`, up to two intervening lexical words, `nama`) are
**review-only**, not guessed entity boundaries. Copular role statements with a
name-like nominal continuation are also review-only; ordinary tagged descriptions
such as “our supervisor is helpful” are not automatically quarantined.

The pipeline forwards the existing boolean flag into the privacy gate. The gate
validates its type, blocks flagged records, and independently checks supported
residual structured PII and name-context signals. Existing quality-policy routing
already turns privacy flags into REVIEW; its rules and thresholds were not rebuilt.
Quarantine here means release-blocking flags only: no text storage, database writes
or C1 review-task creation. Shared request/response shapes are unchanged; existing
boolean and dynamic issue/count fields suffice, so no new shared-contract change
or service-local copy requires affected-member review for this increment.

## Actual reproduced and corrected outputs

The reported input initially produced **no analyzer candidates and no selected
spans**, unchanged output, quality PASS, `requires_privacy_review=false`, privacy
PASSED and `release_ready=true`. Quality did not validate detection correctness.
The old offline title candidate remains rejected; this is a different bounded
contextual implementation, not registration of that rejected recognizer.

```text
Input / previous output:
ape supervisor MS. Aprna . Ape group leader supun

Current output:
ape supervisor MS. [PERSON] . Ape group leader [PERSON]

Protected input:
mage nama neluni mt exam gna byi
Previous and current output:
mage nama [PERSON] mt exam gna byi

Protected input/output:
Mata exams gana dukai.

Protected input:
Mage nama Nimal Perera. Mata exams gana dukai.
Current output:
Mage nama [PERSON]. Mata exams gana dukai.

Unresolved input / output:
Our supervisor avira123.
```

The reported case now selects PERSON `[19,24)` and `[44,49)` at rule weight 0.85.
Actual transformation: `presidio:person`. Quality remains PASS; no automated
privacy-review signal is flagged; privacy gate PASSED and automated prerequisites
pass. **Human release is still required**, not granted by this result.

The unresolved malformed role field remains unmasked, quality REVIEW,
`requires_privacy_review=true`, privacy FAILED, `release_ready=false`. Ordered
reasons: `data_quality_review_required`, `privacy_review_required`,
`release_privacy_gate_failed`. Ordinary role descriptions remain unchanged.

The Senali/Supun diagnostic is not a successful name-detection fix:

```text
Mge nngige nama senali eyt ghuwa kiyl mt supun bnna
→ Mge nngige nama senali eyt ghuwa [PERSON] bnna
```

Existing spaCy masks a broader phrase containing Supun but still exposes Senali;
that output is preserved. The unresolved possessive naming signal now routes it
to REVIEW/privacy review and blocks release. Untitled `mt supun banna nisa duki`
still misses Supun and can have PASS/no review signal/automated prerequisites
passed: this is an explicit limitation of bounded signals, not evidence of safety.
Previously verified English/Sinhala introductions, Sinhala residence, structured
contacts, placeholders and genuine names near predicate words remain protected
by the regression suite and actual Docker/browser execution.

## Development, held-out and remaining failures

Development combines **31 new fictional regressions** with **110 reused cases**:
70 previous coverage/context diagnostics and 40 author-self-reviewed development
records. The latter are guided AI-assisted user self-review, not independent
annotation or inter-annotator agreement. No annotation reserved inference occurred;
its file hash remains `9c300d16741afb0a97f982d8046700485bddd560ee0c548135f7dca2aa2d4794`.

Fourteen new held-out fixtures with distinct name pools were frozen before
development inference, then first evaluated after development acceptance. Later
rechecks after implementation/parity and baseline-measurement corrections are
**reused evidence**, not another untouched final test. Nothing was tuned to their
outcomes; the fixtures/gold are retained. Baseline replay disables only this
increment's parsing/review and restores legacy flag routing while leaving the
current-tree predicate correction and installed NER intact.

| Measurement | Development before | Development after | Held before | Held after |
|---|---:|---:|---:|---:|
| Exact typed/span true positives | 106 | 117 | 6 | 12 |
| Exact typed/span misses | 42 | 31 | 7 | 1 |
| Fully exposed gold entities | 29 | 21 | 6 | 0 |
| Unmasked gold characters | 295 | 243 | 48 | 0 |
| Unnecessary masking characters | 244 | 230 | 3 | 1 |

All predeclared development checks passed. No baseline-correct gold entity or
gold-character coverage was lost; no additional masking on the declared ordinary
negatives; no unsafe Unicode boundaries or trace/render disagreements. This is
finite synthetic engineering evidence, not established multilingual support.

Remaining held failure `held-contacts-mixed` is **pre-existing**: phone `[51,61)`
is selected as PERSON `[51,62)`, including one extra space. All phone characters
are masked, but the entity type/transformation label is wrong. Baseline has the
same error; this increment does not claim to fix it or every PERSON/PHONE overlap.
The previously verified structured cases still pass. Two malformed-title negative
expectations (`Mrship avira`, `Ms.` followed by a newline/name-like token) retain
strict xfails: NER already masks the token. Those proposed negative labels can be
semantically ambiguous and require adjudication; the raw metrics retain their
current expectations rather than changing gold after inference. Unknown role
descriptions/compounds and unmodelled script semantics can still be ambiguous.
Nominal grammatical tags do not prove personhood. Arbitrary names/locations and
indirect identifiers still require human review; no universal “privacy safe” status
is asserted.

Evidence folder: `artifacts/c2-evidence/anonymization/honorific-role-v2/` (Git-ignored).
Authoritative final comparison: `final-verified-baseline/report.json`; aggregate
readable report `aggregate.md`; source/package/fixture provenance `manifest.json`.
Earlier intermediate reports are retained, including the rejected boundary
candidate. The first fixture-construction attempt failed before inference because
the unique-span helper found a repeated name inside its email; the email was
made distinct before evaluation. Earlier detection comparisons were correct but
did not fully replay old privacy routing; the final comparison does so explicitly.
Historical reports, rejected-model decisions and annotation data remain unchanged.

## Exact checks and reproduction

Run from the repository root, using a new output directory to preserve evidence:

```powershell
.venv/Scripts/python.exe scripts/run.py scripts.c2_person_context_evaluate --output-dir artifacts/c2-evidence/anonymization/honorific-role-v2/reproduction
.venv/Scripts/python.exe scripts/run.py pytest tests/unit/test_c2_person_context.py tests/unit/test_c2_contextual_detection.py tests/unit/test_c2_student_id_selection.py tests/unit/test_c2_romanized_predicate.py -q -o addopts= --tb=short
.venv/Scripts/python.exe scripts/run.py pytest -q -o addopts= --basetemp=.local/pytest-role-final-snapshot --tb=short
npm run lint
npm run typecheck
npm test -- --reporter=dot
.venv/Scripts/python.exe scripts/run.py scripts.generate_contracts --check
npm run contracts:check
.venv/Scripts/python.exe -X utf8 scripts/check_repository.py
.venv/Scripts/python.exe scripts/check_ci.py
git diff --check
docker compose up -d --build --wait --no-deps preprocessing orchestrator counsellor-dashboard
.venv/Scripts/python.exe scripts/run.py scripts.c2_person_context_verify --output-dir artifacts/c2-evidence/anonymization/honorific-role-v2/parity-final --browser-inputs .local/c2-role-final-browser-inputs.json
.venv/Scripts/python.exe scripts/run.py scripts.c2_demo_smoke
node scripts/c2_demo_browser.mjs .local/c2-role-final-browser-inputs.json
```

Actual outcomes:

- Protected pre-edit suite: **72 passed**. Final focused suite: **124 passed,
  2 xfailed**; existing Starlette/httpx and sandbox pytest-cache warnings.
- Final full Python: **699 passed, 6 xfailed**, one existing Starlette/httpx warning.
  Final-snapshot run after the reporting correction completed in **96.30 seconds**.
  Initial sandbox temporary-fixture access failed and was interrupted; authorized
  reruns completed. First full run had two obsolete expectations (title masking
  and flagged privacy sub-gate); intentional updates are documented below. A new
  diagnostic test initially assumed Senali/Supun had no masks; it was corrected
  to compare against actual baseline inference, not to invent successful output.
- Frontend lint/typecheck: passed; **50 frontend tests passed**. Initial sandbox
  Vitest `spawn EPERM` was resolved by authorized child-process execution.
- Contract drift, TypeScript drift, contract compatibility in the full suite,
  repository/privacy, CI structure and diff whitespace checks: passed. Hosted CI
  was not rerun.
- Scoped `ruff check` and `ruff format --check` over the 15 Python paths below:
  passed. Global `.venv/Scripts/python.exe -m ruff check . --output-format json`
  still fails with **63 existing C3 findings only**: I001 10, F401 10, E402 17,
  UP015 1, UP035 6, UP006 15, UP045 2, F541 2. No C3 file or lint/CI rule changed.
- Docker rebuild: preprocessing, orchestrator and counsellor-dashboard built and
  healthy. Default parity `parity-final/report.json`: **117 complete responses
  equal Python**, original text preserved, no-store, no unsafe boundaries and
  masking/span agreement across all three strategies. An ignored helper ran
  `.venv/Scripts/python.exe .local/c2-role-held-parity.py --output-dir artifacts/c2-evidence/anonymization/honorific-role-v2/parity-held-diagnostic --browser-inputs .local/c2-role-held-browser-inputs.json`:
  **14 additional already inspected fixtures match**, including the phone-label
  failure. Its initial local import-root error was corrected before execution.
  The reporting helper initially labelled zero-denominator slices “verified
  working”; this reporting defect is corrected to **not evaluated**, without
  changing fixtures, masking, scores or runtime. The same 14-case parity recheck
  is saved separately as `parity-held-final/report.json`. Earlier reports retain
  their original metadata and must not be read as support for untested slices.
- C2 smoke: **45 authenticated live catalogue executions**, strict-input,
  custom-execution, logout and log-privacy checks passed.
- Actual Edge **155.0.4283.45** browser checks: **117 + 14 inputs** rendered actual
  Before/After, transformations, quality/privacy/gates/counts and ordered reasons.
  Sign-in, no stored credentials/text, eight stages, Reset/logout and 390px Sinhala
  rendering passed. Desktop correction/quarantine and narrow screenshots were
  actually viewed. Reports: `.local/c2-demo-browser-eeff73c9-cc2e-4bb7-bbcf-429d681fa774/`
  and `.local/c2-demo-browser-ece99b31-cd7e-4860-adab-220a70aba8ed/`.

Scoped Ruff commands use the following 15 Python paths with either `ruff check`
or `ruff format --check`:

```text
services/preprocessing/person_context.py
services/preprocessing/person_context_regressions.py
services/preprocessing/contextual_detection.py
services/preprocessing/anonymization.py
services/preprocessing/presidio_anonymization.py
services/preprocessing/span_evaluation.py
services/preprocessing/privacy_gate.py
services/preprocessing/pipeline.py
services/preprocessing/quality_fixtures.py
scripts/c2_person_context_evaluate.py
scripts/c2_person_context_verify.py
scripts/c2_pii_coverage_verify.py
tests/unit/test_c2_person_context.py
tests/unit/test_c2_titled_person.py
tests/unit/test_c2_anonymization.py
```

Other changed files for this increment: C2 `app/c2-demo/page.tsx`,
`tests/frontend/c2-demo.test.tsx`, actual-response fixture
`tests/fixtures/synthetic/c2-role-review.json`, C2 browser verification
`scripts/c2_demo_browser.mjs`, this document and `c2-demo-page.md`.
The two intentional expectation updates preserve the title in `Dr. Silva` and
make the existing pipeline-privacy fixture expect privacy-gate failure. Historical
title rejection remains testable through baseline replay and is not rewritten.
All earlier uncommitted backend/demo/adaptation work is preserved. Branch and
checkpoint 65e4db35 remain unchanged; no staging, commit, push, reset, stash or
other-member component changes occurred.

Working URL: **http://localhost:3001/c2-demo**. Use the current custom text flow
and private local development login. Authentication/development guards, quality
policy and final human-release ownership remain intact.
