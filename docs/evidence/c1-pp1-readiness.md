# C1 consolidated PP1 readiness report

Assessment date: 2026-10-08, Asia/Colombo. Branch:
`feature/c1-consent-orchestration`; inspected baseline `c5a433b`.

**Ready with limitations for a synthetic C1 engineering demonstration.** Consent rejection,
pre-submission withdrawal, valid submission, authorized human review and withdrawal/access
revocation passed the checks below. Formal PP1 compliance cannot be determined without the
current assessment checklist. This does not claim full C1 completion, clinical validity,
production readiness or stakeholder/usability validation.

The [requirements/evidence matrix](c1-pp1-requirements-audit.md) maps the main objective,
O1–O6, planned research outputs, FR-01–12, NFR-01–10 and TAF quality responsibilities to
source pages, functions, inspected assertions, mock boundaries, gaps and priorities. It
distinguishes verified behavior from incomplete evidence, documents and external work.
Authority remains finalized TAF > supplied Master Research Context `(1).docx` > C1 proposal
IT23187450. Academic source files remain outside the repository. No PP1 checklist, approved
standalone SRS/RTM, stakeholder validation record or formal STRIDE/LINDDUN risk package was
found in the inspected locations. The matrix is an audit artifact, not an approved SRS.

## Delivered UI and demonstrated defects fixed

Both existing Next.js shells now use shared navy/teal styling, compact headings, white cards,
explicit labels, visible focus and a synthetic/mock badge. Desktop uses columns; mobile
stacks controls in consent, submission, status order. Material consent consequences remain
visible alongside an expandable full notice with the actual purpose/version. Rejection is
the initial choice. Consent must be confirmed by the server before submission is enabled.

Student status separates consent, processing, human review, disposal and explicit withdrawal
receipt. Retention does not suppress a first owner withdrawal. Native modal confirmation
focuses cancellation, contains keyboard focus and restores focus when closed. Elapsed
consent disables submission even when the last snapshot said ACTIVE. A server 401 ends UI
actions and explains the owner-recovery limitation; 403 requires a fresh status check.

The counsellor shell has a compact sign-in/task list and selected authorized case details.
Processing completion is distinct from human review completion. Mock indicators, fixed
uncalibrated confidence and unevaluated explanation reliability are explicit. A denied
task/action removes displayed evidence and actions; 401 returns to sign-in. Refresh after
withdrawal removes the selected task. Backend authorization remains authoritative.

No treatment advice, autonomous action, real NLP/XAI, analytics or C4 research was added.

## Files and compatibility

| Files | Change / purpose |
|---|---|
| `apps/student-portal/app/page.tsx` | Consent sequence, summary/full notice, lifecycle labels, expiry/access-denial handling and confirmation |
| `apps/counsellor-dashboard/app/page.tsx` | Sign-in, compact assigned tasks, selected evidence, explicit mock/human states and revoked-access handling |
| `packages/typescript-common/src/ui.tsx` | Shared header, safety notice, labels and native withdrawal dialog |
| `packages/typescript-common/src/styles.css`; both apps' `app/globals.css` | Shared responsive visual/focus styles and imports |
| `packages/typescript-common/src/api.ts` | Preserve HTTP status in a safe `ApiError`; no server response-body echo |
| `tests/frontend/consent-lifecycle.test.tsx`, `shells.test.tsx`, `setup.ts` | Updated assertions and jsdom dialog setup |
| `tests/frontend/pp1-behaviour.test.tsx` | Server-confirmed consent, expiry, student denial and counsellor denial regressions |
| `scripts/pp1_browser.mjs` | Reproducible local Edge/CDP synthetic flow and sanitized screenshots, using Node built-ins |
| `docs/evidence/c1-pp1-requirements-audit.md`, this report | Source-derived requirements mapping, evidence, limitations, priorities and demo instructions |
| `docs/evidence/c1-lifecycle-evaluation.md`, `readme.md` | Correct historical commit provenance and link current report |

No Python application code, dependencies, API schemas, generated contracts, database schema
or migrations changed in this task. The two additive migrations and three lifecycle models
belong to the existing `c5a433b` increment. Python and TypeScript artifact drift checks pass.
The added `ApiError` is an internal frontend helper, not a wire-contract change. No new
browser storage is introduced. All task edits remain unstaged and uncommitted.

## Newly executed verification

| Check | Actual result and scope |
|---|---|
| Frontend behavior | **16 passed**, three files; includes retained lifecycle/retention tests and seven new cases |
| Backend integration/security/contracts | **103 passed**; one existing Starlette/httpx deprecation warning |
| Frontend lint and TypeScript | Passed; initial lint of the new browser script required explicit browser globals, corrected and rerun |
| Python artifact drift and TypeScript contract drift | Passed |
| Repository secret/prohibited-file scan | Passed; generated artifacts remain ignored |
| Bootstrap / Compose configuration | Passed; existing `.env` preserved, `docker compose config --quiet` succeeded |
| Production portal Docker builds | Passed; both updated portals started with the existing stack; all nine services healthy |
| Docker synthetic smoke | PASS: health/readiness, PG/Redis, worker C1–C4, concurrent idempotency, assigned review/human action, withdrawal access revocation, retention before concurrent withdrawals, one receipt/event, logout, both frontend proxies, log privacy |
| Edge browser smoke | **Six scenarios passed**, Edge 154.0.4258.62; separate isolated student/counsellor contexts, fixed fixtures only |
| Visual inspection | Student desktop/mobile, withdrawal modal and selected counsellor task inspected; clear text/focus/layout; captured pages have no horizontal overflow |
| Final diff and ignored-artifact checks | See final verification at the end of this report |

Browser scenarios: rejection disables submit; accepted consent and mobile pre-submission
withdrawal with cancellation/focus return; fresh successful submission; assigned review
START and COMPLETE; owner withdrawal removes reviewer evidence/actions; ended-session
guidance. Browser storage checks found no localStorage/sessionStorage entries in tested
contexts. Screenshots are captured with empty credential fields. Session end was induced
by logout, not by waiting one hour. Component tests additionally cover 401/403 student
denials and 401/403/404 reviewer denials. This is not an accessibility certification,
screen-reader audit, cross-browser/device test or human task evaluation.

Commands used from the repository root (PowerShell; check each exit code):

```powershell
$env:PATH = (Resolve-Path '.local/node-runtime/node_modules/node/bin').Path + ';' + $env:PATH
npm test
npm run lint
npm run typecheck
npm run contracts:check
$testTemp = Join-Path (Get-Location) ('.local/pytest-pp1-' + [guid]::NewGuid().ToString('N'))
.\.venv\Scripts\python.exe scripts/run.py pytest tests/integration tests/security tests/contract --basetemp $testTemp --tb=short --show-capture=no
.\.venv\Scripts\python.exe scripts/run.py scripts.generate_contracts --check
.\.venv\Scripts\python.exe scripts/check_repository.py
docker compose config --quiet
docker compose build student-portal counsellor-dashboard
docker compose up -d --no-build --wait --wait-timeout 180
.\.local\node-runtime\node_modules\node\bin\node.exe scripts/pp1_browser.mjs
.\.venv\Scripts\python.exe scripts/compose_smoke.py
git diff --check
```

The unique pytest directory avoids the previous Windows temporary-directory permission
problem. No old temporary folders were removed and no system permissions were changed.
`config --quiet` validates without printing substituted secrets. The Edge runner requires
Windows Edge at its standard Program Files (x86) path and the running local stack; it reads
the existing development login privately. It mutates only the case it creates when reviewing
and withdrawing. Keep its entire browser profile directory private and ignored.

## Retained evidence, not new measurements

The existing [lifecycle evaluation](c1-lifecycle-evaluation.md) documents **118 backend tests**,
**nine PostgreSQL reliability checks**, migration/schema checks and an audit evaluator with
**29/29 required observations, 27/27 critical**, empty missing list, prohibited-content
checks and consistent case traces. The local aggregate reports were inspected. The audit
denominator is a fixed scenario/event/status catalogue, not all possible C1 operations or
proof of universal event ordering.

The retained PostgreSQL mock-core measurement used 20 warm-ups, 200/200 measured workflows,
concurrency 4: p50 **229.262 ms**, p95 **383.257 ms**, p99 **516.522 ms**, **16.131 workflows/s**,
zero errors. The report timestamp is 2026-10-07T19:33:21.589801 UTC (2026-10-08 local).
It measures submission/worker core behavior with measured mock-provider time subtracted;
it excludes HTTP/authentication transport, queue delay and real inference. The durable
historical note records runtime/environment and method. This does not establish the broader
proposal p95 target or institutional deployment performance.

The full backend unit suite, dedicated PostgreSQL race harness, migration rehearsal,
audit evaluation and performance measurement were not rerun for this UI-only task: their
underlying implementation and inputs were not changed. Current integration/security/contract
tests and real-container smoke were run. Python lint was not repeated because no Python
files changed. Hosted GitHub CI and research/participant evaluation were not run.

## Local screenshot evidence

Retain the aggregate `report.json` and the nine PNGs under
`.local/pp1-browser-6c8987fc-301b-498b-8729-7335ef299ead/` locally. Representative captures:

- [Student desktop](../../.local/pp1-browser-6c8987fc-301b-498b-8729-7335ef299ead/student-desktop.png)
- [Student mobile](../../.local/pp1-browser-6c8987fc-301b-498b-8729-7335ef299ead/student-mobile.png)
- [Withdrawal dialog](../../.local/pp1-browser-6c8987fc-301b-498b-8729-7335ef299ead/withdrawal-dialog-mobile.png)
- [Withdrawal receipt](../../.local/pp1-browser-6c8987fc-301b-498b-8729-7335ef299ead/withdrawal-receipt-mobile.png)
- [Authorized mock review](../../.local/pp1-browser-6c8987fc-301b-498b-8729-7335ef299ead/counsellor-assigned-review.png)
- [After revocation](../../.local/pp1-browser-6c8987fc-301b-498b-8729-7335ef299ead/counsellor-after-withdrawal.png)
- [Ended student session](../../.local/pp1-browser-6c8987fc-301b-498b-8729-7335ef299ead/student-ended-session.png)

These relative links work in this workspace; ignored artifacts are absent from a fresh clone.
Do not add `.local` wholesale to Git. No credentials, identity mapping, network trace, academic
source document, dataset, model or raw log belongs in the evidence commit.

## Startup and supported login

Prerequisites are in the README: Python 3.12, Node 22, Docker Desktop with Linux containers.
With those tools on PATH, run from this checkout:

```powershell
Set-Location 'F:\Reserch\J26-SE-338'
.\scripts\bootstrap-dev.ps1
docker compose config --quiet
docker compose up -d --build --wait --wait-timeout 180
docker compose ps
```

Expected: bootstrap preserves an existing `.env` or generates new ignored local secrets;
Compose validates, migrations/seed run at startup, and nine services become healthy. Never
copy secrets into example configuration or the report. Existing database account credentials
are preserved by seeding: replacing `.env` alone is not an account-password rotation.

Confirmed from current Compose port bindings and browser/proxy checks:

| Surface | URL |
|---|---|
| Student | http://localhost:3000 |
| Counsellor shell | http://localhost:3001 |
| Orchestrator documentation | http://localhost:8000/docs |

Student setup is the anonymous development session created when recording a decision. For
the counsellor, privately read `DEV_COUNSELLOR_USERNAME` and `DEV_COUNSELLOR_PASSWORD` from
the ignored `.env` and use the existing sign-in form. Do not show those fields in a recording.
Use separate browser profiles/contexts for the two roles: localhost ports share cookies.
Reloading the student page loses its in-memory case reference; expiry/reload recovery is
not implemented. A new session does not withdraw an old session's consent.

## Seven-step demonstration

1. Explain TAF ownership: C1 lifecycle/security/orchestration; deterministic C2–C4 mocks;
   authorized human interpretation, non-diagnostic support, no replacement for counselling.
2. In a fresh student context, record rejection. Show that submission stays disabled.
3. In another fresh context, accept; open withdrawal, cancel and reopen; confirm before
   submission. Show WITHDRAWN and the explicit receipt with no submitted case.
4. In a fresh context, accept and submit one fixed fixture. Refresh until processing is
   complete and human review is awaiting. Keep this owner page open.
5. In a separate counsellor context, sign in privately, refresh assigned tasks, select the
   new case, explain mock labels, START review and record COMPLETE. These are status actions.
6. Withdraw from the retained owner page. Refresh counsellor tasks; evidence and actions
   disappear. Explain that pending work is cancelled and server guards block later access;
   queued/racing processing revocation is covered by the retained backend/PG evidence.
7. Show this report, matrix and sanitized test results; disclose missing checklist,
   threat/requirements validation, real integrations and research evaluation.

For shutdown, preserve data:

```powershell
docker compose down
docker compose ps
docker volume ls --filter name=j26-se-338-dev_postgres-data
```

## Ordered remaining work and acceptance criteria

1. **Before PP1:** obtain the actual checklist and review this matrix with the supervisor.
   Acceptance: recorded checklist-to-artifact mapping and explicit unresolved decisions.
2. **Before PP1:** draft stakeholder goals/SRS, formal preliminary STRIDE/LINDDUN controls
   and residual-risk record, and missing context/deployment/interaction views. Link ADR
   tradeoffs by decision, not proposal numbering. Acceptance: traceable artifacts and
   review decisions, without claiming elicitation or risk acceptance that did not happen.
3. **Before PP1:** rehearse the seven-step script on the intended machine and package only
   sanitized screenshots/aggregates. Acceptance: healthy stack and reproducible demo;
   current notice is explicitly a development notice, not approved participant information.
4. **Later integration:** agree real C2 minimization, C3 model versions, C4 explanation/
   confidence/review semantics and remote deletion. Acceptance: owner-reviewed contracts,
   real provider conformance, provenance and withdrawal tests. Full dashboard research is C4.
5. **Later security/operations:** institutional identity/TLS/least privilege, approved
   identity/audit retention and recovery, denial/event coverage, retry backoff and operator
   replay, crash/soak tests. Acceptance: threat-linked negatives, residual findings and
   documented deployment/incident procedures. Logical separation is not physical isolation;
   append-only triggers are not cryptographic tamper evidence against the database owner.
6. **Later research:** controlled baseline comparison, adapted ATAM/expert reviews,
   modifiability/clean deployment experiments, full-boundary repeated load and ethics-approved
   human task evaluation. Acceptance: predetermined protocols and actual observations,
   including adverse results; no inferred usability ratings or completion percentages.

## Suggested review/commit groups

Changes are not staged or committed. Suggested messages, after reviewing shared hunks:

- `docs(c1): audit requirements and PP1 readiness evidence`
- `feat(ui): polish synthetic consent and counsellor review`
- `fix(ui): invalidate lifecycle actions after expiry or access denial`
- `test(ui): verify synthetic PP1 browser flows`

Behavioral fixes and their regression tests should stay together; the two page files span
presentation and behavior, so do not mechanically split solely by path. The final evidence
report should accompany the final reviewed implementation. No push or merge is authorized.

## Final workspace verification

`git diff --check` and the repository candidate-file/frontend privacy scan passed. The Git
index is empty; `.env`, the browser report/profile directory and retained evaluation JSON
files are ignored. Branch remains `feature/c1-consent-orchestration`, HEAD `c5a433b`.
No application/backend history was rewritten and no commit, push or merge was made.

Verification containers were stopped with `docker compose down` (without `-v`).
`docker compose ps` returned no services and `j26-se-338-dev_postgres-data` still exists.
No previous temporary folder or database volume was deleted. Restart with the commands above
before demonstrating the UI.
