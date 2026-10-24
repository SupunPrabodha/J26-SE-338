# C1 workspace implementation and verification — 2026-10-24

Latest follow-on verification: [manual assignment and actual-data operational charts](c1-manual-assignment-charts.md).
Historical totals/artifacts below remain distinct from that current increment.

Subsequent role-workspace increment: [explicit assignment, staff/session controls,
protected directory and current verification](c1-role-assignment.md). The 183/52 totals and
browser artifacts below describe the preceding workspace increment, not the later 198/58
run. Both increments remain uncommitted; earlier local work was preserved.

This increment implements the missing operational evidence interface and improves access
to existing counsellor records, then redesigns the student, counsellor, admin and checklist
pages. It is synthetic screening support with counsellor-assisted human interpretation;
the system does not replace professional counselling.

Branch: `feature/c1-consent-orchestration`; baseline `2dee860`. Initial untracked C3 results
were preserved. All changes are unstaged/uncommitted. No branch switch, history rewrite,
reset, push, merge, dataset/model work or database-volume deletion occurred.

The [full requirement audit](c1-workspace-audit.md) records what already existed, source
availability, each FR/NFR acceptance trace, classifications and remaining gaps. No green
checklist row or passing suite is treated as full research completion.

## Delivered behavior

- Student: compact journey and material versioned notice; rejection remains the default,
  acceptance is never preselected. Authenticated owner-session context is shown after an
  actual server check. Access/routing disclosures explain why recording consent alone does
  not grant counsellor access. Consent, withdrawal confirmation and lifecycle controls remain.
- Counsellor: server-verified role, safe assignment context, pseudonymous case references,
  processing/review statuses, submitted and saved timestamps, filters and bounded pagination.
  Saved reviews are discoverable in the queue and reopen through the protected record API
  after refresh or sign-in. The single immutable record is visibly read-only. Prefix/size
  requirements are explained before entry; invalid prefix produces an actionable message.
- Admin: distinct `/admin` screen with existing ADMIN authentication. Explicitly allowlisted
  persisted events/outcomes, date/type/case filters, cursor pagination, event/observation/
  policy-deadline distinctions and available operational versions. No notes, interpretation,
  identity mappings, arbitrary logs or queries. No automatic audit polling.
- Checklist: read-only owner run selection, compact requirement table and expandable evidence;
  implementation, current-run results and recorded/configuration evidence stay distinct.
  Admin capability is described without exposing staff events to the student API.
- Shared design: light theme, navy typography, restrained teal, consistent controls/cards,
  active navigation, compact notices, keyboard focus, empty/error/session states and contained
  responsive tables. This is C1 integration scaffolding, not C4 dashboard research or a
  validated usability result.

The reviewed record content is never saved to localStorage/sessionStorage. In-memory views
are snapshots: refreshed/opened operations recheck policy; failures clear protected selection.
The UI does not claim instantaneous push revocation. Server requests remain denied after
withdrawal even if an older snapshot had been displayed before refresh.

## Exact changed files and compatibility

| Area | Files |
| --- | --- |
| Backend | `services/orchestrator/main.py`, `auth.py`, new `operations.py` |
| Authoritative contracts | `packages/contracts/src/research_contracts/__init__.py` |
| Generated schemas | `packages/contracts/json-schema/v1/{AdminAuditItem,AdminAuditPage,AdminCaseOperations,ReviewQueueItem,ReviewQueuePage,LifecycleAuditEvent}.json` |
| Generated consumers | `packages/contracts/openapi/orchestrator.v1.json`, `packages/typescript-common/src/contracts.d.ts` |
| Shared clients/presentation | `packages/typescript-common/src/{api.ts,proxy.ts,ui.tsx,styles.css}` |
| Counsellor/admin | `apps/counsellor-dashboard/app/page.tsx`, new `app/admin/page.tsx`, `app/api/v1/[...path]/route.ts` |
| Student/checklist | `apps/student-portal/components/{student-lifecycle.tsx,demo-checklist.tsx,checklist-rules.ts}` |
| Backend regression | new `tests/integration/test_operations.py` |
| Frontend regressions | new `tests/frontend/admin-evidence.test.tsx`, updated `pp1-behaviour.test.tsx`, `review-record.test.tsx`, `session-client.test.tsx` |
| Browser verification | `scripts/pp1_browser.mjs`, `scripts/session_browser.mjs` |
| Guidance/evidence | `readme.md`, `docs/api/contracts.md`, `docs/security/{rbac,authentication,audit-catalogue}.md`, `docs/governance/source-review.md`, `docs/evidence/{c1-demo-checklist,c1-fr09-review-record,c1-pp1-requirements-audit,c1-workspace-audit,c1-workspace-verification}.md` |

Two additive APIs: `/review-queue` and `/admin/audit-events`. Existing task/action/record,
consent and withdrawal APIs remain available. New `ADMIN_EVIDENCE_ACCESS` event uses the
existing audit table, deduplicated once per validated session row; no new migration or
existing-row mutation is needed. The schema remains `f310c1000003`. Strict event-union
consumers must regenerate for the new type. C2–C4 wire schemas/providers remain unchanged;
coordinate review before merging shared artifacts.

Admin uses `j26_admin_access` / `j26_admin_refresh`; its proxy maps `/admin-auth/*` to the
existing backend auth routes. Same server-side signature, role, revocation, CSRF and refresh
checks apply. Shared-client renewal uses a separate admin promise/lock and a single retry.
Canonical direct API cookies stay unchanged. Namespaced cookies prevent accidental selection
collisions, not compromise of an application sharing the same host.

No token lifetimes were extended: access 300 seconds; refresh 3600 seconds; student owner
and consent fixed at one hour. Refresh cannot extend consent. Staff refresh retains its
existing rolling-hour policy. Cookie attributes remain HttpOnly, host-only, Path=/api/v1,
SameSite=Strict and Secure=false for local HTTP. Real TLS/at-rest encryption are unverified.

## Actual verification

| Check | Result |
| --- | --- |
| Pre-edit full backend / frontend baseline | 164 / 48 passed |
| Focused backend operations/auth/FR09 increment | 61 passed before the added pagination/date-boundary case |
| Full backend, including security/contracts/withdrawal/migrations | **183 passed** |
| Final frontend, including admin role/refresh/isolation | **52 passed** |
| Frontend lint / both app TypeScript | Passed |
| Python/TypeScript contract drift | Passed |
| Affected C1 Python Ruff check / format | Passed |
| Full-repository Ruff baseline | **63 existing C3 findings**, preserved; no clean global-lint claim |
| Repository privacy/prohibited-file scan | Passed in Python UTF-8 mode |
| PostgreSQL harness | **13 passed**, including case locking, review disposal and migration round trip in a verified generated schema |
| Preserved database schema | `f310c1000003 (head)`; no new upgrade operations detected |
| Docker production image builds / startup | Backend and both apps built; nine services healthy; existing volume preserved |
| Final Docker smoke | Passed, including concurrent idempotency, authorized human review, record save/read/replay, retention/withdrawal/disposal, logout, proxies and log privacy |
| Three-profile browser | **Passed in 18.639 seconds**, ten scenarios and 21 sanitized screenshots; see retained artifacts below |
| Natural five-minute expiry browser | **Passed in 317.978 seconds** (5 minutes 18 seconds), preserving expiry/replay policies |

Verification limitations/failures retained honestly:

- Global Ruff remains blocked by the same 63 C3 findings; they were not auto-fixed or suppressed.
- The first new test lint run detected fixture-import redefinition; using pytest plugin fixture
  registration corrected it before the passing runs.
- A final smoke initially failed because the redesigned counsellor footer lost the required
  DEVELOPMENT ONLY text. It was restored; the assertion was retained and rerun.
- One browser attempt reached post-withdrawal admin logout before its asynchronous request
  completed. The harness now waits for the completed logout state before asserting 401.
  That attempt is not counted as passing. Its directory is
  `.local/c1-workspace-browser-fe529c4a-50e8-4609-9ff5-9f301b46c012/`.
- The first inspected screenshots came from
  `.local/c1-workspace-browser-851b546a-8159-4de7-90e0-6cfef170fd4f/`; the final captures
  below supersede them for the final labels/timestamps. No fabricated screenshots or timings.

Final three-profile artifact directory:
`.local/c1-workspace-browser-5ee84382-f7f3-47be-8ef1-79af744c7446/`.
`report.json` records actual checks and elapsed time. Screenshots include desktop and 390px
mobile student, counsellor saved review, admin event explorer and the mobile checklist.
Review interpretation text is temporarily withheld during capture; the preceding browser
assertions verify actual protected retrieval. No credentials are visible. Body-width assertions
passed; wide tables scroll inside their containers. Modal focus/cancel/return, immutable record,
invalid synthetic marker, refresh/re-login reopening, role denial, admin filters, withdrawal,
admin disposal receipts/logout, multi-run selection and injected stale HTTP 503 all passed.

Suggested sanitized images to retain outside Git:

- `student-desktop.png`, `student-mobile.png`
- `counsellor-saved-review-desktop.png`, `counsellor-saved-review-mobile.png`
- `admin-events-desktop.png`, `admin-events-mobile.png`
- `demo-human-review-observed.png`, `demo-checklist-mobile.png`

Browser profile directories remain ignored local test material and must not be shared or
committed. Copy only reviewed sanitized images/aggregate reports when preparing PP1 evidence.

Natural-expiry report:
`.local/c1-session-browser-ebc1212f-4a44-426f-987e-ef5497db0096/report.json`.
The harness waited at least 310 seconds with actual server lifetimes and separate profiles,
then exercised concurrent student/demo recovery, counsellor reload, FR09 save/read, safe
student receipt, review completion, withdrawal/disposal and logout. The report field
`expiry_wait_seconds=315.286` includes post-wait assertions; it is not idle duration alone.
Observed request sequence was 401 AUTH_REQUIRED, /auth/me 401, /auth/refresh 200, original
retry 200. The other student tab recovered after /auth/me 200 without another rotation.
Browser UTC was 2026-10-24T02:14:27.883Z; coarse HTTP Date Sat, 24 Oct 2026 02:14:27 GMT
gave approximate difference -0.876 seconds including header/transport granularity. No
five-minute clock discrepancy was observed. Admin renewal concurrency is separately covered
by the new frontend test; the natural-expiry walkthrough does not claim a timed admin session.

### Reproducible commands

Run from `F:\Reserch\J26-SE-338`. Use fresh pytest basetemp names for repeats; no existing
temporary folders were removed and no permissions changed. Check each command's exit code.

```powershell
.venv/Scripts/python.exe scripts/run.py pytest -o addopts='' -q --basetemp=.local/pytest-c1-redesign-baseline-20261024-a
$env:PATH = (Resolve-Path '.local/node-runtime/node_modules/node/bin').Path + ';' + $env:PATH
npm test -- --maxWorkers=1
.venv/Scripts/python.exe scripts/run.py pytest tests/integration/test_operations.py tests/security/test_auth.py tests/integration/test_review_records.py -o addopts='' -q --basetemp=.local/pytest-c1-operations-20261024-a
.venv/Scripts/python.exe scripts/run.py pytest -o addopts='' -q --basetemp=.local/pytest-c1-redesign-full-20261024-a
.venv/Scripts/python.exe scripts/run.py scripts.generate_contracts
npm run contracts:types
.venv/Scripts/python.exe scripts/run.py scripts.generate_contracts --check
npm run contracts:check
npm run lint
npm run typecheck
.venv/Scripts/python.exe -m ruff check services/orchestrator packages/contracts/src tests/integration/test_operations.py
.venv/Scripts/python.exe -m ruff format --check services/orchestrator packages/contracts/src tests/integration/test_operations.py
.venv/Scripts/python.exe -m ruff check --statistics .
.venv/Scripts/python.exe -X utf8 scripts/check_repository.py
docker compose build orchestrator student-portal counsellor-dashboard
docker compose up -d --no-build --wait --wait-timeout 180
docker compose config --quiet
docker compose exec -T orchestrator alembic check
docker compose exec -T orchestrator alembic current
.venv/Scripts/python.exe scripts/run_evaluation.py postgres
.venv/Scripts/python.exe scripts/compose_smoke.py
node scripts/pp1_browser.mjs --operations
node scripts/session_browser.mjs
git diff --check
git status --short --branch
git diff --cached --name-only
```

The PostgreSQL harness validates current_schema() before migrations and its disposable
downgrade; no downgrade/reset was performed on the development schema. Performance/model
evaluations were not rerun. Historical 29-event audit catalogue ratios do not establish
coverage of the new admin event. Direct/raw concurrent refresh replay still revokes the
family intentionally; coordinated browser callers avoid that replay.

## Startup and role-by-role walkthrough

Docker Desktop must be running. Preserve the existing ignored `.env`. If this is a fresh
checkout without one, run `./scripts/bootstrap-dev.ps1` to generate local development values;
it preserves an existing file. For the built workspace:

```powershell
docker compose up -d --build --wait --wait-timeout 180
docker compose ps
```

| Role | Confirmed page URL | Demonstration |
| --- | --- | --- |
| Student | http://localhost:3000/ | Read full dev-notice-1, explicitly select acceptance, record consent, submit a built-in fixture, refresh state. No identity or counselling content shown |
| Owner checklist | http://localhost:3000/demo | Same profile as student; refresh and select that consent/run explicitly. Observe only actual scoped events, not an overall pass |
| Counsellor | http://localhost:3001/ | Separate profile; sign in, find pseudonymous case, filter status, open/start, enter SYNTHETIC: observation, select category and save. Refresh or sign out/in, reopen the saved record, then complete review |
| Admin | http://localhost:3001/admin | Third profile; sign in, filter event/type/date/case and inspect safe outcomes/versions. Admin has no review-content privilege |

Privately use DEV_COUNSELLOR_USERNAME/PASSWORD and DEV_ADMIN_USERNAME/PASSWORD from the
ignored setup file; never print, screenshot or publish values. Existing seeded accounts
are preserved. Do not regenerate credentials against the preserved database volume.

Return to the student to withdraw and confirm. Refresh the counsellor queue: protected
content disappears and further reads are denied. Admin still sees permitted minimal
withdrawal/retention receipts and disposal reason, with derived provenance withheld.
Checklist retains safe historical action/save receipts, never interpretation or category.
Logout revokes sessions. Owner session expiry still requires a new synthetic session;
reloading the student form still loses its in-memory case controls. The checklist can
observe owner receipts while authorized but cannot recover an expired owner session.

## Remaining gaps and proposed commits

TAF/Master source re-availability and approved notice/retention/allocation/access policy
remain dependencies. Real identity, TLS, at-rest controls, physical identity-store isolation,
real C2–C4 integration and provider deletion agreements remain pending. Comprehensive denied
request audit coverage, formal threat/residual-risk deliverables, ATAM/modifiability experiments,
full-boundary load/deployability studies and human task evaluation remain unfinished.
No clinical quality, treatment, follow-up execution or complete research result is claimed.
Saved review editing/history is not invented. Snapshot UI is refreshed explicitly; it is
not a push-notification channel. Modern Web Locks support remains required; natural one-hour
expiry/distributed soak was not observed. Full dashboard/XAI research remains C4 ownership.

Suggested logical commit groups, none created:

1. `feat(c1): expose restricted operational evidence and review queue` — backend, central
   generated contracts and authorization/privacy/filter regressions.
2. `feat(c1): redesign role workspaces and saved review navigation` — existing applications,
   shared presentation/clients, admin isolation and frontend tests.
3. `test(c1): verify role workspaces and document requirement evidence` — browser harness,
   source/FR/NFR trace, current evidence, compatibility and startup guide.
