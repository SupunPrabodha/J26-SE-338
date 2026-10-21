# Troubleshooting

| Symptom | Action |
|---|---|
| Docker engine/pipe denied | Start Docker Desktop, confirm Linux-container mode and local Docker permissions; sandbox execution may require user approval. |
| Required environment variable / signing validation fails | Run bootstrap; never replace random secrets with demonstration passwords. |
| Existing `.env` preserved | Expected. Archive/rotate intentionally; the script never silently overwrites secrets. |
| Database authentication fails after secret rotation | Old volume retains its database password. Restore the correct local secret or intentionally reset disposable volumes. |
| Empty dashboard | Use generated counsellor credentials, click Refresh, confirm worker health and designated-account assignment. ADMIN cannot read case content. |
| Student session disappears after counsellor login | Both local apps share HttpOnly cookies. Use separate browser profiles. |
| Consent expires | Sessions/consents last one hour. Create a new synthetic session/decision; old consent cannot be reactivated. |
| Workflow FAILED | Read only safe error_code/correlation; inspect service readiness. DEAD_LETTER requires investigation and a new synthetic case. |
| Cookie mutation rejected | Use localhost, not 127.0.0.1, in browser URLs to match allowed Origins. HTTPS requires COOKIE_SECURE=true. |
| npm engine errors | Use the tested Node 22 patch listed in evidence/README or the pinned Docker image. Do not disable engine checks as a fix. |
| Contract drift | Regenerate Python artifacts and TypeScript, inspect and review the change, then rerun both drift checks. |
| Port already used | Stop the conflicting local development service or change host mappings and ALLOWED_ORIGINS together. |

`docker compose config --quiet` validates configuration without printing interpolated secrets. Never paste expanded Compose configuration into an issue. Container logs should be safe but still inspect/redact before sharing.
