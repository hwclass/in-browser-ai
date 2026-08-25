# ADR 0010: Partytown-Inspired Isolation Boundary

Status: Accepted for PoC release candidate

## Context

The project is inspired by moving non-critical work away from the main thread,
but it must not recreate synchronous proxy machinery.

## Decision

Use direct asynchronous telemetry messages from the Prompt API shell to the
Worker boundary. Do not introduce Service Worker RPC, SharedArrayBuffer,
Atomics, synchronous Worker proxying, or a Partytown runtime dependency.

## Consequences

The Slice 1 implementation is small and understandable, and it keeps
application Prompt API behavior independent from telemetry processing.
