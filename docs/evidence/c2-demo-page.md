# C2 PP1 Pipeline Demo — checkpoint 1

## Current relationship investigation continuation — 2026-10-14

Live URL: **http://localhost:3001/c2-demo**; existing private development sign-in.
The earlier LOCATION casing fix remains active. Explicit `eyge nama aruni` now
produces `eyge nama [PERSON]`, preserving the pronoun and typing the declared name
as PERSON. Selector uses contextual-fields-v1.1 plus relationship-review-v1.

The reported `ape grp leader supun. eyge girlfriend Neluni . ey hrim npurui`
**still labels Neluni LOCATION**; lowercase still exposes the name/masks `eyge`.
The broader masking candidate was rejected. These cases now display REVIEW,
privacy review required, privacy FAILED and automated gate Blocked. Do not present
this as successful relationship-name detection. See [joint evidence and exact
remaining failures](c2-location-case-v1.md).

Joint evaluation found no loss of protected correct detections or added negative
masking. Full Python 807 passed/22 expected failures; frontend 50 tests passed on
isolated rerun (two default-timeout failures in the preceding concurrent run are
documented). Actual Python/Docker/Edge outputs and gates verified for 44 fixtures.
General multilingual PERSON/LOCATION detection remains inadequate; more isolated
example rules are not an adequate substitute for adjudicated domain data.

## Current bounded LOCATION casing correction — 2026-10-14

**Live URL: http://localhost:3001/c2-demo.** Existing private development sign-in
and custom fictional-text flow are unchanged. `It is in malabe`, `It is in Malabe`
and `It is in MALABE` now all render `It is in [LOCATION]`, retaining original
offsets/casing outside the entity. Actual Python/Docker/browser execution verified.
Current selector adds `c2-location-case-v1` to the contextual/predicate/role v3
configuration; Presidio remains explicitly selected and global Regex is unchanged.

See [bounded casing evidence](c2-location-case-v1.md): 21/42 new location cases
exact, 22 lowercase ordinary phrases unchanged, no lost protected detections.
Many locations/casings remain missed or mistyped; this is not arbitrary geography
or complete-address support. Quality PASS still does not certify privacy.
Full Python 794 passed/13 existing xfailed; focused 219 passed/9 existing xfailed,
scoped Ruff, contract drift and 64-response Docker/browser parity passed.
Earlier checkpoint sections are retained historical snapshots.

## Current role/kinship correction v3 — 2026-10-14

**Live URL: http://localhost:3001/c2-demo.** Use the existing private local
development counsellor sign-in directly on the page. Keep development configuration
and internal service authentication enabled as documented below; fictional tests
require no student, consent, review-task or LMS flow.

Selector: `c2-contextual-fields-v1+c2-romanized-predicate-v1+c2-role-kinship-v3`;
the page still explicitly executes Presidio. See [v3 evidence](c2-role-kinship-v3.md)
for bounded grammar, actual failures and exact checks.

PP1 walkthrough: select Romanized Sinhala (manual metadata), enter
`ape supervisior ms aparna. ape grp leader supun`, and Run. Actual output:
`ape supervisior ms [PERSON]. ape grp leader [PERSON]`. Reset and run
`mge nngi senali`: output `mge nngi [PERSON]`. Both have PASS and automated
prerequisites passed; human release approval remains required. To show blocking,
run `mge nngi avira123.`: unchanged output, REVIEW, privacy review required,
privacy FAILED, automated gate Blocked. Use fictional text only; nothing is saved.

Python/rebuilt Docker match for 152 responses; actual Edge Before/After, whitespace,
gate rendering, sign-in and 390px Sinhala passed. Full Python: 749 passed/13 known
xfailed. Frontend lint/typecheck/50 tests, contract drift/compatibility, repository,
CI structure and scoped Ruff passed. Global Ruff retains 63 unrelated C3 failures.
Ordinary-text false masks, unresolved names, the existing phone-label error and
bounded predicate limitations remain documented. This is not complete multilingual
anonymization. Earlier sections below are retained historical checkpoint snapshots.

## Current honorific/role and privacy-gate checkpoint — 2026-10-14

**Live URL: http://localhost:3001/c2-demo.** The affected Docker services and
dashboard have been rebuilt and verified. Sign in directly with the existing
private local development counsellor account; credentials remain in local `.env`
and are never included here. No student submission, consent, review task or LMS
flow is needed. Select a manual language hint, enter fictional text, and Run.

Current selector: `c2-contextual-fields-v1+c2-romanized-predicate-v1+c2-honorific-role-v2`.
The page still executes Presidio, not Hybrid or an experimental model. See
[the implemented correction and exact checks](c2-honorific-role-v2.md).
`ape supervisor MS. Aprna . Ape group leader supun` now becomes
`ape supervisor MS. [PERSON] . Ape group leader [PERSON]`.
The protected Neluni/exam statement and ordinary `gana dukai` output remain correct.

To demonstrate privacy blocking, run `Our supervisor avira123.`: the text remains
unchanged, but the backend returns REVIEW, privacy review required, privacy gate
FAILED, and automated release Blocked. This is release-blocking metadata, not a
persisted quarantine or a fabricated successful mask. Per-record privacy status
and the quality-policy/privacy gates are visible separately. Human approval is
required even when automated checks pass. Reset clears and invalidates results.

Actual checks: **699 Python tests passed, 6 explicit xfails; 50 frontend tests
passed; 131 complete Python/Docker responses matched; actual Edge desktop/390px
rendering passed.** Scoped Ruff, contracts, repository and CI-structure checks pass.
Global Ruff still reports 63 existing C3 findings. Untitled-name misses, ambiguous
role/title uses and a pre-existing mixed-context phone label error remain; this
is not complete multilingual anonymization or independent research validation.

Earlier checkpoint notes below retain their historical results/configurations.

Latest targeted correction: [Romanized predicate selection v1](c2-romanized-predicate-v1.md).
The two reported `gana dukai` false masks are corrected, while introduced names and
structured details remain masked. This is a bounded correction with documented
abstentions and remaining failures; previous evidence below retains its historical
results. Current selector: c2-contextual-fields-v1+c2-romanized-predicate-v1.

Contextual runtime: [shared contextual fields v1](c2-contextual-runtime-v1.md), now
registered within Presidio and shared with Regex. Explicit introductions support
full names and `mge nama`; bounded residence/address fields are implemented.
Bare Sinhala self statements are no longer automatically names. Detector misses
and false masking remain; the new evidence records both improvements and losses.

Previous coverage audit: [all supported C2 PII types](c2-pii-coverage-v1.md), including
location/address distinctions, additional-ID restrictions and actual four-language
results before the contextual correction; known detector failures remain visible.

Latest runtime correction: [valid student-ID selection v1](c2-student-id-selection-v1.md).
The three historical contact failures below now select STUDENT_ID while retaining
all previously masked PERSON-region coverage. Local Python, Docker and dashboard
results match. Models, thresholds and global Regex default are unchanged; historical
reports retain their original figures. Other Sinhala/Romanized detection limitations
remain unresolved, including falsely masked residual context around these IDs.

## Current dashboard verification checkpoint — 2026-10-13

**Working URL: http://localhost:3001/c2-demo.** Sign in directly using the private
local development counsellor credentials; no student submission, consent, review
task or LMS flow is required. Local Docker Desktop and the nine-service Compose
stack are running/healthy. Only the dashboard was rebuilt for the explicit
limitation notice; no model, strategy default, authentication or pipeline rule changed.

Executed configuration in both local Python and Docker: **Presidio 2.2.364,
spaCy 3.8.16, en_core_web_sm 3.8.0, NLP language `en`**. The page explicitly sends
`strategy: presidio` to the authenticated custom-run endpoint. Language selection
is manual metadata and does not route recognizers. Global Regex default is intact.
GLiNER and the failed trained spaCy pilot remain offline; no new training, model
search, calibration, benchmark or annotation pack was performed.

Sixteen identical synthetic inputs were executed locally with `execute_custom`
and through authenticated `POST /api/v1/c2-demo/custom-runs` on Docker/dashboard.
**All 16 full response objects match**, including original/anonymized text,
transformations, quality/privacy summaries, release gate and blocking reasons.
Responses have no-store and preserve original text/Unicode. Docker package versions
were inspected directly and match local versions.

Verified working cases: fictional email, Sri Lankan phone, isolated student ID,
one contextual student-ID example, English full name, English reviewed contact
example, punctuation/emoji/newlines with email, short meaningful content (REVIEW,
automated gate Blocked) and empty content (REJECT, Blocked). Actual successful
masking and English Before/After were observed in the browser, not substituted
expected results.

Unresolved detection failures, identical locally and in Docker:
- Ordinary Romanized wellbeing still falsely masks a PERSON span.
- Informal Supun is missed; the Senali/Supun sentence misses Senali and masks
  extra context beside Supun rather than producing correct full spans.
- The Sinhala fictional name case masks the wrong segment.
- Three existing reviewed contact cases (Sinhala/Romanized/code-mixed) mask
  student IDs as PERSON instead of STUDENT_ID. Email and phone spans remain
  correct. This existing typed-span/overlap-selection limitation was already
  recorded in the trained-pilot report; it is not a new Docker/runtime regression.

The detector and selection source matches committed HEAD. No proven implementation
or configuration regression was found, so detection was not changed. Fixing known
NER/overlap behavior would require a separate explicitly evaluated change; this
checkpoint does not claim correction. Quality PASS and automated gate success can
accompany detection mistakes because policy checks are distinct from semantic NER
correctness. The page explicitly warns about Sinhala/Romanized misses/false masks,
Quality PASS limits and separate human release approval.

Actual checks:

```powershell
docker compose up -d --wait
.venv/Scripts/python.exe scripts/run.py scripts.c2_dashboard_verify --output artifacts/c2-evidence/anonymization/dashboard-verification-v1/parity-before.json
docker compose up -d --build --wait --no-deps counsellor-dashboard
node scripts/c2_demo_browser.mjs
npm run lint
npm run typecheck
npm test -- tests/frontend/c2-demo.test.tsx
.venv/Scripts/python.exe scripts/run.py pytest tests/integration/test_c2_demo.py tests/unit/test_c2_presidio_anonymization.py tests/unit/test_c2_span_evaluation.py -q -o addopts= --basetemp=.local/pytest-dashboard-verification
.venv/Scripts/python.exe -m ruff check scripts/c2_dashboard_verify.py
.venv/Scripts/python.exe -X utf8 scripts/check_repository.py
.venv/Scripts/python.exe scripts/run.py scripts.generate_contracts --check
npm run contracts:check
git diff --check
```

Frontend **32 passed**, Python **80 passed** (existing Starlette/httpx warning).
Lint, both frontend typechecks, scoped Ruff, repository/privacy, contract drift and
whitespace checks passed. Dashboard Docker build and health passed. Browser
Edge 155.0.4283.45: direct sign-in, 16 real custom runs, exact Before/After and
transformations, batch counts, ordered blocking reasons, human-release notice,
eight stages, Reset/logout, empty browser storage and narrow viewport all passed.
Desktop English-name and 390px Sinhala screenshots were visually inspected;
no horizontal overflow or credential screenshots. Browser evidence is under
`.local/c2-demo-browser-8e926ac3-9067-42cc-97f8-e981fc85c522/`.

Aggregate parity evidence is separately versioned under
`artifacts/c2-evidence/anonymization/dashboard-verification-v1/`. Its JSON stores
safe case IDs, result metadata and masked-output hashes; no input/detected values
or credentials. The browser verifier uses existing fictional inputs from the
ignored `.local/c2-dashboard-browser-inputs.json` fixture file and observes real
responses transiently; it does not inject responses or mask text in the frontend.
Earlier sections retain historical checkpoint details. All edits remain uncommitted
on `feature/c2-anonymization-pipeline`; other members' code and historical reports
were preserved. Full repository pytest/Ruff were not rerun; known unrelated C3
lint findings remain unchanged.

## Latest page simplification — custom input only

The current `/c2-demo` page shows one fictional-text input, a manual language hint,
and a short illustrative example for that hint. Examples never insert or replace
typed text. Language edits invalidate results and in-flight requests without
changing input. Run uses only `/api/v1/c2-demo/custom-runs` with Presidio; Reset
clears text/results. Existing server-owned fixtures and scenario endpoints remain
available for backend tests. All eight stages remain visible. Earlier walkthroughs
with Sample/Custom buttons below describe the preceding version.

Two additional Romanized diagnostics were executed locally, without runtime changes:
`mt supun banna nisa duki` has manual PERSON gold `[3,8)` but returns no PERSON;
`Mage nama Nimal Perera. Mata exams gana dukai.` has gold `[10,22)` but returns
`[10,22)` and false `[35,45)`, so the wellbeing phrase is not preserved.
These are strict expected-failure tests in
`tests/unit/test_c2_demo_romanized_diagnostics.py`. Separate offset-only evidence:
`artifacts/c2-evidence/anonymization/custom-flow-diagnostics-v1/results.json`.
Neither failure is fixed. The earlier multilingual candidate investigation and
historical reports remain unchanged; GLiNER is not active.

Verification for this simplification: `npm run lint` and `npm run typecheck`
passed; `npm test -- tests/frontend/c2-demo.test.tsx` passed **31 tests**,
including example-only language changes, preservation of typed text, duplicate
clicks, session handling, safe errors and stale-result invalidation.
`python scripts/run.py pytest tests/unit/test_c2_demo_romanized_diagnostics.py -r x`
returned **2 passed, 2 strict expected failures**. Scoped Ruff and
`git diff --check` passed. Browser inspection was not repeated for this layout;
earlier browser results below apply to the previous page version.
`docker compose up -d --build --wait counsellor-dashboard` also passed;
the rebuilt dashboard and its local dependencies are healthy at the same URL.

## Current additive sample/custom checkpoint — 2026-10-13

Demo URL: **http://localhost:3001/c2-demo**. Earlier checkpoint sections below
describe their historical scope; the current page additionally accepts ephemeral
fictional custom tests. Stay in the local development configuration
(`ENVIRONMENT=development`); private development counsellor credentials remain
in the local `.env` and must never be published. Sign in directly on `/c2-demo`.
No student submission, consent, review task or LMS integration is required.

PP1 walkthrough:
1. Sign in using the private development counsellor account.
2. Select **Sample**, then an ordinary wellbeing or fictional PERSON-positive
   sample; run and compare actual before/after output, transformations and quality.
3. Select **Custom synthetic test**, choose a manual language hint, and enter
   fictional text only (maximum 1,000 Unicode characters server-side).
   Run the actual pipeline. Empty input intentionally returns the real REJECT
   quality result. The hint does not select recognizers or calculate language ID.
4. Inspect batch counts/blocking reasons separately from human release approval.
   Reset clears custom text and results and invalidates in-flight responses.

The additive browser route is `POST /api/v1/c2-demo/custom-runs`, forwarded with
internal service authentication to `POST /internal/v1/c2-demo/custom-runs`.
Request: `{ "text": "fictional text", "language_hint": "unsure", "strategy": "presidio" }`.
Allowed hints: `sinhala`, `english`, `romanized-si`, `code-mixed`, `unsure`.
Strategy is strictly `presidio`; extra fields, wrong types, unknown hints and
overlength strings receive safe validation errors without echoed input values.
Existing catalogue and scenario execution routes continue working; their global
Regex default is unchanged. Responses use separate generated shared custom
contracts and contain actual records, quality/privacy summaries and blocking
reasons. Runs have no database writes, browser storage, analytics, text logs or
hosted inference. Both service boundaries retain development guards and existing
authorization. Responses remain `Cache-Control: no-store`.

The active runtime is **Presidio with English spaCy NER**, provisionally selected
for this demo. GLiNER multilingual candidate v1 was evaluated and rejected;
see [the candidate investigation](c2-multilingual-candidate-v1.md). It is not
silently promoted, combined with English NER, or used as a fallback.

Fifteen server-owned scenarios now include four manually labelled fictional name
examples and ordinary wellbeing samples. Expected PERSON offsets are specified
in `tests/unit/test_c2_demo_person_samples.py`; responses never use those labels
to manufacture results. New actual evidence is separately versioned at
`artifacts/c2-evidence/anonymization/demo-samples-v1/results.json` (local ignored
artifacts), reproducible with `python scripts/run.py scripts.c2_demo_sample_evaluation`
into a fresh absent destination. The evaluator refuses to overwrite evidence.
Five of eight cases match exact PERSON gold. Sinhala-positive masks `[0,12)`
instead of `[7,19)`; Romanized-positive finds the correct `[10,22)` name plus an
unnecessary `[35,45)` span; ordinary Romanized still falsely masks `[11,21)`.
All eight return quality PASS: policy usability checks do not establish detection
correctness. These three failures are strict expected-failure regressions.
Historical benchmark and adaptation evidence remains unchanged. No benchmark or
experimental model evaluation was rerun for this checkpoint.

All eight stage cards remain visible. Anonymization and Data Quality are implemented
with limitations; Data Collection, Language ID, Normalization, Tokenization,
Annotation and Final Dataset Release remain Pending. Synthetic fixture entry is
not implementation of participant collection. Custom input has no gold labels and
no accuracy percentage.

Actual checks for this checkpoint:
- `python scripts/run.py pytest tests/integration/test_c2_demo.py tests/unit/test_c2_demo_person_samples.py tests/unit/test_c2_multilingual_candidate.py -r x -q --basetemp=.local/pytest-c2-custom-final`:
  79 passed, 3 strict expected failures described above. Includes actual execution,
  all hints, bounded/strict input, authentication, role/development/internal token
  restrictions, no persistence and legacy contract compatibility.
- `npm test -- tests/frontend/c2-demo.test.tsx`: 29 passed, including custom
  rendering/request payload, reset and edited-input stale response protection.
- `npm run lint`, `npm run typecheck`: passed (both frontend workspaces typecheck).
  An initial C2 union narrowing error was corrected; final checks pass.
- `python scripts/run.py scripts.generate_contracts --check`,
  `npm run contracts:check`: passed. JSON Schema, OpenAPI and TypeScript regenerated together.
- `python scripts/run.py scripts.check_repository`,
  `python scripts/run.py scripts.check_ci`, `git diff --check`: passed.
- Scoped `ruff check` on modified C2 Python/demo contract/generator/test files:
  passed after formatting. Repository-wide Ruff/full Python tests were not rerun;
  previously reported unrelated C3 E402 failures have not been changed or hidden.
- `docker compose up -d --build --wait preprocessing orchestrator counsellor-dashboard`:
  build and selected service health checks passed.
- `python scripts/c2_demo_smoke.py`: authenticated real Docker catalogue and
  45 scenario runs passed; additionally 10 custom runs (five hints × PASS/REJECT),
  safe extra-field validation, no-store, logout and log-privacy checks passed.
- `node scripts/c2_demo_browser.mjs`: passed in local Edge 155.0.4283.45, direct C2
  sign-in, catalogue, actual sample/custom runs, REVIEW/REJECT/empty blocking,
  Reset/logout, browser storage checks and 390px viewport without overflow.
  Narrow custom screenshot was visually inspected. Initial custom browser probe
  failed because the automation helper used an input setter for textarea; the
  helper was corrected and rerun successfully. No credentials were captured.

Remaining blocker: multilingual PERSON correctness is unresolved. Continued
candidate investigation must use new versioned evidence and meet the documented
criteria before explicit runtime adoption. Synthetic diagnostics are not
independent research validation. Changes remain uncommitted.

Latest anonymizer investigation: [development investigation 1](c2-presidio-development-1.md).
The observed Romanized Sinhala false mask is **reproduced, not fixed**. Presidio
remains a provisional demo selection despite the shortened UI label “Anonymizer:
Presidio”. Quality PASS is policy evidence, not anonymization correctness. The new
development evaluation is separate from all historical held-out results.

**Current PP1 entry point: http://localhost:3001/c2-demo.** Sign in directly on
this page with your private development counsellor account. No student submission,
consent form, review task or LMS flow is required for its server-owned fictional
samples. The self-contained PP1 walkthrough and latest verification are below;
earlier checkpoint sections retain their historical implementation details.

Implemented locally on 2026-10-12 on `feature/c2-anonymization-pipeline`,
starting from `aee9393` (quality milestone `31ea3d6`). Changes remain uncommitted.

## Completed backend and contracts

Separate `C2Demo*` shared contracts originate in
`packages/contracts/src/research_contracts/__init__.py`. JSON Schema, both affected
OpenAPI documents and TypeScript declarations are generated together. The input
contract intentionally contains only selectors, with strict types and forbidden
extra fields; response contracts carry synthetic/development-only flags.
The generator now writes deterministic UTF-8 LF bytes to avoid Windows newline
churn in existing artifacts.

| Boundary | Method and route | Input / output |
| --- | --- | --- |
| C1 browser gateway | GET `/api/v1/c2-demo/scenarios` | No body; `C2DemoCatalogue` |
| C1 browser gateway | POST `/api/v1/c2-demo/runs` | `C2DemoRequest`; `C2DemoResponse` |
| C2 service | GET `/internal/v1/c2-demo/scenarios` | No body; same catalogue |
| C2 service | POST `/internal/v1/c2-demo/runs` | Same selectors; same response |

Minimal execution request: `{"scenario_id":"english","strategy":"regex"}`.
Omitting strategy selects Regex. Allowed strategies are `regex`, `presidio`,
and `hybrid`. No text, uploads, records, credentials or contract flags are accepted
in execution bodies. Unknown IDs, strategies and extra fields produce the existing
safe `CONTRACT_INVALID` 422 envelope, without echoing input or validation details.

```mermaid
sequenceDiagram
    participant Browser
    participant C1 as C1 orchestrator
    participant C2 as C2 preprocessing
    Browser->>C1: Catalogue or scenario/strategy selectors
    C1->>C1: Development guard + C1 counsellor session authorization
    C1->>C2: Selectors + internal preprocessing service token
    C2->>C2: Development guard + service authentication
    C2->>C2: Resolve fictional fixtures; run existing pipeline
    C2-->>C1: Actual synthetic records and gate summaries
    C1->>C1: Validate shared response and selector correspondence
    C1-->>Browser: Shared demo response; no-store
```

C1 uses its existing current-session, revocation, expiry, role and CSRF checks.
Only `COUNSELLOR` sessions are authorized; student, admin and researcher roles
are denied. Internal calls use existing audience-specific service JWT/Redis
authorization and correlation propagation. Credentials stay on the server.
The gateway uses the configured service timeout, does not follow redirects, and
returns safe errors for downstream timeout, failure, malformed or mismatched output.

Both boundaries reject non-development configuration. Existing settings also
reject non-development startup; route guards are independently tested. The
feature is available in development without a new enablement flag. Existing
middleware provides `Cache-Control: no-store`, safe error envelopes, and allowlisted
metadata logging. Runs introduce no database writes, jobs, cases, audits or files.
Authentication retains its existing session and audit behavior; internal tokens
retain their existing short-lived Redis registration.

## Server-owned scenarios and real execution

All scenario text lives in `services/preprocessing/demo.py`, exclusively inside
the preprocessing boundary. The catalogue returns metadata and counts, not text.
Execution returns original fictional text alongside actual anonymized output,
transformations, quality statuses/issues, privacy-review flags, batch quality and
privacy summaries, and release blocking reasons.

IDs: `english`, `sinhala`, `romanized`, `code-mixed`, `short`, `empty`,
`placeholder-only`, `duplicate`, `masking-collision`, `empty-batch`.
Language labels are fixture metadata; no language identification is performed.
Contacts use fictional addresses under reserved `example.com`; no messages are sent.

Each execution calls `run_preprocessing_pipeline` with the selected strategy and
the existing validated `DEFAULT_QUALITY_POLICY`. There are no duplicated quality
rules or fabricated results. `release_ready` means automated prerequisites only;
human release approval remains required. REVIEW, REJECT and empty batches block
release. These are development-policy regressions, with no independent research
validation or zero-risk claim. Presidio retains its existing English NLP engine;
multilingual fixture labels do not imply multilingual model validation.

The original `/internal/v1/preprocess` mock route, preprocessing contracts and
consent/review workflows remain intact. Compatibility tests compare all pre-existing
JSON schemas, OpenAPI routes and component schemas against HEAD. No migrations
are needed because this checkpoint adds no persistent schema.

## Verification

Final successful commands (PowerShell, repository root):

```powershell
.venv\Scripts\python.exe -m pytest tests/integration/test_c2_demo.py tests/contract/test_contracts.py tests/security/test_auth.py tests/integration/test_workflow.py tests/integration/test_consent_lifecycle.py --basetemp=artifacts/c2-demo-tests-4 -p no:cacheprovider --tb=short
.venv\Scripts\python.exe scripts/run.py scripts.generate_contracts --check
npm run contracts:check
.venv\Scripts\python.exe -m ruff check services packages scripts tests
.venv\Scripts\python.exe -m ruff format --check services/orchestrator/demo.py services/orchestrator/main.py services/preprocessing/demo.py services/preprocessing/main.py packages/contracts/src/research_contracts/__init__.py scripts/generate_contracts.py tests/integration/test_c2_demo.py
npm run typecheck
git diff --check
```

- Combined pytest: **101 passed**, one existing Starlette/httpx deprecation warning.
  Includes 41 demo tests, real execution using all three strategies, blocking checks
  using all three strategies, catalogue/defaults, strict input, safe errors, C1 role
  and session/CSRF checks, internal audience authentication, development guards,
  no persistence, existing schema/OpenAPI compatibility and workflow regressions.
  HTTP integration uses in-process service transport and disposable SQLite/Redis
  fixtures; this does not establish container/network deployment readiness.
- JSON Schema/OpenAPI drift and TypeScript drift: passed.
- Platform Ruff lint and changed-Python formatting: passed.
- Both application TypeScript checks: passed.
- Whitespace diff check: passed.

Initial pytest runs failed at fixture setup due to Windows temporary-file access.
The successful run used elevated execution with disposable storage under ignored
`artifacts/`. Subsequent fixture failures were corrected without changing pipeline
rules: Presidio skips `.invalid` email suffixes, and its person recognizer interpreted
part of the first collision wording differently. The final fixtures use reserved
`example.com` addresses and simpler collision wording.

A repository-wide Ruff auto-fix attempt touched unrelated C3 files; those edits
were undone and the C3 tree has no diff. That broad check reported 15 remaining
pre-existing E402 errors in C3 research files. The scoped platform Ruff check is
clean; repository-wide research lint is not claimed clean.

Not executed: full Python suite, frontend lint/component/browser tests, Docker smoke
checks, or benchmarks. No benchmarks, historical evidence artifacts or provenance
were modified. No commit, push, merge or branch change was performed.

## Next checkpoint and remaining research work

Frontend checkpoint: add the synthetic demo page inside `apps/counsellor-dashboard`,
reuse the existing authenticated same-origin API conventions, select catalogue ID
and strategy (Regex default), and display actual records, transformations, quality
and privacy summaries with blocking reasons and human-release wording. Handle
authorization expiry and safe failures; label language as fixture metadata. No
frontend page or report-download endpoint is implemented in checkpoint 1.

Language ID, normalization, tokenization, annotation and final dataset release remain
pending. The demo does not implement C3 modelling, C4 XAI/faithfulness or the final
research dashboard. C1 retains shared auth/orchestration ownership; C2 supplies the
pipeline demonstration.

## Checkpoint 2 — working frontend (2026-10-13)

Completed and left uncommitted on `feature/c2-anonymization-pipeline`; HEAD remains
`aee9393`. Checkpoint-1 backend edits and merged team work were preserved.

**Demo URL: http://localhost:3001/c2-demo**

The dashboard links to the new page. It reuses shared UI, the C1 same-origin API
helper and the current counsellor session, with a dashboard/sign-in path and a
sign-out control. Shared header defaults remain unchanged for existing shells;
the C2 page explicitly labels its live pipeline instead of claiming mock results.
The API helper now accepts an optional AbortSignal and propagates it through
session refresh/retry without changing existing callers.

The page fetches the catalogue and sends only `scenario_id` and `strategy` to the
existing run endpoint. There is no participant input, upload, frontend anonymization,
quality decision logic, simulated progress, fixed application result or storage.
It displays original and anonymized synthetic text, transformations, quality
status/issues, counts, ordered blocking reasons, backend quality/privacy summaries
and human-release requirements. Short text, punctuation, Sinhala and emoji are
rendered without text preprocessing. Selection changes, Reset, logout and unmount
abort requests and invalidate their sequence; late responses cannot restore results.
An immediate submission guard prevents duplicate runs while one is pending.

Language labels are identified as fixture metadata. Language ID, Normalization,
Tokenization, Annotation and Final Dataset Release are visibly Pending. Matching
masked text is explained as possible duplication or masking collision. Live results
and historical reports are distinguished, with `artifacts/c2-evidence` shown as a
local folder. No report files or report-download infrastructure were changed.

### Notebook provenance inspection

Before checkpoint-2 edits, `git status --short` and
`git diff -- research/c3-model-experiments/notebooks/01_data_preparation.ipynb`
showed **no notebook change**. Checkpoint 1 had briefly modified this notebook
during its overly broad Ruff auto-fix and then undone that modification. Thus no
surviving notebook diff predates checkpoint 2 or belongs to this checkpoint.
The notebook was inspected and left untouched. All C3 research files still have
no Git diff; no unrelated changes were reverted in checkpoint 2.

### Development setup and private login

Use the existing private, gitignored `.env` generated by the development bootstrap.
Never paste its values into chat, source control, screenshots or reports. Both
demo boundaries require `environment=development`; other configurations are
rejected by settings/route guards. Compose sets the orchestrator environment to
development; preprocessing uses the existing development default. Existing
preprocessing service secrets, Redis token registration, C1 signing/session
configuration, database, `ALLOWED_ORIGINS` including `http://localhost:3001`, and
development counsellor provisioning must be available. Presidio/Hybrid require
the pinned dependencies and existing `en_core_web_sm` model.

```powershell
docker compose build orchestrator counsellor-dashboard
docker compose up -d --no-build --wait
```

Open http://localhost:3001/ and privately use `DEV_COUNSELLOR_USERNAME` and
`DEV_COUNSELLOR_PASSWORD` from your local `.env`. Credentials are entered only
into the existing development sign-in form and cleared by that form after login.
Only a counsellor session can use this demo; admin/researcher/student roles do
not grant access. Use a separate browser profile from the student portal because
the existing localhost applications share cookie scope. Follow the dashboard's
“Open C2 Dataset Pipeline Demo” link, or visit the demo URL after signing in.
Session refresh is handled by the C1 API helper; an expired/revoked session that
cannot refresh shows a safe sign-in message.

### PP1 demonstration steps

1. Start the healthy local development stack and sign in privately on the dashboard.
2. Open `/c2-demo`. Identify the synthetic-only notice and fixture-language label.
3. Run the English example with Regex; compare the original fictional email with
   the actual `[EMAIL]` output and returned transformations/counts.
4. Change strategy to Presidio and Hybrid and rerun; changing a selector clears
   prior results. These are live pipeline calls, not historical benchmark results.
5. Run Sinhala, Romanized Sinhala and code-mixed examples. Language labels are
   sample metadata, with multilingual research validation still pending.
6. Run short, placeholder-only, duplicate and masking-collision scenarios to show
   REVIEW blocking; run empty content to show REJECT; run the empty batch to show
   no records and release blocking. Keep the separate human-release requirement
   visible, including when automated gates pass.
7. Use Reset to clear results and return to the default selections. Show the five
   Pending research stages and explain the local historical evidence folder.
8. Sign out; catalogue/results disappear and the page provides a sign-in path.

### Checkpoint-2 verification commands and outcomes

Commands ran from the repository root. Test/browser/container commands required
execution outside the restricted sandbox for Windows process/temporary-file and
Docker pipe access; no credentials or environment secrets were printed.

| Exact command | Actual outcome |
| --- | --- |
| `npm run lint` | Passed, including both existing shells and new smoke script |
| `npm run typecheck` | Both applications passed |
| `npm test` | **38 passed**, four test files; 22 new C2 tests |
| `npm run build --workspace=@j26/counsellor-dashboard` | Passed; `/c2-demo` generated |
| `.venv\Scripts\python.exe -m pytest --basetemp=artifacts/c2-checkpoint2-pytest-1 -p no:cacheprovider --tb=short` | **334 passed**, one existing Starlette/httpx deprecation warning |
| `.venv\Scripts\python.exe scripts/run.py scripts.generate_contracts --check` | JSON Schema/OpenAPI drift passed |
| `npm run contracts:check` | TypeScript drift passed |
| `.venv\Scripts\python.exe scripts/check_repository.py` | Candidate-file and frontend privacy checks passed |
| `.venv\Scripts\python.exe scripts/check_ci.py` | CI structure passed; hosted CI not run |
| `.venv\Scripts\python.exe -m ruff check services packages scripts tests` | Platform Ruff passed |
| `.venv\Scripts\python.exe -m ruff check . --output-format concise` | Failed on **63 pre-existing C3 findings**, including **17 E402**; rules/files unchanged |
| `git diff --check` | Passed |
| `docker compose build orchestrator counsellor-dashboard` | Both images built successfully |
| `docker compose up -d --no-build --wait` | All nine services healthy |
| `.venv\Scripts\python.exe scripts/compose_smoke.py` | Passed existing workflow, PostgreSQL/Redis, idempotency, review, withdrawal/retention, proxy and log-privacy checks |
| `.venv\Scripts\python.exe scripts/c2_demo_smoke.py` | Passed authenticated catalogue, **30 live executions** (10 scenarios × 3 strategies), strict input, logout and log privacy through the dashboard proxy to actual Docker endpoints |
| `node scripts/c2_demo_browser.mjs` | Passed in Edge 155; desktop 1366px and narrow 390px browser checks |

Full pytest includes checkpoint-1 shared-contract compatibility checks against
HEAD's existing schemas/OpenAPI plus consent/review regressions. Frontend tests
use disposable synthetic response snapshots generated from the real Regex
pipeline in `tests/fixtures/synthetic/c2-demo.json`; application code has no fixture
results. Tests cover real-response display, REVIEW/REJECT/empty-batch blocking,
401/403/404/422/503 states, selector/reset/logout/unmount cancellation, newer-result
ordering, single pending submission, Sinhala, punctuation and emoji preservation.

The first frontend test attempt hit a Windows `spawn EPERM` startup failure;
the final elevated run passed. Docker initially was stopped; Docker Desktop was
started in the background and final build/health/smoke checks passed. A newly
added browser-script unused-global lint failure was corrected; final lint passed.
The scoped Ruff result is clean. The broad restored C3 tree has 63 findings
(17 E402, 10 F401, 2 F541, 10 I001, 15 UP006, 1 UP015, 6 UP035, 2 UP045).
This is the actual current baseline; checkpoint 1's earlier 15-E402 count came
from the broad auto-fix attempt before its C3 edits were undone.

Browser checks exercised unauthenticated access, private dashboard login and
navigation, live Regex/Presidio/Hybrid masking, REVIEW/REJECT/empty-batch blocking,
narrow Sinhala rendering, Reset and logout. Screenshots were visually inspected:
readable Sinhala, stacked narrow cards, side-by-side desktop text and no horizontal
overflow. Safe screenshots and the browser report are under ignored
`.local/c2-demo-browser-8673c65c-5750-4ca7-ab8b-17d6d64366c5/`.
No credential screenshots, network traces or browser persistence were retained.

### Remaining blockers and limits

Checkpoint 2 has no unresolved demo implementation failure in the checks above.
Repository-wide Ruff remains blocked by the unchanged C3 research findings.
Hosted CI and independent research/usability validation remain unexecuted.
The five research stages and final human dataset-release approval remain pending;
the successful engineering demonstration is not release authorization.
No benchmarks were rerun, no historical reports/provenance were edited, and no
commit, push, merge, branch switch or reset was performed. The local Docker stack
is left running for the user to demonstrate the page.

## Self-contained PP1 presentation (2026-10-13)

URL: **http://localhost:3001/c2-demo**. Existing backend development configuration
and authorization requirements remain unchanged. If signed out, a compact form on
the C2 page submits the existing shared `LoginRequest` (`username`, `password`) to
`/api/v1/auth/login`. Use `DEV_COUNSELLOR_USERNAME` and `DEV_COUNSELLOR_PASSWORD`
privately from the existing gitignored `.env`; never copy values into chat or
reports. Only the authorized development counsellor role is accepted. A successful
login loads `/api/v1/c2-demo/scenarios` automatically. A non-counsellor login is
signed out and denied; server authorization remains authoritative.

Passwords are cleared immediately when submitted, including failed attempts.
Credentials are not stored in React state, browser storage or logs; only the
existing C1 session cookies are used. Login duplicate submissions are guarded.
Session expiry clears previous results and presents the same C2 sign-in form.
The page never calls student submission, consent, review-task or LMS endpoints.

The layout now has one short synthetic-data notice and persistent **Anonymization
results** and **Batch quality** sections with simple empty states. Original and
actual masked text, backend transformations/statuses and short issue explanations
are shown without frontend pipeline decisions. Human release approval remains
distinct from automated gate results. Pending stages are collapsed by default.
Fixture languages remain metadata. Reset, in-flight cancellation, sequence guards
and duplicate-run prevention are preserved. Styling additions are scoped locally
to `apps/counsellor-dashboard/app/c2-demo/demo.css`.

### Short walkthrough

1. Open `/c2-demo` directly. Sign in here using your private local development
   counsellor credentials; existing sessions load the catalogue immediately.
2. Select the English sample and Regex, then **Run demonstration**. Compare the
   original fictional email with actual anonymized output and transformation types.
3. Select **Short meaningful content** to show REVIEW and blocking reasons, or
   **Empty content** to show REJECT. No student/consent/review/LMS preparation is needed.
4. Show batch counts and the separate human-release requirement. Change strategy
   or choose Sinhala to demonstrate a further real run; sample language is metadata.
5. Use **Reset** to clear outputs. Expand **Pending pipeline stages** only if needed.
   Historical reports remain local under `artifacts/c2-evidence`. Sign out when done.

### Actual verification for this change

- `npm test -- tests/frontend/c2-demo.test.tsx`: **27 passed**. Covers direct login,
  automatic catalogue loading, immediate password clearing on success/failure,
  duplicate sign-in prevention, non-counsellor rejection/logout, session-expiry
  reauthentication, permanent empty sections, collapsed Pending stages, real-response
  rendering and existing reset/stale-response/Unicode/error regressions.
- `npm run lint`: passed. `npm run typecheck`: both applications passed.
- `git diff --check`: passed.
- `docker compose build counsellor-dashboard`: passed.
- `docker compose up -d --no-build --wait counsellor-dashboard`: passed; the
  rebuilt dashboard and required backend services are healthy.
- `.venv\Scripts\python.exe scripts/c2_demo_smoke.py`: passed **30 authenticated
  live runs** across the existing scenarios/strategies, strict input, logout and
  log privacy. Only synthetic demo endpoints and existing login/logout were used.
- `node .local/c2_selfcontained_browser.mjs`: passed using an ignored adaptation
  of the existing C2 browser test to sign in directly on `/c2-demo`. Edge 155
  exercised unauthenticated access, C2 login/catalogue loading, live Regex/Presidio/
  Hybrid, REVIEW/REJECT/empty-batch blocking, narrow Sinhala, Reset and logout.
  Desktop and 390px screenshots were actually viewed: readable text, stacked
  narrow cards, persistent result sections, collapsed Pending stages and no
  horizontal overflow. No credential screenshots or network traces were retained.
  Report/screenshots: `.local/c2-demo-browser-8f1314a3-f726-4961-b40e-4420c84fd949/`.

An initial focused test failed because its “Empty batch” query matched both the
option and result; the selector was corrected and the final 27-test run passed.
No unresolved failure remains for this frontend change. Full Python/contract checks
and benchmarks were not rerun because no backend, shared auth, contract or pipeline
code changed. Previously documented C3 repository-wide lint findings remain.

Files changed for this request only: C2 `page.tsx`, new local `demo.css`,
`tests/frontend/c2-demo.test.tsx` and this document. Existing uncommitted changes
and other members' pages were preserved. No commit, push, reset or branch change
was performed. The local Docker stack remains running for the demonstration.
# Current Language ID increment — 2026-10-14

Open **http://localhost:3001/c2-demo** using the private local development
counsellor sign-in. Enter fictional text directly; there is no language dropdown.
The browser sends only `{text, strategy: "presidio"}`. Legacy hints remain
optional metadata for older clients and never configure Presidio.

Execution order is **Anonymize → existing Quality Check → Language ID**.
Read-only Language ID shows the actual backend label, uncertainty, reason and
`c2-rule-language-v1` method. This conservative offline rule baseline uses
Sinhala script and bounded English/Romanized marker evidence; Latin script alone
does not imply English. It does not implement multilingual anonymization.
See [criteria and checks](c2-language-id-v1.md).

PP1 walkthrough: sign in here, enter fictional text, Run, compare actual
Before/After, inspect quality/privacy/blocking, then inspect Language ID.
Use English, Sinhala, Romanized, mixed and short/empty examples to demonstrate
both provisional labels and unknown/uncertain outcomes. Reset invalidates pending
responses. The eight-stage stepper uses confirmed response data only; while
waiting it shows overall processing because intermediate events are unavailable.
Review/rejection are distinct from execution completion. Annotation, normalization,
tokenization, data collection and final human release remain Pending.

Verification: 848 Python tests passed, 22 known expected failures; 58 frontend
tests passed; lint/typecheck and contract drift/compatibility passed. Docker was
rebuilt and authenticated parity/browser checks performed. Global Ruff still has
63 unrelated C3 failures; scoped Ruff passes. New synthetic Language ID evidence
is under `artifacts/c2-evidence/language-id/rule-baseline-v1`; it includes errors,
not a claim of validated language support. Earlier sections below describe their
historical checkpoints; their manual-dropdown instructions are superseded here.

# Current provisional Normalize/Tokenize checkpoint — 2026-10-14

**Demo URL: http://localhost:3001/c2-demo.** Sign in here with private local
development counsellor credentials, enter fictional text directly and Run.
No language dropdown, student submission, consent form or review task is needed.
The demo is development-only, authenticated and ephemeral.

The centered 1120px layout now puts the eight-stage stepper below the heading:
Anonymize → Data Quality → Language ID → Normalize → Tokenize → Annotate →
Validate → Versioned Release. Without intermediate backend events, a blue
spinner shows overall processing only. Confirmed response stages show completion
or review/error; the last three stages stay Pending. Validate refers to future
annotated-dataset validation, not a replacement for the existing gates below.

Inspect actual Before/After, separate NFC/whitespace-normalized text, tokens,
read-only Language ID and quality/privacy/release warnings. Expand technical
sections for methods, language evidence and zero-based code-point offsets into
normalized text. Reset clears results and invalidates pending responses.
Current Presidio masking, Language ID rules and release policy remain unchanged.

[Method selection, measured comparisons, runtime and limitations](c2-text-preparation-v1.md)
distinguish documentation-only alternatives from executed methods. The small
development comparison is not a best-performing or research-validation claim.
New aggregate evidence: `artifacts/c2-evidence/text-preparation/provisional-v1`.
Earlier checkpoint sections below retain historical context and are superseded
by this current flow where they describe pending normalization/tokenization.

# Final UI grouping and toast clarification — 2026-10-14

At **http://localhost:3001/c2-demo**, the top row contains only fictional Input
(including its exact submitted-original snapshot) and Anonymized Output.
Language ID, normalized text/tokens, record quality/privacy and batch/release
results are grouped full-width below. Review/blocking/human-release warnings
remain visible; token-offset tables and technical evidence are collapsed by
default. The input is no longer sticky beside a long downstream results column.

One mounted notification slot displays either one actual completion/review
toast or one safe error alert. It is sticky so the outcome remains visible while
scrolling. Starting a new run, editing, Reset or logout invalidates the previous
outcome; stale responses cannot recreate it. No timers, fake delays, per-stage
notifications or inferred privacy success were added. The overall pending
indicator remains separate from the single outcome notification.

Verification: frontend full suite **65 passed**, focused **49 passed**;
lint/typecheck and frontend Docker build passed. Initial focused testing caught
a duplicate accessible region label, which was removed; desired grouping checks
then passed. Edge 155.0.4283.45 verified 73 actual responses, exact Before/After,
full-width geometry and a visible single outcome notification, plus a real
server-validation error using programmatic 1,001-character fictional input.
Desktop 1366px and mobile 390px checks use a clean browser profile with default
100% zoom, device scale factor 1 and page/visual-viewport scale 1. Backend policy,
masking, Language ID, normalization/tokenization and contract files were not
changed; prior Python/contract/Docker-parity verification is reused.

Commands: `npm run lint`, `npm run typecheck`,
`npm test -- tests/frontend/c2-demo.test.tsx`, `npm test`,
`docker compose build counsellor-dashboard`,
`docker compose up -d --no-deps --wait counsellor-dashboard`,
`node scripts/c2_demo_browser.mjs .local/c2-text-preparation-browser-inputs.json`,
`git diff --check`. Changes are limited to C2 `page.tsx`/`demo.css`, focused tests,
the C2 browser verifier and this documentation. No commits/pushes.

After collapsing the final evidence section, the focused 49 tests and Docker
build passed again. A final three-case actual browser run covered completion,
empty rejection and privacy review, 390px stacking, full-width downstream cards,
100% scale, safe validation-error notification, Reset and logout. Desktop/mobile
screenshots were visually inspected under
`.local/c2-demo-browser-c3e5d970-fbe8-4429-99ac-d363506aded6`.
The browser verifier also checks the validation failure is HTTP 422, not a
fabricated result or a session/service error. No toast timer or stage event was
invented. All previous method-selection reports and backend evidence are unchanged.

# Current short-language evidence correction — 2026-10-14

**http://localhost:3001/c2-demo** now runs `c2-rule-language-v1.1` after the
unchanged anonymization/quality assessment. `Mge nama [PERSON]` is provisional
Romanized Sinhala: the prior result was caused by the three-word evidence
minimum after removing placeholders, not missing case/abbreviation handling.
A bounded complete `mage/mge/eyge nama` grammar exception now recognizes the
two-word field; ambiguous shared words still abstain. Presidio, normalization,
tokenization, quality/privacy/release controls and the verified layout are unchanged.

[Before/after diagnostic and unchanged frozen evaluation evidence](c2-language-short-phrase-v1.md)
records remaining errors and exact checks. Full Python **943 passed, 24 expected
failures**; frontend **65 passed**; contracts/lint/typecheck/scoped Ruff and Docker
checks passed. Edge verified 77 real runs and desktop/mobile rendering at 100%
scale, including the reported phrase, tokens/offsets, actual gates and single
completion/review/error notifications. No commit/push; historical reports preserved.
## Final compact summary (2026-10-15)

The UI evidence-context card and local artifact-path text are removed; reports
remain documented here. Quality and release uses a compact actual gate summary,
visible blocking/review reasons and human approval requirement. Counts appear only
for multiple records. Backend quality/privacy policy is unchanged.
See [current Language ID evidence](c2-language-id-v1.md),
[normalization](c2-normalization-v1.md) and [tokenization](c2-tokenization-v1.md).
## Synthetic annotation increment — 2026-10-15

The C2 demo links to **http://localhost:3001/c2-demo/annotation**. This separate
workbench saves provisional language/code-mixing/emotion/non-diagnostic wellbeing
decisions for four immutable server-owned, privacy-cleared samples. Draft/final
history is durable in PostgreSQL; two existing authenticated account IDs are
required. Peer labels remain hidden until both finalize. No agreement score,
adjudication, expert label approval or dataset release is implemented.

See [actual implementation/checks and PP1 walkthrough](c2-synthetic-dataset-annotation-v1.md).
The original custom-text demo stays ephemeral; arbitrary custom runs cannot enter
the annotation queue. PII gold-set evaluation remains a separate workflow.

## Assigned survey submission pilot — 2026-10-22

The same annotation URL now includes four explicitly paired synthetic survey
submissions, grouped by preserved submission ID with Q4–Q10 in order. Q4–Q9
are required; unanswered Q10 needs no label. See the
[pilot implementation, counts, checks and walkthrough](c2-submission-annotation-pilot-v1.md).
Existing standalone histories remain separately collapsed. Generator metadata
never preselects human labels; agreement/adjudication/release remain pending.
