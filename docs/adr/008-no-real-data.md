# ADR 008: No-real-data bootstrap

Date: 2026-10-07
Status: Accepted for synthetic bootstrap
Owners: C1; affected owners review shared changes

## Decision

Reject arbitrary input at the intake boundary and restrict all tests/CI to fictional fixtures.

## Alternatives and consequences

A UI warning alone would not enforce this boundary. Real data requires separate approvals, validated privacy controls and a new intake contract.

## Verification

See automated tests and docs/evidence/bootstrap-verification.md for executed checks and limitations.
