# ADR 007: Deterministic development mocks

Date: 2026-10-07
Status: Accepted for synthetic bootstrap
Owners: C1; affected owners review shared changes

## Decision

Only exact catalog fixtures are accepted; outputs are fixed and reliability measurements are null.

## Alternatives and consequences

Mock plumbing proves integration, not anonymization, language detection, model quality or explanation faithfulness. Owners replace them through reviewed contract changes.

## Verification

See automated tests and docs/evidence/bootstrap-verification.md for executed checks and limitations.
