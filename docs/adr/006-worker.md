# ADR 006: Redis and a narrow durable worker

Date: 2026-10-07
Status: Accepted for synthetic bootstrap
Owners: C1; affected owners review shared changes

## Decision

Use PostgreSQL jobs committed atomically with submissions, leases and bounded retries; Redis handles short-lived auth/rate/health state.

## Alternatives and consequences

This is the narrow task abstraction permitted by the brief. Celery would introduce broker publication/outbox coordination for one deterministic workflow. The queue is intentionally small and needs re-evaluation before scale-out.

## Verification

See automated tests and docs/evidence/bootstrap-verification.md for executed checks and limitations.
