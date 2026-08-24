# ADR 0009: Worker Message Protocol

Status: Accepted for Slice 1, updated for Slice 3

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

## Consequences

Functional Core types remain independent from Worker protocol envelopes.
Messages do not include DOM objects, Prompt API objects, streams, or functions.
Worker-side validation rejects metadata-mode payloads that contain
policy-incompatible content-bearing fields. Streaming telemetry remains
summary-oriented and does not forward raw chunks merely for telemetry.
