# C1 status mapping, remembered staff sessions and researcher access — 2026-10-25

Branch `feature/c1-consent-orchestration`, baseline HEAD `15f4a81`. Existing readiness-audit
and professional-interface work was already uncommitted and remains preserved. Nothing
was staged, committed, pushed, reset, merged or switched. Before-edit copies for this
increment are in ignored `.local/c1-session-mapping-before-7dff4d72ba244d4c82321d0fb4123bb0/`.

## Requirement and evidence interpretation

The [source-derived readiness audit](c1-final-pp1-audit.md) retains the exact proposed
FR01–FR12/NFR01–NFR10 wording from IT23187450 section 5, Tables 14–15, pp27–28, together
with finalized TAF/Master ownership and evidence scope. These subchecks decompose those
requirements; they are not new institutional acceptance criteria. Academic files remain
outside Git. No research or PP1 approval is claimed.

Every one of the 39 current subchecks was inspected. `Implementation` describes actual
code within its stated scope. Live evidence can independently be Not exercised,
Unavailable/stale or Failed. Recorded test evidence and configuration evidence now have
different labels. Approval, deployment/integration readiness and evaluation gaps have
their own fields. A missing event or stale observation never changes code status.
`Not applicable` below refers only to an application-code status for an external approval
or evaluation-only subcheck; it never means the original requirement has been satisfied.

| Subcheck | Implementation now | Evidence source and exact outstanding boundary |
| --- | --- | --- |
| FR01.a Versioned decision | Implemented | Owner decision receipt when exercised; `main.record_consent`, student notice and shared consent guards. A receipt alone does not prove all guards. |
| FR01.b Approved purpose/notice | Not applicable to code | Development purpose/notice configuration exists; institution-approved notice and stakeholder approval are absent. Approval is pending separately. |
| FR02.a Consent-policy denial | Implemented | A selected-run blocking receipt is needed to show that particular denial; lack of a denial event is not missing enforcement. |
| FR02.b Invalid states/expiry | Implemented | Recorded lifecycle/recovery tests include missing, non-active, wrong purpose/version and exact-expiry cases. No universal future-endpoint coverage claim. |
| FR03.a Pseudonymous case | Implemented | Owner-safe case UUID when submitted; a UUID alone is not anonymity. |
| FR03.b Identity separation | Implemented | Separate Account/Consent/CaseLink versus Case/job records and adapter exclusion tests. Same PostgreSQL owner can access all tables; independent storage privileges and real-data data-flow evaluation remain pending. |
| FR04.a Validated routing | Implemented | Current case's persisted validated mock provenance when allowed by consent/disposal. This is not an independent replay of all calls. |
| FR04.b Real C2–C4 boundary | **Partial** | Real research providers are not connected. Existing mock APIs do not implement text anonymization, trained inference or explanation faithfulness. C1/provider-owner integration remains necessary. |
| FR05 Version/correlation retention | Implemented | Validated service/model/explainer mock lineage for an eligible selected case; real-version compatibility awaits providers. |
| FR06.a Idempotent replay | Implemented | A replay receipt proves an exercised replay; recorded forced recovery/concurrency tests cover separate paths. A first submission exercises neither. |
| FR06.b Retry/failure event | Implemented | Actual retry/failure receipt only when that event exists; normal successful processing does not exercise failure handling. |
| FR06.c Bounds/timeouts/safe failure | Implemented | Recorded adapter/reliability/PostgreSQL tests; not a successful fast-call timing or complete fault-soak study. |
| FR07 Authorized task | Implemented | Current matching task/assignment/consent/provenance observation. MANUAL policy intentionally leaves new tasks unassigned until an admin acts. |
| FR08.a Owner access | Implemented | A successful owner-scoped evidence request verifies that positive request only. |
| FR08.b RBAC/foreign case | Implemented | Recorded negative role/owner tests. Existing development matrix still needs institutional approval. |
| FR09.a Start review | Implemented | Persisted authorized START_REVIEW receipt, not processing completion. |
| FR09.b Complete review | Implemented | Persisted authorized COMPLETE_REVIEW receipt, not a diagnosis or proof of a saved interpretation. |
| FR09.c Saved-record receipt | Implemented | Safe save timestamp only; never interpretation/category contents or a claim that outreach occurred. Disposal leaves a historical receipt. |
| FR09.d Interpretation/follow-up | Implemented | Protected assigned save/retrieve capability; one immutable synthetic record, no editing workflow or clinical advice. Approved human task evaluation remains pending; C4 final UI research remains separate. |
| FR09.e Record authorization/disposal | Implemented | Recorded integration/frontend assertions; actual current-run denial/disposal must be separately observed. |
| FR10.a Explicit withdrawal | Implemented | Owner withdrawal receipt; retention/expiry alone is not explicit withdrawal. Institutional retention/withdrawal policy approval remains pending. |
| FR10.b Disposal | Implemented | Local retention receipt plus cleared outputs/jobs/assignment state. Real remote provider/backup deletion assurance awaits integration/deployment. |
| FR10.c Post-withdrawal denial | Implemented | Recorded withdrawal/security tests; disposal alone is not proof a later denied request occurred in a selected run. |
| FR11.a Scoped lifecycle receipts | Implemented | Allowlisted persisted events; a bounded receipt list is not a complete audit-coverage metric. |
| FR11.b Append-only/text exclusion | Implemented | Trigger/privacy/trace tests. Database operators remain trusted; no cryptographic tamper-evidence claim. |
| FR12 Administrative evidence | Implemented | ADMIN-only bounded operational APIs/UI; no selected-run admin-visit inference, counselling content or identity mappings. |
| NFR01 Privacy boundaries | Implemented | Synthetic adapter/log/identity-exclusion tests. This bounded C1 mechanism is not real text anonymization, which belongs to C2; real-provider/privacy evaluation is pending. |
| NFR02.a Resource authentication | Implemented | Authenticated owner/role/assignment checks; broader deployment least privilege still needs review. |
| NFR02.b TLS | **Missing** | The actual Compose deployment is localhost HTTP, including downstream transport. Secure-cookie configuration is not a TLS implementation. |
| NFR02.c Storage encryption | **Unverified** | No retained storage/host encryption and key-management evidence. Neither PostgreSQL nor Docker nor an approval alone establishes it. No encryption implementation is asserted. |
| NFR03 Consent enforcement | Implemented | Recorded state/recovery tests; this is not a selected-run exercise of every state/operation. |
| NFR04 Audit coverage | Implemented logging; evaluation unmeasured | Historical 29-observation catalogue predates staff/assignment/admin-access/review-save changes. Expand and measure the current event universe; not every denial has a durable event. No new coverage percentage/reconstruction completeness is claimed. |
| NFR05 Contract compatibility | Implemented for current mocks | Recorded schema drift and negative request/response tests. Real-provider payload/version/error/provenance compatibility awaits joint integration, separately stated at FR04.b/readiness. |
| NFR06 Reliability | Implemented bounded mechanisms | Recorded fault/concurrency tests; distributed soak, real provider failures and wider evaluation remain separate. |
| NFR07 C1 latency target | **Partial** | Existing core proxy excludes HTTP/authentication/queue boundaries. Full-boundary measurement tooling and repeated evaluation against the proposed target are incomplete. No new latency value is invented. |
| NFR08 Modifiability experiment | Not applicable to code | Contracts/adapters already exist. The controlled version-change/ATAM-style experiment is missing; this is an outstanding evaluation, not a passed result. |
| NFR09 Deployment/secrets | Implemented local bootstrap | Recorded bootstrap/health evidence; clean private-deployment time within the proposed 30 minutes has not been measured and institutional deployment is not established. |
| NFR10.a Human review receipt | Implemented | Actual completion receipt when present; it does not prove clinical validity, usefulness or usability. |
| NFR10.b Screening-support boundary | Implemented | Non-diagnostic, counsellor-assisted disclosures and no autonomous decision; approved human suitability/task evaluation is pending. |

Six group summaries now state the actual boundaries:

| Group | Code summary | Specific remaining items |
| --- | --- | --- |
| Consent and purpose | Implemented | Notice approval pending separately. |
| Pseudonymous identification | Implemented logical separation | Independent storage isolation and real-data evaluation pending; C2 text anonymization separate. |
| Authentication/roles/assignment | **Mixed** | Role/owner/assignment controls implemented; deployment TLS Missing; storage encryption Unverified. |
| Orchestration/provenance | **Mixed** | C1 mock-contract orchestration implemented; real C2–C4 integration Partial. |
| Withdrawal/retention | Implemented locally | Institutional policy approval and remote/backup deletion assurance pending. |
| Audit/accountability | Implemented logging/records | Expanded audit coverage unmeasured. |

The previous audit's NFR05 Partial badge is refined into implemented current mock-contract
behaviour plus the real integration dependency. Historical audit/test records are retained;
they are not rewritten into new evaluation results. No blanket green status or completion
percentage is introduced.

## Session behaviour and minimal profile

Remember me is a native labelled checkbox, unchecked by default, in the shared staff form
used by counsellor, admin and researcher logins. Both values reach `LoginRequest` as strict
booleans. The running service reports access **300 s**, ordinary refresh **3600 s**, checked
remembered session **604800 s (7 days)**. `REMEMBERED_SESSION_SECONDS` is configurable within
3600–2592000 s. Checked issuance fixes an absolute family deadline; all rotations retain
it and set refresh-cookie Max-Age to the remaining interval. Account expiry can shorten
the session. Unchecked preserves the pre-existing rolling one-hour session and persistent
cookie behaviour. It did not previously mean an in-memory-only browser cookie.

Tokens remain HttpOnly, SameSite=Strict, host-only and scoped to `/api/v1`. Proxy namespaces
remain student/counsellor/admin/research. Current loopback HTTP has `Secure=false`;
`COOKIE_SECURE=true` is honoured in configuration tests but TLS deployment is still missing.
Rotation, replay-family revocation, CSRF, shared-client single retry/Web Locks, logout and
staff-change revocation remain. No tokens/passwords enter browser storage or UI responses.
Student owner/consent deadlines are unchanged; staff refresh cannot bypass withdrawal,
expiry, disposal or assignment. Profile revalidation clears its protected state; logout
invalidates pending profile reads and prevents focus from silently restoring it.

New staff-only `/api/v1/auth/profile` / UI `/account?workspace=research|admin|counsellor`
show only own ID, role, enabled flag, creation/account-expiry metadata, remembered flag and
current session deadline. No guessed name/email, login handle, credential, family ID,
student identity or case content. Account menu supports profile/sign-out, arrows, Home/End,
Escape/focus return and outside dismissal. No browser-persisted profile copy.

One unique local RESEARCHER account was created through `scripts/provision_staff.py`.
Credentials were written exclusively to its existing ignored `.local/staff-<random>.env`
mechanism, with no value output. Existing staff roles, enabled flags and credentials were
not changed. Sign in at `http://localhost:3001/research`; use its account menu for profile.
It may read directory mock/provider metadata and its own account profile. Backend tests
deny admin overview/staff/audit, counsellor queues/records and owner demo data with 403.
The browser also confirmed cross-realm admin/review requests fail (401 without that realm's
cookies). Navigation alone is not the security boundary. No C2–C4 research page is connected,
and dataset/annotation/training/clinical access is not granted. No new approved role matrix
is implied; the existing limited development policy is preserved.

## Files and compatibility

| Area | Files changed in this increment |
| --- | --- |
| Mapping/rendering | `apps/student-portal/components/checklist-rules.ts` and `demo-checklist.tsx`; `tests/frontend/{c1-demo,privacy-progress-dialogs,staff-persistence}.test.tsx`; NFR05 browser expectation in `scripts/pp1_browser.mjs`. |
| Server session/profile | `services/orchestrator/{auth,main}.py`; `packages/python-common/src/research_common/{config,database}.py`; additive `infrastructure/database/migrations/versions/f310c1000004_remembered_sessions.py`; `.env.example`; `docker-compose.yml`. |
| Contract source/generated consumers | `packages/contracts/src/research_contracts/__init__.py`; LoginRequest/new StaffProfile JSON Schema; orchestrator OpenAPI; `packages/typescript-common/src/contracts.d.ts`. No C2–C4 wire changes. |
| Staff UI | Shared `ui.tsx` and `professional.css`; counsellor/admin/research login handlers; `components/admin-console.tsx`; new `app/account/page.tsx` and `components/account-profile.tsx`; visual-shell menu assertions. |
| Verification | New `tests/security/test_remembered_sessions.py`, legacy-session case in `tests/integration/test_lifecycle_migration.py`, persistent-default-profile `scripts/staff_session_browser.mjs`. |
| Documentation | This note, checklist, README, authentication, database, contracts and governance source-review notes. Earlier interface/audit edits are preserved separately. |

Optional `remember_me=false` keeps old login callers valid; independent strict consumers
must regenerate before sending the additive field. AccountResponse and C2–C4 schemas stay
unchanged. New profile fields have a separate response model. Migration 0004 leaves legacy
sessions ordinary with null absolute deadline; no published migration was modified.

Startup applied 0004 to the preserved PostgreSQL volume. **Before and after migration,
before new test fixtures**, counts matched: 273 accounts, 558 sessions, 294 consents,
141 cases, 10 review records and zero researchers. Only then was the one researcher
provisioned. `alembic current` reports `f310c1000004 (head)` and `alembic check` reports no
new operations. Verification adds only synthetic fixtures and normal auth/audit events.

## Actual verification

Commands run from the repository root on 2026-10-25. For host npm/browser commands, prepend
the installed local Node directory to PATH in PowerShell:

```powershell
$env:PATH = (Resolve-Path '.local/node-runtime/node_modules/node/bin').Path + ';' + $env:PATH
```

| Command | Actual result / scope |
| --- | --- |
| `.venv/Scripts/python.exe scripts/run.py pytest -o addopts='' -q --basetemp=.local/pytest-c1-remember-full-20261025-a` | **241 passed, 152.10 s**, all backend/security/contract/withdrawal tests before the additional legacy-session migration regression. Uses unique disposable SQLite fixtures and controlled clocks. |
| `.venv/Scripts/python.exe scripts/run.py pytest tests/integration/test_lifecycle_migration.py -o addopts='' -q --basetemp=.local/pytest-c1-session-migration-20261025-b` | **2 passed, 1.27 s**, including the added legacy expiry/revocation/family/hash preservation case. No retained-volume downgrade. |
| `.venv/Scripts/python.exe scripts/run.py pytest -o addopts='' -q --basetemp=.local/pytest-c1-remember-full-20261025-b` | Final full suite **242 passed, 166.43 s**, including the added migration regression. No skipped/failing cases reported. |
| `npm test` | Final **85 passed / 12 files, 15.79 s**. Includes all-role checked/unchecked requests, mapping independence/mixed states, menu keys, profile revalidation/cleanup and existing renewal/consent/review UI tests. Earlier same-increment run: 85 passed in 12.49 s. |
| `npm run lint`; `npm run typecheck`; `npm run contracts:check` | Passed, both Next applications and generated TS drift. |
| `.venv/Scripts/python.exe scripts/run.py ruff check services packages scripts tests infrastructure`; same scopes with `ruff format --check` | Passed; 68 Python files formatted. |
| `.venv/Scripts/python.exe scripts/run.py ruff check .` | **Fails: 63 existing C3 notebook/source issues**, outside this increment. C3 files were not modified. Scoped C1/shared checks above pass; repository-wide lint is not claimed clean. |
| `.venv/Scripts/python.exe scripts/run.py scripts.generate_contracts --check`; `scripts/check_repository.py`; `scripts/check_ci.py` through the same Python interpreter | Passed contract artifacts, prohibited/credential/frontend-privacy candidate scan, and CI structure. Hosted CI was not executed. |
| `docker compose -f docker-compose.yml -f docker-compose.demo.yml build orchestrator student-portal counsellor-dashboard` | Passed, including both production Next builds and their route/type checks. |
| `docker compose -f docker-compose.yml -f docker-compose.demo.yml up -d --no-build --wait --wait-timeout 180` | All nine containers healthy; manual assignment override preserved. No volume deletion. |
| `docker compose config --quiet`; `docker compose exec -T orchestrator alembic current`; `docker compose exec -T orchestrator alembic check` | Passed; head 0004 and no metadata drift. Config values were not dumped. |
| `.venv/Scripts/python.exe scripts/run_evaluation.py postgres` | **13 passed**, unique disposable schema removed by its existing isolation-checked harness; queue/concurrency/withdrawal/migration/review-record checks. Aggregate `.local/c1-postgres.json`; no development-table downgrade. |
| `.venv/Scripts/python.exe scripts/compose_smoke.py` | **PASS** real service/DB/Redis/worker health, C1–C4 mock workflow, concurrent idempotency, manual assignment, saved review/replay/safe receipt, retention/withdrawal revocation, logout, proxy and log privacy. |
| `node scripts/staff_session_browser.mjs --staff-file <private-researcher-file>` | Final **PASS 9.452 s**, Edge 155.0.4283.62. Real default-profile browser close/relaunch, checked continuity and logout persistence, access-cookie-loss renewal, unchecked one-hour restart baseline, all-role sign-in, researcher profile/nav/denials; all 39 served subchecks and all six summaries. |
| `git diff --check`; `git diff --cached --name-only`; `git status --short --branch`; `git log -1 --oneline` | No whitespace errors; staging remains empty; original feature branch and baseline HEAD unchanged. Existing and new work stays uncommitted. Git reports Windows CRLF normalization warnings for some working files; no corresponding semantic schema change is inferred. |

The final browser report and two safe directory/profile screenshots are retained in ignored
`.local/c1-remember-browser-801adfaf-67ea-4279-bfeb-806e504e27dd/`. Its predecessor restart-only
run also passed in **8.990 s**, `.local/c1-remember-browser-15e55685-9a1f-4816-821d-182d5ed019ca/`.
One intervening harness extension failed because it expected student ownership before
the actual consent-choice action; the harness was corrected to record a synthetic declined
choice through the UI. This was a harness assumption, not an application fix. Final
mapping checks intentionally use **no selected run** to verify code status stays independent
of live-event absence. No credential-filled screenshots, cookie values or traces retained.

These are actual process restarts within seconds, **not** a natural seven-day or full-hour
test. Backend tests use signed expired access tokens and controlled deadline equality;
browser access-cookie removal separately exercises renewal. The retained historical
321.969-second five-minute continuity run remains historical, not a new long-duration run
of this increment. Production TLS/storage encryption, institutional approval, actual
provider integration, human evaluation and wider audit/performance/change experiments
remain unverified or outstanding as described above. The earlier headless re-enable
input caveat is unchanged; this increment does not modify existing staff accounts to
re-run that mutation scenario.

## Local walkthrough

1. Start the existing manual demo Compose stack as in README. Student uses port 3000;
   staff uses 3001. Prefer separate profiles for clear roles; namespaces remain intact.
2. Open `/research`, privately read the one provisioned ignored credential file, check
   Remember me if wanted and sign in. The landing page honestly labels all three providers
   as mocks without connected research pages. Open Account profile from the menu.
3. Close and reopen the browser using the same non-private profile, return to `/research`,
   and verify directory access. Logout and reopen again: sign-in is required. Do not copy
   credentials or cookies into slides/screenshots. Unchecked retains its existing one-hour
   persistence; browser privacy settings can independently discard cookies.
4. In the student profile, record a fictional choice and open `/demo` in the same profile.
   Inspect implementation separately from selected-run/recorded-test/configuration evidence.
   Access and routing show Mixed; view their exact missing/integration items. Notice
   approval, storage isolation and evaluation remain visible separately.
5. Existing synthetic submission → admin manual assignment → assigned counsellor review
   → saved record → owner withdrawal remains the established demonstration. A remembered
   session does not authorize an unassigned, withdrawn, expired or disposed case.

All outputs remain screening support with authorized, counsellor-assisted human interpretation.
The system does not replace professional counselling. No clinical or research outcomes are
created by this change.
