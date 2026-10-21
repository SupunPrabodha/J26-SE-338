# Privacy-safe observability

The `research.safe` logger emits only timestamp, service_name/version, correlation_id, event_type, HTTP status, duration_ms and safe error_code. It never accepts bodies, arbitrary exception details, paths/query strings, account identity or tokens. Middleware returns a generated/validated UUID correlation header and uses no-store responses. The safe audit table records fixed lifecycle events and state/action names, with pseudonymous case/correlation IDs only.

HTTP access logging and HTTP client debug logging are disabled in containers. Validation errors omit Pydantic input/ctx fields. Worker failures emit a fixed JSON event rather than serializing exceptions. Automated tests capture application logs and inspect audit fields for synthetic sentinel text and tokens.

OpenTelemetry API spans are present with service and correlation fields only. No SDK/exporter, automatic request instrumentation, third-party monitoring or cloud provider is enabled. If later enabled, use an approved local collector and an explicit attribute allowlist; never turn on request/response/body/header capture.

Compose application logs rotate at 5 MB × 2 files. Restrict Docker/log access to local developers; logs should be deleted under the approved local-development housekeeping policy. Audit/trace access must remain restricted even without raw text. University deployment requires an approved retention period, access review and separate protected audit storage.
