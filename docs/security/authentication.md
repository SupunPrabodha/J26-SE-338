# Development authentication and future OIDC

The local adapter creates minimal five-minute HS256 JWTs with sub, role, iss, aud, iat, exp and jti. PyJWT validates signature and the explicit algorithm, issuer, audience, required fields and timestamps. UUID subject/jti and current account/session status are checked in PostgreSQL on each protected request. Anonymous students have one-hour limited-purpose accounts with no username/password or personal identity.

Development staff accounts use Argon2 through pwdlib. Bootstrap generates random credentials into gitignored `.env`; startup seed creates missing accounts only and never prints credentials. Login errors are generic, Argon2 work is performed for missing accounts, and Redis limits each network origin to ten attempts/minute. Proxy headers are not trusted. Shared-device/NAT limits are intentionally coarse for development.

Access and random refresh tokens are HttpOnly, SameSite=Strict cookies scoped to `/api/v1`. No tokens enter localStorage, sessionStorage, UI JSON or browser logs. Local loopback HTTP uses non-Secure cookies; `COOKIE_SECURE=true` is required behind future HTTPS. Mutations require an allowed Origin and `X-Requested-With: j26-browser`; cross-origin credentials are not enabled. The same-origin proxy is the browser entry point.

Only SHA-256 hashes of random refresh tokens are stored. Refresh rotates both tokens and revokes the old session; reuse revokes its entire family. Logout revokes the family immediately, including access tokens. Disabled/expired accounts remain blocked. Expired sessions stay as development revocation records until an approved maintenance policy replaces the bootstrap.

Service identities use independent keys/audiences for preprocessing, NLP and XAI, 60-second JWTs, allowlisted subject/role, Redis token identifiers and an audience-disable switch. A compromised mock cannot mint a valid token for another mock. Redis remains a shared trust boundary; production requires per-service ACLs or provider-backed introspection.

Future university integration replaces local password/student session issuance with OIDC Authorization Code + PKCE through a server-side callback. Validate state, nonce, issuer, audience and JWKS rotation; map approved groups to internal roles, preserve resource assignments and internal revocation, and retain the cookie/CSRF boundary. Do not simply accept arbitrary external bearer tokens or roles supplied by a browser. No university issuer or credentials are configured.
