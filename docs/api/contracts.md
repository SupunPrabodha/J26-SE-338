# Contract-first integration

Authoritative Python models: `packages/contracts/src/research_contracts/__init__.py`. Exported JSON Schema Draft 2020-12: `packages/contracts/json-schema/v1`. Service OpenAPI 3.1: `packages/contracts/openapi`. Generated frontend declarations: `packages/typescript-common/src/contracts.d.ts`. Valid/invalid examples: `packages/contracts/examples/v1.json`.

Contract coverage includes consent/decision, submission session, pseudonymous case, workflow request/execution, C2/C3/C4 requests/responses, review task/action, withdrawal, retention, safe audit, errors, health/version, login, account/assignment and fixture catalog. Enum values are shared. IDs use UUIDs; timestamps must have a timezone and are normalized to UTC. Unknown fields and incompatible schema versions are rejected. Nullable fields are explicit: unevaluated reliability is null, optional error_code defaults null. Defaults are documented in generated schemas, not inferred by consumers.

Version policy: v1 requires exactly `schema_version: 1.0.0`; omitted metadata takes documented v1 defaults. Breaking names, types, required fields or enum semantics require a new major endpoint/schema with a migration window and all-consumer tests. Even additive fields require review because `extra=forbid` intentionally rejects silent drift. Do not change a published schema in place.

Generate/check:

```sh
python scripts/run.py scripts.generate_contracts
npm run contracts:types
python scripts/run.py scripts.generate_contracts --check
npm run contracts:check
python scripts/run.py pytest tests/contract
```

OpenAPI is generated from the same request/response models used at runtime; drift tests compare checked-in documents byte-equivalently after canonical JSON generation. Tests also prohibit service-local BaseModel definitions. New examples should include invalid consent, incompatible versions and forbidden identity fields.

All protected public APIs use HttpOnly cookies; internal APIs use audience-specific Bearer tokens. `/health`, `/ready`, `/version`, `/docs` and `/openapi.json` are development diagnostic endpoints. Public business routes are under `/api/v1`; mocks under `/internal/v1`. Errors return a safe stable error_code, correlation_id and generic message, never submitted bodies or validation input.
