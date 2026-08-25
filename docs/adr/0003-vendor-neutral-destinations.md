# ADR 0003: Vendor-Neutral Destinations

Status: Accepted for PoC release candidate

## Context

The telemetry PoC needs to send the same browser AI observation to multiple
destinations without making the internal model depend on a specific vendor.
Capture policy must already have decided what content is allowed before any
destination sees the observation.

## Decision

Use generic destination configuration:

```ts
destinations: [
  { type: "console" },
  { type: "otlp", endpoint: "/otlp/v1/logs" }
]
```

The Functional Core plans delivery commands for enabled, valid destinations.
It receives the normalized observation and destination descriptors; it does not
perform console writes, network I/O, or browser API access.

Destination side effects live in the transport shell. Console delivery writes
the normalized observation for local inspection. OTLP delivery sends OTLP/HTTP
JSON to developer-controlled, browser-compatible endpoints.

## Consequences

One Prompt API operation remains one normalized observation. Fanout does not
renormalize the model result per destination and does not rerun capture policy.

Destination failures are isolated. A failing console destination must not
suppress OTLP delivery, a failing OTLP endpoint must not suppress console
delivery, and neither failure path may alter application inference behavior.

Vendor-specific configuration names and vendor SDKs are intentionally excluded
from this PoC slice.
