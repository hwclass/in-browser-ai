# ADR 0006: Worker Telemetry Processing

Status: Accepted for Slice 1

## Context

Telemetry processing should be isolated from application-critical Prompt API
execution where practical.

## Decision

Route observation messages through a Dedicated Worker entry that invokes the
Functional Core and hands the normalized observation to the console destination
shell.

## Consequences

Slice 1 proves the intended Worker-shaped pipeline without adding restart,
supervision, routing, lifecycle, OTLP, or durable delivery infrastructure.
