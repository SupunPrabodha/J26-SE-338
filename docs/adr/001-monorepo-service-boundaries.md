# ADR 001: Monorepo and service boundaries

Date: 2026-10-07
Status: Accepted for synthetic bootstrap
Owners: C1; affected owners review shared changes

## Decision

Two frontend apps and four service packages share infrastructure without sharing research implementation.

## Alternatives and consequences

Separate repositories would multiply auth/contracts/CI setup before each owner can begin. A monorepo requires coordinated shared-file review.

## Verification

See automated tests and docs/evidence/bootstrap-verification.md for executed checks and limitations.
