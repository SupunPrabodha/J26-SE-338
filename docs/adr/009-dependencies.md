# ADR 009: Dependency and image pinning

Date: 2026-10-07
Status: Accepted for synthetic bootstrap
Owners: C1; affected owners review shared changes

## Decision

Pin stable registry-resolved direct dependencies, commit uv/npm lockfiles, require hashed Python runtime installs, and pin container image digests.

## Alternatives and consequences

Version selection is verified against registries and upstream release/security information. Host Node 22.12 is older than current tooling engine requirements; use a current Node 22 patch. Sources: https://nextjs.org/blog and https://fastapi.tiangolo.com/release-notes/ .

## Verification

See automated tests and docs/evidence/bootstrap-verification.md for executed checks and limitations.

Compatibility resolution: TypeScript 7.0 was rejected by typescript-eslint; pin TypeScript 6.0.3. eslint-config-next 16.4.0 pulled braces <=3.0.3 (GHSA-vfj7-8cjw-p6xm) with no patched braces release available. Use maintained ESLint 10, typescript-eslint and React Hooks rules without that dependency chain. npm audit subsequently reported zero vulnerabilities. Tooling requires Node >=22.22.2; verification uses a project-local 22.23.3 runtime and pinned container Node. The global host installation is untouched.
