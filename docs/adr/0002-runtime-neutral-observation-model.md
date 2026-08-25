# ADR 0002: Runtime-Neutral Observation Model

Status: Accepted for PoC release candidate

## Context

Prompt API is the first runtime, but the internal telemetry shape should not be
the browser API object shape or a destination-specific payload.

## Decision

Represent telemetry as a normalized inference observation with opaque session
and operation identity, operation type, timing, outcome, optional error, runtime
summary, capture-policy result, streaming summary where applicable, and safe
usage/context metadata.

Slice 6 keeps runtime characterization as normalized domain data rather than
Prompt API object state. The runtime summary may include runtime type, browser
family, browser major version, availability, streaming support, and
structured-output support when safely available. Unknown or unexposed
characteristics remain explicit unknown/unavailable values.

## Consequences

The console destination receives the normalized observation directly. Future
destinations can map from the same semantic model without changing Prompt API
application behavior.

The observation model does not include Chrome-specific model names, device
fingerprinting data, Prompt API runtime objects, streams, or destination-specific
payload shapes. Prompt API remains the first adapter, not the internal model.
