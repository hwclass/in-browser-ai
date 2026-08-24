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

## Slice 2 Streaming Observation

Slice 2 extends the same path to Prompt API `promptStreaming()` while keeping the
stream itself an application/runtime concern.

```text
Prompt API stream
        |
application consumes chunks incrementally
        |
thin observation shell records bounded summary state
        |
typed serializable Worker protocol
        |
Dedicated Worker entry
        |
deployment-neutral Functional Core
        |
one normalized streaming observation
        |
console destination
        |
streaming-assistant example
```

The observation shell transparently observes stream progress. It must not
pre-consume the stream, buffer a complete result before returning, reconstruct a
replacement stream from a completed response, reorder chunks, duplicate chunks,
suppress chunks, or replace native error/cancellation behavior.

The telemetry domain receives summary metadata only: operation identity,
outcome, output/chunk count, whether output occurred, time to first output,
total duration, runtime information, and safe usage/context metadata where the
runtime exposes it. Raw generated chunks are not telemetry-domain entities and
are not forwarded through Worker messages merely for telemetry.

Many native chunks produce one final normalized streaming observation. The
Worker protocol has a distinct streaming observation message type so tests and
examples can verify the operation without introducing per-chunk event fan-out.

Native Chrome streaming compatibility is proven separately from deterministic
streaming validation. The native gate uses installed Chrome, real
`window.LanguageModel`, compatible English text options for
`LanguageModel.availability()` and `LanguageModel.create()`, and real
`session.promptStreaming()`. It verifies normalized console telemetry plus
inspectable streaming-assistant/test evidence, including TTFO, total duration,
real Worker operation, and test-only native/application stream identity.

## Slice 3 Capture and Privacy

Capture policy lives in the deployment-neutral Functional Core under
`packages/telemetry/src/core/capture`. The core resolves invalid or missing
configuration to `metadata`, applies deterministic redaction for `redacted`, and
allows content only for explicit `full`.

The Prompt API shell applies capture before constructing a Worker message:

```text
Prompt API input/output
        |
page-side capture policy
        |
typed serializable Worker payload
        |
Dedicated Worker normalization
        |
console destination
```

For `metadata`, the Worker payload contains only non-content telemetry plus
character counts. It has no `input`, `output`, `prompt`, `response`, or
`chunks` content fields. A Worker message validator rejects metadata-mode
observation messages that contain string content-bearing fields, giving the
boundary a structural leakage check in addition to the builder behavior.

For `redacted`, raw values are transformed page-side into deterministic
placeholders and only those placeholders enter the Worker pipeline. For `full`,
content capture is activated only by the explicit `capture: "full"` option.
Streaming observation remains one summary event; chunks continue to flow to the
application in order, and metadata mode does not forward raw generated chunks.
