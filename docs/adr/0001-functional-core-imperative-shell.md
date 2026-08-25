# ADR 0001: Functional Core / Imperative Shell

Status: Accepted for PoC release candidate

## Context

Prompt API observation needs browser access, Worker communication, and console
delivery, while normalized telemetry semantics need deterministic tests.

## Decision

Keep observation normalization in a deployment-neutral Functional Core and keep
Prompt API access, Worker messaging, and console output in imperative shells.

## Consequences

Core tests can run without browser globals, Worker protocol types, fetch,
console, lifecycle APIs, or Prompt API objects. Shell code remains responsible
for preserving application behavior and isolating telemetry side effects.
