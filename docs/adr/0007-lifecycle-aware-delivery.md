# ADR 0007: Lifecycle-Aware Delivery

Status: Accepted for Slice 5

## Context

Browser pages can transition away from normal activity before asynchronous
telemetry delivery has completed. The telemetry package should make a final
best-effort delivery attempt without making delivery durable or changing Prompt
API application behavior.

## Decision

Listen for `visibilitychange` when the document becomes hidden and for
`pagehide`. On those signals, issue a typed asynchronous Worker flush request
for pending telemetry and mark eligible OTLP/HTTP JSON delivery with
`keepalive`.

Routine OTLP delivery remains Worker-side `fetch()`. `sendBeacon` is not the
routine exporter. It is treated only as a constrained optional fallback boundary
for payloads and destinations that do not require custom headers.

The lifecycle path operates after capture policy has already run. It cannot
increase capture, rerun capture, request raw content from the application, or
cause metadata-mode prompt, response, private document, or generated chunk
content to cross the Worker boundary.

## Consequences

Lifecycle delivery is best effort. The browser may still cancel work during page
shutdown, reject keepalive requests, enforce CORS/CSP, limit payload size, or
terminate execution before telemetry completes.

The PoC intentionally does not add durable queues, IndexedDB outboxes, retries,
exactly-once delivery, `unload`/`beforeunload` handling, Worker restart, Worker
supervision, hosted ingestion, or a secure relay.

Telemetry lifecycle failure remains isolated from application inference.
