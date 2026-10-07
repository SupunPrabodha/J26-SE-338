# Local observability integration point

No external provider or collector is required. APIs use OpenTelemetry API spans with explicit safe service/correlation attributes and no exporter. Add a pinned local collector/SDK only after reviewing attribute allowlists, access and retention. Never enable request-body, header, token or exception-value capture. See docs/security/logging.md.
