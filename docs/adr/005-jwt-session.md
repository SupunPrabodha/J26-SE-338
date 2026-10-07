# ADR 005: JWT and browser sessions

Date: 2026-10-07
Status: Accepted for synthetic bootstrap
Owners: C1; affected owners review shared changes

## Decision

Use explicit HS256, five-minute access JWTs, HttpOnly cookies, hashed rotating refresh tokens, DB revocation and Origin/header CSRF checks.

## Alternatives and consequences

Local secrets are generated per environment. Service audiences have separate keys. Asymmetric university-issued tokens and managed key rotation remain future integration work.

## Verification

See automated tests and docs/evidence/bootstrap-verification.md for executed checks and limitations.
