# ADR 0008: OpenTelemetry Boundary

Status: Accepted for Slice 4

## Context

OpenTelemetry is useful as an interoperability format, but the product's domain
model is browser AI inference telemetry rather than an OTLP-first data model.
The browser environment also constrains transport choices through CORS, CSP, and
normal fetch behavior.

## Decision

Keep OTLP as an outbound mapping boundary. The SDK first creates a normalized
browser AI telemetry observation, then maps that observation to an OTLP/HTTP JSON
log payload at the transport edge.

Use browser `fetch()` for routine OTLP delivery in this slice. The PoC supports
generic OTLP/HTTP JSON endpoints only. It does not add Protobuf, gRPC,
WebSocket exporters, vendor SDKs, hosted ingestion, or relay infrastructure.

Browser configuration must not require private server-side observability
credentials. Local collectors, test endpoints, and browser-safe public
credentials are acceptable.

## Consequences

OTLP serialization can be tested deterministically without contacting a live
vendor. The internal observation remains destination-neutral and can still be
rendered to console or mapped to other destinations later.

Browser delivery failures are reported as destination attempts and remain
isolated from application inference.
