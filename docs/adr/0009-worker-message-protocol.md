# ADR 0009: Worker Message Protocol

Status: Accepted for Slice 1

## Context

Worker communication must be explicit and bounded rather than a generic object
proxy.

## Decision

Define a shell-owned protocol with a protocol version, message id, message type,
creation time, and JSON-serializable payload.

## Consequences

Functional Core types remain independent from Worker protocol envelopes.
Messages do not include DOM objects, Prompt API objects, streams, functions, or
raw prompt/response content.
