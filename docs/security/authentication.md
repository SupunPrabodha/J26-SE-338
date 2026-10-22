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
