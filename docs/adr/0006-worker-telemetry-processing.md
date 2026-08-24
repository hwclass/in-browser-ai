# ADR 0006: Worker Telemetry Processing

Status: Accepted for Slice 1, updated for Slice 4

## Context

Telemetry processing should be isolated from application-critical Prompt API
execution where practical.

## Decision

Route observation messages through a Dedicated Worker entry that invokes the
Functional Core and hands the normalized observation to the configured
destination transport shell.

Slice 4 expands routine Worker-side responsibility to include destination
side effects after normalization, including console delivery and generic
OTLP/HTTP JSON delivery with browser `fetch()`. These side effects remain in
the Worker/transport shell. The Functional Core still owns pure normalization,
capture decisions, destination planning, and delivery result shaping without
knowing about Worker globals, browser APIs, console APIs, or `fetch()`.

## Consequences

Slice 1 proved the initial Worker-shaped console pipeline. Slice 4 keeps the
same isolation boundary while adding configured destination fanout.

The Worker remains an execution location, not a domain dependency. Destination
failures are reported as delivery attempts and must not alter application
inference behavior or prevent independent healthy destinations from running.

This ADR still does not introduce Worker restart, supervision, lifecycle
delivery, durable outbox, retry guarantees, or hosted ingestion infrastructure.
