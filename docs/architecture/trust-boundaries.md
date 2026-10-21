# Trust boundaries and data flow

Browser → same-origin Next.js `/api/v1` proxy → C1. Cookie authentication is checked in C1 on every protected request; the UI role check is only presentation. Next.js receives no signing keys or database credentials. Both localhost applications share browser cookies; use separate browser profiles to demonstrate student and counsellor sessions concurrently.

C1 identity/access and linkage tables are separated from NLP-facing workflow tables. Only C1/worker receive database credentials. C2–C4 receive one audience-specific service key and Redis access, with no identity-store connection. Service payloads contain case/correlation/idempotency IDs, purpose/consent metadata and synthetic processing evidence. User IDs and JWT claims never become NLP request fields.

The trusted worker generates 60-second audience-bound service JWTs. Mock services reject missing/wrong-scope/disabled/revoked tokens and incompatible contracts. The worker validates returned IDs, purpose and version. Any failure prevents review publication.

Case withdrawal locks the case, changes consent, cancels pending work, deletes derived evidence and assignments, and records minimal action evidence. An in-flight call may finish before withdrawal acquires the lock; after withdrawal returns, no subsequent processing or case content access is permitted. Existing review-task metadata never overrides withdrawal checks.

Temporary raw/normalized text exists only in request/worker memory and is not written to PostgreSQL, Redis, audit or telemetry. In the fixture-only prototype it is inherently public fictional text. Future real-text processing needs separate approved encrypted transient storage and a validated deletion lifecycle.

All application host ports are loopback-only. C2–C4, PostgreSQL and Redis are internal to Compose. Local network transport is plaintext and is a documented development exception. Runtime database access currently uses the local database owner: application table separation is logical, not an isolation claim against a compromised C1 process. Deployable institutional isolation requires independent roles/schemas, TLS and managed keys.
