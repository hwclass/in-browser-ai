# ADR 0004: Prompt API Instrumentation Boundary

Status: Accepted for Slice 1, updated for Slice 6

## Context

Prompt API access happens on the page side. Telemetry must observe inference
without replacing success, failure, or cancellation semantics.

## Decision

Wrap the session `prompt()` and `promptStreaming()` calls in thin shells that
record timing and safe runtime-exposed usage/context metadata, apply capture
policy before Worker serialization, forward a bounded observation, return the
original prompt result or stream, and rethrow the original failure.

Slice 6 keeps runtime characterization at this boundary observational. The
Prompt API shell may record native availability/readiness state and browser
family/major version where safely exposed, but it must not invent model
identity, capabilities, or device details.

## Consequences

Application behavior remains the source of truth. Metadata mode does not forward
raw prompt, response, private document, or generated chunk content through the
telemetry Worker protocol. Native mode never falls back silently to the
deterministic example runtime.
