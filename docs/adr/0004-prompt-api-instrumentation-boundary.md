# ADR 0004: Prompt API Instrumentation Boundary

Status: Accepted for Slice 1

## Context

Prompt API access happens on the page side. Telemetry must observe inference
without replacing success, failure, or cancellation semantics.

## Decision

Wrap the session `prompt()` call in a thin shell that records timing, forwards a
metadata-oriented observation, returns the original result, and rethrows the
original failure.

## Consequences

Application behavior remains the source of truth. Slice 1 does not forward raw
prompt or response content through the telemetry Worker protocol.
