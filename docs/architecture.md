# Architecture

## Slice 1 Worker Prompt Observation

The first implemented telemetry path observes a Prompt API-compatible
`prompt()` call and preserves the application result or thrown failure.

```text
Prompt API session
        |
thin main-thread Prompt API observation shell
        |
typed serializable Worker protocol
        |
Dedicated Worker entry
        |
deployment-neutral Functional Core
        |
normalized inference observation
        |
console destination
        |
support-triage example
```

The Functional Core lives under `packages/telemetry/src/core/observation` and
owns runtime-neutral timing, error, outcome, usage/context, and observation
normalization. It does not import browser shells, Worker protocol types, Prompt
API objects, network APIs, or console APIs.

The Worker shell boundary lives under `packages/telemetry/src/shell/worker`.
Its protocol is versioned, explicitly typed, serializable, and asynchronous.
Slice 1 forwards bounded metadata-oriented observation messages only.

The Prompt API shell remains responsible for interacting with the runtime,
preserving return values and thrown failures, recording timing, and forwarding
safe runtime-exposed usage/context metadata without inspecting raw prompt or
response content.
