# ADR 004: OIDC-compatible development authentication

Date: 2026-10-07
Status: Accepted for synthetic bootstrap
Owners: C1; affected owners review shared changes

## Decision

Use a local identity adapter with stable opaque subjects and explicit role mapping; replace issuance with Authorization Code + PKCE.

## Alternatives and consequences

A live OIDC provider would require institutional configuration unavailable here. This local adapter is not itself an OIDC provider.

## Verification

See automated tests and docs/evidence/bootstrap-verification.md for executed checks and limitations.
