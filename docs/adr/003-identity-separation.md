# ADR 003: PostgreSQL identity separation

Date: 2026-10-07
Status: Accepted for synthetic bootstrap
Owners: C1; affected owners review shared changes

## Decision

Use clearly named access/linkage/workflow/review/audit tables; only C1 and worker have database access.

## Alternatives and consequences

Logical table separation is sufficient for fixture development, not protection against compromised C1/database-owner credentials. Institution deployment needs separate roles/schemas and encryption.

## Verification

See automated tests and docs/evidence/bootstrap-verification.md for executed checks and limitations.
