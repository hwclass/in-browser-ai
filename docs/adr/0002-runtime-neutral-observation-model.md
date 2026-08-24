# ADR 0002: Runtime-Neutral Observation Model

Status: Accepted for Slice 1

## Context

Prompt API is the first runtime, but the internal telemetry shape should not be
the browser API object shape or a destination-specific payload.

## Decision

Represent Slice 1 telemetry as a normalized inference observation with opaque
session and operation identity, operation type, timing, outcome, optional error,
runtime summary, and safe usage/context metadata.

## Consequences

The console destination receives the normalized observation directly. Future
destinations can map from the same semantic model without changing Prompt API
application behavior.
