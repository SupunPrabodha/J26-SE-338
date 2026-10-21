# Security

Report vulnerabilities privately to the repository owner through an institution-approved private channel. If GitHub private vulnerability reporting is enabled, use it. Do not publish exploitable details, credentials or sensitive examples in issues. No private reporting endpoint or response-time commitment is assumed.

This is development-only software using fixed synthetic text. Participant data, private messages, names, student IDs, emails, consent forms, identity mappings, datasets and model weights are prohibited in Git and CI.

Run bootstrap scripts to generate local secrets. Keep `.env` private, grant access only to your operating-system account, and never paste it into reports. Rotate by stopping the stack, intentionally replacing the local environment and resetting disposable volumes with the explicit reset script. Existing database passwords do not change merely by editing `.env`.

Host ports bind to loopback. Do not expose this environment on a LAN or public host. HTTP and non-Secure cookies are permitted only for local development. Institution deployment requires TLS, Secure cookies, managed identity, least-privilege database credentials, retention approval, threat review and independent security evaluation.

Application/audit/telemetry output must exclude text, identity details, passwords, cookies, tokens, service credentials and notes. Fixed structured event fields are the only logging interface. Raw exception serialization and request-body logging are prohibited.

Update pinned dependencies and lockfiles together. Review upstream release/security notes, run `npm audit` and `pip-audit`, then all relevant tests. Never suppress an advisory merely to pass CI. Container base images are pinned to digests; refresh and test intentionally. Dependency scans and the bootstrap tests do not constitute a penetration test or compliance certification.
