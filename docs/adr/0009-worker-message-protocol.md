# ADR 0009: Worker Message Protocol

Status: Accepted for PoC release candidate

## Context

Worker communication must be explicit and bounded rather than a generic object
proxy.

## Decision

Define a shell-owned protocol with a protocol version, message id, message type,
creation time, and JSON-serializable payload.

Slice 3 extends observation payloads with capture-policy results. Worker
messages remain typed, versioned, serializable, and shell-owned. Metadata-mode
messages must not carry raw prompt, response, private document, or generated
stream chunk content. Content-bearing fields may exist only when explicitly
permitted by the active capture policy, such as `redacted` placeholders or
explicit `full` capture.

Slice 5 extends the protocol with typed asynchronous control and diagnostic
messages:

- `worker.control` starts the browser Worker readiness handshake.
- `worker.ready` lets the main-thread shell drain the startup queue.
- `worker.flush` requests a best-effort flush for manual, lifecycle, or stop
  reasons.
- `worker.flushResult` reports the asynchronous flush result.
- `worker.processingFailed` reports Worker-side processing failure without
  replacing application behavior.

Observation messages may include delivery hints such as `keepalive` and
`finalAttempt`. These hints affect only delivery attempts after capture and
normalization; they do not change capture policy or destination routing.

## Consequences

Functional Core types remain independent from Worker protocol envelopes.
Messages do not include DOM objects, Prompt API objects, streams, or functions.
Worker-side validation rejects metadata-mode payloads that contain
policy-incompatible content-bearing fields. Streaming telemetry remains
summary-oriented and does not forward raw chunks merely for telemetry.

The protocol remains asynchronous. There is no synchronous RPC, no main-thread
access to Worker-internal buffers, and no Worker restart/supervision contract in
this slice.
