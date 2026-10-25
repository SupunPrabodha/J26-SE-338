# C1 live requirements checklist

Status/session correction (2026-10-25): [all 39 subchecks, exact remaining gaps and
actual remembered-session/researcher verification](c1-remembered-sessions-status.md).
Implementation is independent of selected-run events and stale evidence. Logical identity
separation is implemented; independent store isolation/evaluation remains pending. NFR05
now identifies implemented **mock-contract** compatibility with real-provider integration
separately pending at FR04.b/readiness. TLS stays Missing; storage encryption is Unverified.
Audit logging stays implemented while expanded coverage remains unmeasured. The earlier
NFR05 Partial classification below describes the preceding audit, superseded by this more
precise decomposition; its historical test results are unchanged.

Presentation update (2026-10-25): [professional interface and actual verification](c1-professional-interface.md).
The illustrated student shell and coordinated evidence header preserve all requirement,
selected-run and historical-evidence distinctions below; no research status is upgraded.

Final readiness audit (2026-10-24, baseline `15f4a81`):
[all C1 requirements, evidence, remaining owners and PP1 claims](c1-final-pp1-audit.md).
That audit classified NFR05 Partial: shared mock contracts are verified; real C2–C4 compatibility awaits
integration. This is independent of selected-run receipts and does not change historical
test results below. The re-enable input workaround is investigated in that audit.

Privacy presentation correction (2026-10-24): [current increment and verification](c1-privacy-ui.md).
The default view now has six privacy groups with independent implementation and selected-run
evidence columns. Details and safe receipts use accessible dialogs. Reliability and dated
evaluation are secondary views. No overall completion score is calculated. The October 21
status vocabulary and missing FR09/FR12 statements below describe that historical revision;
they do not describe the current implementation. Current status rules and remaining gaps
are recorded in the linked note. Manual assignment is explained in the student notice.

Manual-assignment update (2026-10-24): [current manual demo and operational charts](c1-manual-assignment-charts.md).
With the explicit Compose demo override, a processed task remains unverified at FR07 until
an actual assignment exists. Current owner evidence already uses that persisted check;
no checklist pass is inferred from submission alone. New admin aggregate charts remain
in the admin application; interpretation/follow-up contents remain counsellor-only.

Role-workspace update (2026-10-24): [assignment/staff delivery and actual verification](c1-role-assignment.md).
FR08/FR12 administration now includes confirmed eligible assignment/reassignment, staff role
changes and session revocation. These are separate ADMIN pages; the owner checklist cannot
read their records or interpretation/follow-up contents. Its implementation/current-run/
recorded-test distinction is preserved. C2–C4 route metadata remains staff-only; their live
providers are mocks and no human research pages are connected. Earlier missing-feature
claims below are historical and do not supersede these dated implementation notes.

Workspace update (2026-10-24): see [current audit](c1-workspace-audit.md) and
[runtime verification](c1-workspace-verification.md). The compact table separates implementation
from current-run observations and recorded/configuration evidence. FR12 now has a separate
restricted admin interface; this student checklist cannot read admin events or counselling
content. Historical missing-interface statements below are superseded by this dated update.

FR09 update (2026-10-23): [implementation and verification](c1-fr09-review-record.md).
Interpretation/follow-up recording is implemented for synthetic assigned-counsellor use.
FR09.c shows only an actual save receipt; FR09.d describes capability and FR09.e links
recorded tests. Contents remain private. Older missing-feature lists and test totals below
describe the October 21 implementation and are superseded for FR09 by this dated update.

Session update (2026-10-22): see [session continuity diagnosis and fix](c1-session-continuity.md).
The proxies now isolate application cookie names and coordinate renewal across student tabs.
Sign in again once after upgrading from the legacy shared-cookie proxy. The October 21
verification below remains historical checklist evidence.

Assessment and implementation: 2026-10-21, working tree based on `8a9d773`, branch
`feature/c1-consent-orchestration`. Those changes were uncommitted at verification time
and are now included in `091281f`. Earlier uncommitted demo
work was refactored, not reset. No migrations, credentials, dataset work or C2–C4 research
implementations were added. This note supersedes the previous form-based `/demo` design.

## Source and ownership

Rechecked finalized TAF pp7–8 and C1 proposal **IT23187450 section 5, pp27–28** against
the local supplied PDFs. FR01–FR12 and NFR01–NFR10 are the proposal's proposed requirements,
not completed stakeholder validation. Subcheck suffixes are UI decomposition, not additional
proposal requirements. Encryption at rest is labelled a supporting control, not a new source
requirement. TAF ownership prevails: C1 architecture, consent, identity, authorization,
orchestration, adapters, retention and audit; C2 preprocessing/datasets, C3 modelling, C4
XAI and final dashboard research. The demonstration is synthetic, non-diagnostic screening
support with counsellor-assisted interpretation. It does not replace professional counselling.

## Implementation and data boundary

| Files | Responsibility |
| --- | --- |
| `apps/student-portal/app/demo/page.tsx`, `components/demo-checklist.tsx` | Read-only observer, explicit run selector, bounded polling, stale state and application links |
| `components/checklist-rules.ts` | Requirement subchecks, exact presentation rules, evidence scopes and limitations |
| `components/student-lifecycle.tsx`, `app/page.tsx` | Student form only at `/`; reuse active student session, try refresh before creating a new session, reject other roles |
| `components/demo-panels.tsx`, `c1-evidence.ts` | Configuration boundary and allowlisted historical evaluation summaries |
| `services/orchestrator/demo.py`, `main.py` | Owner-only run list and safe persisted receipts; no general audit or protected output endpoint |
| `packages/contracts/src/research_contracts/__init__.py` | Additive DemoRun, DemoRunPage, DemoReceipt and DemoEvidence contracts |
| Generated JSON Schemas, orchestrator OpenAPI, TypeScript declarations | Regenerated together; existing wire schemas unchanged |
| Shared `api.ts`, `styles.css` | Abortable existing cookie-based requests and accessible labelled checklist badges |
| `tests/integration/test_demo_evidence.py`, frontend tests, `scripts/postgres_checks.py`, `scripts/pp1_browser.mjs` | API, UI, concurrency and real browser regressions |

`GET /api/v1/demo/runs?offset=0&limit=20` lists only the current student's Consent records
with optional case status. Each consent is a run, even before submission. Pagination returns
at most 20 summaries and a next offset; offset is bounded to 10000. No globally latest case
is selected. `GET /api/v1/demo/runs/{run_id}` rechecks student authentication and ownership
on every request; foreign/nonexistent identifiers return 404 and other roles are denied.
This is receipt access, not permission to process text or review predictions.

The detail read uses established **case then consent** locks. When a case appears while a
pre-case read waits on consent, it releases that lock before acquiring the case lock. This
keeps evidence coherent with withdrawal without inverting the existing lock order.
Consent validity uses `active_consent`; expiry/disposal makes the response receipt-only.
There are no schema changes. The endpoint does not mutate records or emit synthetic audit
events to make the demonstration pass.

Only typed status, bounded booleans, pseudonymous references and receipt/action timestamps
are returned. Audit types **and stored status values** are allowlisted in `PAIRS`; arbitrary
stored status strings never leave the endpoint. At most 50 recent receipts are returned,
with a truncation flag. Existence checks remain independent of that window. No audit IDs,
trace IDs, identity mappings, actor IDs, raw text, inference/explanation content, notes,
tokens, credentials or database access are exposed. Correlation/provenance are validated
internally; only the validation result is exposed.

After inactive consent or case disposal, the endpoint withholds processing provenance,
replay and failure evidence. Only current state and minimal consent, denial, human-action,
withdrawal and retention receipts remain. Disposal confirmation requires the retention
record, cleared derived fields, no assignments and a cancelled/cleared job (or no job).
Review completion requires an actual `ReviewAction`, never a case status alone.

The observer reuses same-origin HTTP-only cookies and the existing API proxy. It never
creates sessions, submits, withdraws or reviews. The landing form reuses an existing student
session across runs; a new session cannot recover an expired owner's runs. No localStorage,
sessionStorage, URL capabilities or browser flags are used as evidence. Landing-page action
references remain in memory; the observer does not restore form controls after reload.

## Requirement-to-evidence mapping

All live sources below are the narrow owner evidence endpoint, not unrestricted database
reads in the browser. Recorded test labels refer to repository tests and the dated retained
evaluation section; they never turn this run green.

| Proposal requirement | Subchecks and actual source | Remaining scope |
| --- | --- | --- |
| FR01 Versioned consent | `.a` persisted consent-decision audit and consent record; `.b` development notice configuration | Approved operational notice/purpose not established |
| FR02 Consent enforcement | `.a` actual scoped OPERATION_BLOCKED receipt; `.b` recorded lifecycle/recovery negative tests | Acceptance or rejection alone does not prove blocking; every invalid/expiry boundary needs its own test |
| FR03 Pseudonymity and identity separation | `.a` existing case reference; `.b` recorded adapter/separation evidence | Case UUID does not prove isolation |
| FR04 Validated/minimized versioned routing | `.a` stored provenance validated with case correlation; `.b` mock contract boundary | C1 outcome only, not independent replay or real C2 anonymization |
| FR05 Versions and correlation | Validated ServiceProvenance against current mock v1 contract | Withheld for inactive/disposed cases; no protected output returned |
| FR06 Retry/timeout/idempotency/safe failure | `.a` replay audit; `.b` retry/terminal receipt; `.c` recorded reliability tests | A retry receipt is not all bounded-timeout scenarios |
| FR07 Review-task creation | Existing task, assignment, supported state, current consent and valid provenance | No task access after disposal; no standalone task-presence pass |
| FR08 RBAC/case authorization | `.a` successful owner-authorized evidence response; `.b` recorded negative security tests | Positive access is not denial coverage |
| FR09 Human review (2026-10-23) | `.a/.b` START/COMPLETE; `.c` live saved-record receipt; `.d` implemented capability; `.e` separately recorded tests | No interpretation/follow-up contents returned. A receipt does not prove interpretation quality or completed follow-up |
| FR10 Withdrawal/deletion | `.a` explicit withdrawal record; `.b` verified disposal state; `.c` recorded denied-access tests | Pre-case withdrawal has no case to delete; disposal is not proof of an attempted denied read |
| FR11 Lifecycle audit | `.a` safe scoped receipt presence; `.b` recorded append-only/privacy/coverage tests | Event count does not prove full audit coverage or text exclusion |
| FR12 Administrative evidence (Should) | Broader admin operations evidence UI is not implemented | Existing assignment administration is not the full FR12 evidence interface |
| NFR01 Privacy | Recorded adapter/privacy tests | Real anonymization and full deployment privacy evaluation remain separate |
| NFR02 Security | `.a` owner-authenticated response; `.b` HTTP localhost configuration; `.c` no specific at-rest evidence | TLS not implemented for this local deployment; at-rest unverified; not a broad security pass |
| NFR03 Consent correctness | Recorded negative consent tests | Provisional all-invalid-path target not established by one run |
| NFR04 Audit coverage | Historical synthetic catalog evidence | No live coverage percentage; provisional target is not stakeholder validation |
| NFR05 Interoperability | Generated contracts/drift and negative tests | Not every malformed/version mismatch is exercised live |
| NFR06 Reliability | Recorded concurrency/reliability regressions | No universal terminal-state correctness claim |
| NFR07 Performance | Dated retained core proxy, separately labelled | Excludes HTTP/authentication/queue and AI; no new performance run or live latency invented |
| NFR08 Modifiability | Shared adapter/contract configuration | Measured change experiment still needed |
| NFR09 Deployment | Retained bootstrap/health evidence | No timed clean private-deployment validation |
| NFR10 Human-centred support | `.a` actual completed review action; `.b` screening-support boundary | No usability, clinical validity or interpretation-quality result |

## Exact status rules

- **Verified for this run:** a specific fact in a fresh successful owner response supports
  that live subcheck. No requirement-wide rollup or overall percentage exists.
- **Not exercised:** no supporting live fact, or a control supported only by separately
  labelled recorded tests/configuration. Missing evidence is explained per row.
- **Failed:** FR04.a when the current, available, non-disposed run reports FAILED processing;
  not a claim that every routing/security control failed.
- **Mock dependency:** FR04.b identifies the current shared v1 mock contracts. It never
  signifies successful C2–C4 research implementation.
- **Not implemented:** approved operational notice, structured interpretation/follow-up,
  broader admin evidence UI and trusted TLS deployment are not supplied here.
- **Unavailable/stale:** live checks after an unsuccessful refresh, polling-window expiry,
  or affected processing checks withheld by inactive-consent/disposal policy.

Every row shows its source category, scope and missing evidence; live rows use the server
snapshot time or a specific persisted action/consent time. Browser last-refresh time is
labelled separately. Historical results keep their original dates and revision limitations.
The observer polls serially every 3 seconds, up to 20 successful observations per window,
with an 8-second request deadline. A window ending marks observations stale; manual refresh
starts another. Failed access/refresh clears live evidence and stops polling. Changing the
run clears the previous snapshot immediately and cancels outstanding requests.

## Verification on 2026-10-21

Final verification: **132 backend tests passed** (including 14 new evidence API tests);
**33 frontend tests passed**, including four additional session-reuse/refresh/role regressions.
Affected C1 Ruff checks, frontend lint/TypeScript, generated contract drift and repository
secret/prohibited-file scan passed. Repository-wide Ruff still reports **63 existing C3
findings**, reproduced specifically under `research/c3-model-experiments`; these were not
changed. Starlette emits the existing TestClient/httpx deprecation warning.

**10 PostgreSQL scenarios passed**, including a new observer/withdrawal race with real
lock-wait observation and coherent before-or-after snapshots. The harness used a unique
migrated schema, then removed only that disposable schema; development data/volume remained.
Aggregate report: ignored `.local/c1-postgres.json` (copy it before later evaluations overwrite
that standard path). No new performance benchmark was run.

Docker configuration, orchestrator/student production builds and nine-service health checks
passed. Existing compose smoke passed workflow C1–C4, concurrent idempotency, assigned review,
review actions, withdrawal/access revocation, retention-before-withdrawal, single receipts,
logout, frontend proxies and log privacy.

Edge **155.0.4283.62** browser smoke passed with student `/` and observer `/demo` in the
**same browser context**, counsellor in a **different context**. It exercised consent,
actual processing, actual review actions, withdrawal, multiple-run isolation and stale refresh.
Screenshots/report were retained only in ignored
`.local/c1-demo-browser-211ebb13-299e-4782-afb5-9a804fd625a6/` (final build).
An earlier passing capture remains at
`.local/c1-demo-browser-97871604-bc3e-46e0-8add-40bf60b4a4ba/`.
The stale scenario injects browser HTTP 503; no service outage was induced. Session ending
uses logout; natural one-hour expiry was not awaited. This is synthetic functional smoke,
not a human usability study. No network traces or credential-bearing screenshots retained.

Commands executed from the repository root in PowerShell (check each exit code):

```powershell
$env:PATH = (Resolve-Path '.local/node-runtime/node_modules/node/bin').Path + ';' + $env:PATH
.venv/Scripts/python.exe scripts/run.py pytest tests/integration/test_demo_evidence.py -q --basetemp=.local/pytest-demo-first-20261021
.venv/Scripts/python.exe scripts/run.py pytest -q --basetemp=.local/pytest-checklist-full-20261021-a
.venv/Scripts/python.exe -m ruff check services/orchestrator packages/contracts/src/research_contracts tests/integration/test_demo_evidence.py scripts/postgres_checks.py
npm test
npm run lint
npm run typecheck
npm run contracts:check
.venv/Scripts/python.exe scripts/run.py scripts.generate_contracts --check
.venv/Scripts/python.exe scripts/check_repository.py
git diff --check
docker compose config --quiet
docker compose build orchestrator student-portal
docker compose up -d --no-build --wait --wait-timeout 180
.venv/Scripts/python.exe scripts/run_evaluation.py postgres
.venv/Scripts/python.exe scripts/compose_smoke.py
node scripts/pp1_browser.mjs --demo
# Final UI wording/colour build and browser repeat:
docker compose build student-portal
docker compose up -d --no-build --wait --wait-timeout 180
node scripts/pp1_browser.mjs --demo
# Known unrelated failure, not a passing gate:
.venv/Scripts/python.exe -m ruff check --no-cache --statistics research/c3-model-experiments
```

Use a new unique pytest basetemp when repeating; do not delete existing temporary folders
or change permissions. No commits, staging, pushes, merges or branch changes were performed.

## Startup and demonstration sequence

```powershell
cd F:\Reserch\J26-SE-338
python scripts/bootstrap_dev.py
docker compose config --quiet
docker compose up -d --build --wait --wait-timeout 180
```

Bootstrap preserves an existing ignored `.env`; never print its credentials during a demo.
The originally running stack remains running for review; no volume reset is required.

1. Open `http://localhost:3000/demo` and its **Open student submission** link. Keep both
   tabs open in one student browser profile. The checklist contains no submission form.
2. On `/`, record synthetic consent. On `/demo`, click **Refresh evidence** if it was opened
   before a session existed, then explicitly select the consent run. Explain why acceptance
   verifies a decision but not denial/retry/encryption coverage.
3. Submit the built-in fixture on `/`. Observe actual returned processing state and safe
   evidence on `/demo`; fast mock stages need not appear as intermediate snapshots.
4. Open `http://localhost:3001` in a **separate browser profile**, sign in with the locally
   configured development counsellor and review the assigned synthetic task. The app link
   itself opens only a tab, not a separate profile. Record start and completion; refresh the
   observer if its bounded window has ended.
5. Withdraw on `/`. Observe explicit withdrawal, disposal and withheld provenance. Refresh
   assigned tasks in the counsellor profile to demonstrate revoked access.
6. Open a new `/` tab in the same student profile and record another decision. Refresh the
   run list, select the new run and show that prior processing/review evidence did not carry
   over. Demonstrate rejection and pre-submission withdrawal with separate synthetic runs.
7. Expand recorded evaluation evidence separately; these figures are historical, not metrics
   produced by opening this page. Training, dataset release and benchmarks never run on load.

Remaining limitations: development identity provider and HTTP transport, unverified at-rest
encryption, no approved operational notice, broader admin evidence and structured follow-up
missing, C2–C4 still mock dependencies on this contract path, and no clinical/usability or
full deployment evaluation. The page intentionally does not claim these controls complete.
