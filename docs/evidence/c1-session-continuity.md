# C1 session continuity — 2026-10-22

Branch: `feature/c1-consent-orchestration`, based on `8a9d773`. Existing uncommitted
checklist work was preserved. All changes remain unstaged/uncommitted; no push, merge,
reset, branch switch, database migration or expiry-setting change was performed.

## Confirmed causes

The prior generic 403 text was not evidence that consent expired. Source inspection and
a real Edge baseline run lasting **312.76 seconds** confirmed distinct failure paths:

| Failure | Evidence | Change |
| --- | --- | --- |
| Localhost cookie collision | Signing into counsellor in the student's browser context changed `/auth/me` to COUNSELLOR; `GET /api/v1/demo/runs` returned **403 FORBIDDEN** | Application-specific browser cookie names; each server proxy forwards only its own pair |
| Concurrent refresh rotation | Two same-context tabs issued refresh concurrently after natural access expiry: `POST /api/v1/auth/refresh` returned **200** and **401 AUTH_INVALID**; subsequent `GET /api/v1/auth/me` returned **401 AUTH_INVALID** | Same-tab promise plus same-origin Web Lock; probe current session inside lock before rotating |
| `/auth/me` refresh bypass | Counsellor reload after five minutes showed sign-in despite an unexpired refresh cookie; old client excluded all `/auth/` routes from renewal | `/auth/me` now renews like other protected reads; original request retries once |
| Ambiguous errors | Old client mapped every 403 to authorization-or-consent wording | Allowlisted safe error codes distinguish authentication, request authorization, consent policy, throttling and service/network failure |

Replay-family revocation is intentional server security behavior. It remains unchanged;
the client now avoids accidentally replaying a rotated credential. The collision overwrote
browser cookie selection, not the other account's database records. These defects were
reproduced with synthetic sessions; this is not a forensic claim about unavailable historical
traffic from the user's original incident.

Baseline report: ignored
`.local/c1-session-browser-ee0efc48-5c0a-4e31-b310-3191c85fd8ae/report.json`.
The first harness attempt stopped during reset between its collision and expiry scenarios;
it was corrected and rerun. Only the successful full run is counted above.

## Actual lifetimes and cookies

Running orchestrator settings were read through a narrow print of non-secret fields:
`access_seconds=300`, `refresh_seconds=3600`, `cookie_secure=false`.

| Item | Actual policy |
| --- | --- |
| Access JWT | 300 seconds from issue; signature, issuer, audience, timestamps and session revocation checked |
| Access cookie | Max-Age=300 |
| Refresh/session record | 3600 seconds from issue; student record capped at owner-account expiry |
| Refresh cookie | Max-Age=3600, even when the student's remaining server deadline is shorter |
| Student owner account | One hour from creation, fixed; refresh does not extend it |
| Consent | Same fixed expiry as that owner account; refresh never changes status or expiry |
| Staff refresh | Existing rolling one-hour session on rotation; no absolute staff-session cap is claimed |

Before: both apps used `j26_access` and `j26_refresh`. After: student uses
`j26_student_access` / `j26_student_refresh`; counsellor uses
`j26_counsellor_access` / `j26_counsellor_refresh`. All remain host-only (no Domain),
Path `/api/v1`, HttpOnly, SameSite=Strict. Local HTTP uses Secure=false; existing
`COOKIE_SECURE=true` remains necessary for future HTTPS. Localhost ports do not isolate
cookies; the new names and proxy filtering isolate application session selection.
This is not isolation from a compromised application sharing the same host.

No token or credential was printed. Direct orchestrator/API clients retain the canonical
cookie names. Both Set-Cookie headers, including logout deletions and security attributes,
are translated by the server proxy. Arbitrary Authorization and other-app/legacy cookies
are not forwarded. Responses are no-store; upstream URLs remain server configuration.

The baseline browser UTC was `2026-10-22T10:44:07.834Z`; the HTTP Date was
`Thu, 22 Oct 2026 10:44:06 GMT` (approximate difference -1.831 seconds). HTTP Date is a
coarse observation including transport/server header granularity, not precision clock sync.
No five-minute clock discrepancy was observed. All server deadlines use UTC.

## Refresh and error behavior

Protected 401 -> acquire shared browser lock -> probe `/auth/me` -> if still 401, rotate
once -> retry original request once. A late 401 from an old request probes the now-valid
session and retries; it does not consume another refresh token or clear refreshed cookies.
The same-tab renewal promise is independent of an individual polling request's cancellation.
Aborted callers cannot cancel the shared rotation; they do not retry their original request.
Lock acquisition and renewal requests have bounded timeouts. Unsupported Web Locks browsers
fail closed with an explanatory error rather than racing refresh credentials.

Login, logout and new student-session issuance use the same origin lock. Logout waits for
an already-running refresh and then revokes the resulting family; new refresh requests cannot
restore it. Raw/direct API replay still revokes the family. No refresh token is stored in
localStorage, sessionStorage, URL parameters, messages or browser flags.

The checklist, student form and counsellor UI use the shared client. Polling does not bypass
it. The student form no longer implements a second manual refresh after `/auth/me`; it creates
a new synthetic owner only when that authenticated check ultimately returns 401. A 503 does
not create a replacement identity. A fresh owner does not recover an expired owner's cases.

- 401 AUTH_REQUIRED/AUTH_INVALID after renewal: session ended; sign-in/new synthetic run needed.
- 403 FORBIDDEN: request authorization/role/CSRF denial; no consent-expiry inference.
- 403 CONSENT_REQUIRED/CONSENT_INVALID: consent-policy block; refresh lifecycle for actual status.
- 404 NOT_FOUND: inaccessible resource; do not expose existence/ownership of another case.
- Network/503: service/connection problem; no consent-withdrawal claim.
- 429: throttle message; no refresh loop.

Neither 403 nor consent state triggers renewal. Withdrawn/expired/rejected consent remains
blocked after successful token refresh. Checklist failures clear live evidence and stop
protected polling. Counsellor failures clear cached tasks/selected evidence; only genuine
401 ends the established sign-in state. Initial session-check network failures show a
connection-specific error instead of claiming consent withdrawal.

## Changed files and compatibility

| Files | Change |
| --- | --- |
| `packages/typescript-common/src/api.ts` | Coordinated renewal, `/auth/me` continuity, one retry, safe error-code messages |
| `packages/typescript-common/src/proxy.ts`, `package.json` | Shared server proxy and export |
| Both `apps/*/app/api/v1/[...path]/route.ts` and `next.config.mjs` | Namespaced GET/POST proxy routes replace transparent rewrites |
| Student `components/student-lifecycle.tsx`, `demo-checklist.tsx` | Reuse shared renewal, distinct stale failure messages, current isolation notice |
| Counsellor `app/page.tsx` | Explain initial session-check failures |
| `tests/frontend/setup.ts`, `session-client.test.tsx` | Browser lock model, concurrency/late response/logout/errors/proxy regression tests |
| `tests/security/test_session_continuity.py` | Controlled synthetic access expiry, owner/review continuity, invalid consent and expired/revoked refresh |
| `scripts/session_browser.mjs` | Reproducible baseline/fixed real-clock browser walkthrough; allowlisted status-only report |
| Authentication/trust-boundary docs, README and checklist evidence note | Cookie migration, lifetimes, startup and limitations |

No backend session schema or wire contract changed in this task. Earlier uncommitted
checklist contracts remain intact. The browser-facing cookie-name migration requires a
**one-time new student session and counsellor sign-in**; legacy cookies are ignored, not
silently reassigned between applications. Existing legacy database sessions remain subject
to their existing bounded expiry/revocation policies. Backend direct-client compatibility
and server-side replay protection are preserved.

## Verification

- **139 backend tests passed**; focused authentication/continuity run: **25 passed**.
  Tests expire only synthetic JWTs/session records, not global production lifetimes.
- **45 frontend tests passed**, including same-tab and independently imported tab clients,
  late 401, invalid refresh, at-most-one retry, logout serialization, 403 code mapping,
  network failure, proxy cookie filtering/attributes and unsupported-lock behavior.
- Frontend lint and TypeScript passed; contract drift passed; affected Python Ruff passed.
- Repository scan passed with Python UTF-8 mode. Without `-X utf8`, the Windows CP1252
  scanner encountered Unicode text; no permission or repository guard was disabled.
- Existing **63 unrelated C3 Ruff findings** reproduced unchanged.
- Both frontend production images built; nine containers healthy; existing Docker smoke
  passed workflow, concurrency/idempotency, review, withdrawal/retention/logout, frontend
  proxies and container-log privacy.
- A controlled browser test passed in **6.865 seconds**, deleting only synthetic access
  cookies through CDP while preserving refresh credentials/server settings. It verified
  simultaneous owner/demo recovery, same-profile cookie isolation, counsellor reload/review,
  withdrawal and logout. Report:
  `.local/c1-session-browser-b87f9c98-4c3b-4ac6-8301-e1d4e7759361/report.json`.
  This short check is not counted as the required real-clock boundary test.
- The first fixed-build long run failed an assertion after its five-minute wait, before the
  harness had step-specific diagnostics. It is not counted as passing evidence. The harness
  now records granular stages and allowlisted response codes on failure. Its cause remains
  unattributed; the later successful run does not retrospectively count that attempt as passing.
- **Final real-clock Edge walkthrough passed in 317.017 seconds (5 minutes 17 seconds)**,
  using separate student/counsellor browser contexts and a second student tab. The harness
  waited at least 310 seconds without changing expiry settings. It verified owner and demo
  continuity, counsellor reload and review completion, withdrawal and logout. A separate
  same-context counsellor login also preserved the student's role and demo access.
  Report: `.local/c1-session-browser-8b687583-0f7b-4620-add8-9660a82142df/report.json`;
  screenshot: `session-after-refresh-review.png` in that directory.
  The safe observed sequence was owner resource **401 AUTH_REQUIRED**, session probe
  **401 AUTH_REQUIRED**, refresh **200**, original request **200**. The other student tab's
  expired request recovered after a **200** session probe, without another rotation.
  Resource paths in the report are normalized to exclude identifiers. Browser UTC was
  `2026-10-22T10:59:25.912Z`, HTTP Date `Thu, 22 Oct 2026 10:59:25 GMT`; approximate
  difference was -0.906 seconds, subject to the same coarse-clock limitations above.
  The report's `expiry_wait_seconds=315.021` includes post-wait assertions; it is not a
  measurement of idle time alone.
- The normal PP1 browser walkthrough also passed all seven scenarios: rejection, mobile
  withdrawal dialog handling, fresh submission, authorized review, withdrawal access
  revocation, ended-session messaging and multiple-run/stale-response handling. Report and
  14 screenshots: `.local/c1-demo-browser-a46f5c16-683a-4f8c-8fd9-f98210ca8684/`.

Commands executed from repository root (check each exit code):

```powershell
$env:PATH = (Resolve-Path '.local/node-runtime/node_modules/node/bin').Path + ';' + $env:PATH
node scripts/session_browser.mjs --baseline
.venv/Scripts/python.exe scripts/run.py pytest tests/security/test_session_continuity.py tests/security/test_auth.py -o addopts='' -q --basetemp=.local/pytest-session-20261022-a
.venv/Scripts/python.exe scripts/run.py pytest -o addopts='' -q --basetemp=.local/pytest-session-full-20261022-b
npm test
npm run lint
npm run typecheck
npm run contracts:check
.venv/Scripts/python.exe scripts/run.py scripts.generate_contracts --check
.venv/Scripts/python.exe -m ruff check tests/security/test_session_continuity.py
.venv/Scripts/python.exe -X utf8 scripts/check_repository.py
git diff --check
docker compose build student-portal counsellor-dashboard
docker compose up -d --no-build --wait --wait-timeout 180
.venv/Scripts/python.exe scripts/compose_smoke.py
node scripts/session_browser.mjs --quick-expiry
node scripts/session_browser.mjs
node scripts/pp1_browser.mjs
# Known unrelated failure:
.venv/Scripts/python.exe -m ruff check --no-cache --statistics research/c3-model-experiments
```

`--baseline` is a reproduction mode for the old running images, not an expected passing
test of the fixed application. Use a fresh unique pytest temporary directory for repeats;
existing temporary folders and permissions were preserved. The PostgreSQL lock harness was
not rerun for this client/proxy-only fix; no database locking code changed.

## Updated demonstration instructions and limitations

1. Start Docker Desktop and run `docker compose up -d --build --wait --wait-timeout 180`.
   Preserve the existing ignored `.env`; no credential regeneration or volume reset is needed.
2. Reload both applications to load the new client. Start a new synthetic student run at
   `http://localhost:3000/`, and sign in again at `http://localhost:3001` after this upgrade.
3. Keep student `/` and `/demo` in the same browser profile; select the owner run explicitly.
   Separate counsellor profile remains recommended for a clear demonstration, though cookie
   collisions are now prevented by application namespaces.
4. After access expiry, refresh status/evidence/tasks normally. A valid refresh session should
   renew automatically. The checklist's independent ~one-minute polling window still stops
   deliberately and requires **Refresh evidence**; that is not logout.
5. Student owner and consent still end at one hour. Refresh cannot extend them or undo
   withdrawal. Genuine expired/revoked sessions require sign-in/new synthetic ownership.

Limitations: development-only identity and HTTP; no clinical or human usability evaluation;
current browsers with Web Locks required; direct concurrent raw refresh callers still trigger
the intentionally strict replay policy. The wall-clock browser run covers the five-minute
boundary, not a full hour of natural refresh expiry; automated tests cover expired/revoked
refresh and consent policies. No long-lived-token workaround, consent weakening, research
implementation, training or dataset release was introduced.
