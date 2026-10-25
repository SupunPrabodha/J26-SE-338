# Development authentication and future OIDC

The local adapter creates minimal five-minute HS256 JWTs with sub, role, iss, aud, iat, exp and jti. PyJWT validates signature and the explicit algorithm, issuer, audience, required fields and timestamps. UUID subject/jti and current account/session status are checked in PostgreSQL on each protected request. Anonymous students have one-hour limited-purpose accounts with no username/password or personal identity.

Development staff accounts use Argon2 through pwdlib. Bootstrap generates random credentials into gitignored `.env`; startup seed creates missing accounts only and never prints credentials. Login errors are generic, Argon2 work is performed for missing accounts, and Redis limits each network origin to ten attempts/minute. Proxy headers are not trusted. Shared-device/NAT limits are intentionally coarse for development.

Access and random refresh tokens are HttpOnly, SameSite=Strict cookies scoped to `/api/v1`. No tokens enter localStorage, sessionStorage, UI JSON or browser logs. Local loopback HTTP uses non-Secure cookies; `COOKIE_SECURE=true` is required behind future HTTPS. Mutations require an allowed Origin and `X-Requested-With: j26-browser`; cross-origin credentials are not enabled. The same-origin proxy is the browser entry point.

Only SHA-256 hashes of random refresh tokens are stored. Refresh rotates both tokens and revokes the old session; reuse revokes its entire family. Logout revokes the family immediately, including access tokens. Disabled/expired accounts remain blocked. Expired sessions stay as development revocation records until an approved maintenance policy replaces the bootstrap.

Service identities use independent keys/audiences for preprocessing, NLP and XAI, 60-second JWTs, allowlisted subject/role, Redis token identifiers and an audience-disable switch. A compromised mock cannot mint a valid token for another mock. Redis remains a shared trust boundary; production requires per-service ACLs or provider-backed introspection.

Future university integration replaces local password/student session issuance with OIDC Authorization Code + PKCE through a server-side callback. Validate state, nonce, issuer, audience and JWKS rotation; map approved groups to internal roles, preserve resource assignments and internal revocation, and retain the cookie/CSRF boundary. Do not simply accept arbitrary external bearer tokens or roles supplied by a browser. No university issuer or credentials are configured.


## Browser renewal and application isolation (2026-10-22)

The shared client renews a 401 once, including `/auth/me`, through a same-origin Web Lock.
A tab-local promise coalesces requests, and a protected `/auth/me` probe inside the lock
avoids reusing a refresh credential already rotated by another tab. The original request is
retried at most once. A 403 never triggers refresh. Login, student-session issuance and
logout use the same lock so an earlier refresh cannot finish after logout and restore a
revoked cookie. No tokens or authentication flags are stored in browser storage.
Browsers without Web Locks fail closed with a compatibility message; current Edge supports it.
Network/503 failures are not treated as consent withdrawal. API messages use an allowlist
of error codes and never display arbitrary server bodies.

Both applications now use server-side Next route proxies instead of transparent rewrites.
Browser cookies are `j26_student_access` / `j26_student_refresh` and
`j26_counsellor_access` / `j26_counsellor_refresh`, respectively. Each proxy forwards only
its own pair, translated into the unchanged upstream `j26_access` / `j26_refresh` names.
It translates both Set-Cookie headers, including deletion, without changing Path=/api/v1,
HttpOnly, SameSite=Strict, Secure or lifetime attributes. Domain is omitted (host-only).
Unprefixed legacy cookies and other-application cookies are ignored at these proxies.
Direct orchestrator clients retain canonical cookie names and existing behavior.

Sign in once again after upgrading from the old proxy. Existing cookies are not migrated
between roles, and old database sessions are not implicitly revoked by this name change.
They remain subject to existing expiry/replay/logout checks. The browser cookie jar is
still host-based, so namespacing is application selection, not a separate security origin.
The backend continues enforcing roles and case ownership on every request. Separate
student/counsellor browser profiles remain useful for a clear demonstration.

Runtime defaults remain: access JWT and cookie 300 seconds; refresh session and cookie
3600 seconds; student account one hour from creation; consent expires at that account's
fixed deadline. Refresh cannot extend a student owner or consent deadline. Staff refresh
sessions use the existing rolling one-hour policy, not a new absolute staff-session cap.
The refresh cookie can outlast the remaining student-account window; server checks prevail.
No expiry settings, JWT verification, replay protection or consent guards were weakened.
See `docs/evidence/c1-session-continuity.md` for reproduction and actual browser timings.
# Restricted administrative workspace — 2026-10-24

Staff `/admin` reuses the same backend JWT/refresh/session/CSRF/RBAC implementation.
The proxy selects `j26_admin_access` / `j26_admin_refresh` for `/api/v1/admin/*` and
`/api/v1/admin-auth/*`; the latter maps to the existing `/api/v1/auth/*` endpoints upstream.
Browser namespaces prevent accidental session selection collisions. They do not protect
against a compromised application sharing the host. Canonical direct API cookie names remain
unchanged. Security attributes, logout deletion and both Set-Cookie headers are preserved.

The common admin client has its own renewal promise and cross-tab lock and retries the
original protected request at most once, using the same renewal implementation as the
student/counsellor client. No tokens enter browser storage. Five-minute access and one-hour
refresh policies remain unchanged. `current_account` adds the validated session-row reference
to internal request state solely for bounded administrative access-receipt deduplication;
that reference is not returned to clients or exported in audit evidence.

## Staff mutation and directory isolation (2026-10-24)

The directory uses `j26_research_access` / `j26_research_refresh` selected by the same proxy;
`/research-auth/*` maps to canonical backend auth routes. Its shared client has a distinct
renewal lock/promise and the same single-retry, revocation and cookie protections. It grants
only component-route metadata, not research data. ADMIN and COUNSELLOR namespaces remain.

Staff role/access changes revoke all target sessions. Re-enabling never reactivates old
sessions. Last-usable-admin protection uses enabled/expiry/credential checks under sorted
staff-account locks. Review revalidates account/session after case/consent locks. Login and
refresh lock account before session, serializing with staff revocation; direct concurrent
refresh replay still revokes the family. No token/consent lifetimes were extended.
Private generated account provisioning: `scripts/provision_staff.py --role COUNSELLOR`.
See [actual tests and browser evidence](../evidence/c1-role-assignment.md).

## Opt-in remembered staff sessions (2026-10-25)

The counsellor, administrator and researcher sign-in forms now offer an accessible,
unchecked-by-default **Remember me on this device** checkbox. `LoginRequest.remember_me`
is an optional strict boolean defaulting to false. Access JWTs/cookies still last 300 seconds.
Unchecked staff sessions preserve the existing rolling 3600-second server session and
persistent refresh-cookie policy, including its existing restart behaviour within that
window. Unchecked is not a new browser-session-only cookie policy.

Checked staff sessions use `REMEMBERED_SESSION_SECONDS`, default **604800 seconds (7 days)**,
validated between 3600 and 2592000 seconds (1 hour–30 days). The initial issuance records
an absolute family deadline; rotation retains that deadline and cookies receive only its
remaining lifetime. Account expiry can shorten it. Refresh does not start another seven
days. The server rejects missing/elapsed remembered deadlines, revoked/expired rows and
disabled/expired accounts. Existing staff role/enable changes and credential revocation
still revoke relevant sessions. Logout revokes the family and deletes both cookies.

The existing HttpOnly, host-only, `/api/v1`, SameSite=Strict, CSRF, namespace, Web Lock,
single-retry and replay protections remain. `COOKIE_SECURE=true` is still required for
future HTTPS; local HTTP uses false and does not establish production TLS. No password,
token or account profile is persisted by application code in browser storage.

Student issuance ignores this staff option. Student accounts and consent retain their
original fixed one-hour deadline. Successful staff refresh cannot restore withdrawn,
expired, disposed or unassigned case access.

`GET /api/v1/auth/profile` returns only the authenticated staff account's ID, role, enabled
flag, creation/account-expiry dates and current session deadline/remembered flag. It returns
no handle, password, token, refresh identifier, student identity or case contents. The
`/account?workspace=admin|counsellor|research` shell uses the corresponding existing proxy
realm. RESEARCHER still has component-directory metadata only. Provision privately with
`scripts/provision_staff.py --role RESEARCHER`; public privileged registration is not added.

See [mapping, session, researcher and actual restart evidence](../evidence/c1-remembered-sessions-status.md).
