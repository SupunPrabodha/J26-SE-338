# ADR 002: Contract-first APIs

Date: 2026-10-07
Status: Accepted for synthetic bootstrap
Owners: C1; affected owners review shared changes

## Decision

Pydantic v2 in packages/contracts is authoritative; export JSON Schema/OpenAPI and derive TypeScript.

## Alternatives and consequences

Avoid independent hand-written service schemas. Strict version literals require deliberate revisions for real adapters.

## Verification

See automated tests and docs/evidence/bootstrap-verification.md for executed checks and limitations.
