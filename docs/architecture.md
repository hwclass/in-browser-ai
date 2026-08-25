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

## Slice 4 Destination Distribution

Slice 4 adds destination fanout after capture and normalization:

```text
Prompt API input/output
        |
capture policy
        |
typed Worker message
        |
Dedicated Worker normalization
        |
pure destination plan
        |
transport shell
   |            |
console     OTLP/HTTP JSON fetch
```

Capture remains independent from destinations. The routing layer receives only
the already-permitted normalized observation, so a destination cannot upgrade
metadata to redacted/full, request additional content, or create another
inference observation.

The Functional Core owns destination planning and delivery result shaping under
`packages/telemetry/src/core/routing`. It does not call `fetch()`, access Worker
globals, write to console, or know it runs in a browser. The transport shell
maps observations to console and OTLP representations and performs side effects.

OTLP is an outbound interoperability boundary. The internal observation model is
not OTLP-shaped; `mapToOtlpHttpJson` serializes the normalized observation into
an OTLP/HTTP JSON log payload at the transport edge.

Destination execution is independent. Console and each OTLP destination produce
separate delivery attempts. A console failure does not suppress OTLP delivery,
an OTLP network or HTTP failure does not suppress console delivery, and neither
kind of failure changes `prompt()` or `promptStreaming()` application behavior.

Streaming remains summary-oriented. A streaming operation still emits one
normalized telemetry observation after stream completion, cancellation, or
failure; OTLP does not receive per-chunk events.

## Slice 5 Failure And Lifecycle Isolation

Slice 5 keeps the same Functional Core / Imperative Shell split while adding
operational safeguards around the Worker and page lifecycle:

```text
Prompt API shell
        |
capture policy
        |
bounded startup queue
        |
typed asynchronous Worker protocol
        |
Dedicated Worker normalization and delivery
        |
console / OTLP attempts

visibility hidden / pagehide
        |
best-effort flush request
        |
Worker fetch delivery with keepalive where applicable
```

The startup queue is an in-memory shell concern. It preserves observations
created before the Worker reports ready, drains them in order, and uses
deterministic overflow by dropping the newest observation when capacity is
exhausted. Queued messages have already passed capture policy before entering
the queue. In metadata mode, raw prompt, response, private document, and
generated chunk content still do not cross the Worker boundary.

Worker initialization and processing failures are fail-open. The public shell
reports status diagnostics, clears unsafe pending state where needed, and
preserves Prompt API application semantics. A telemetry failure must not turn a
successful inference into a failure, mask a Prompt API error, or replace
cancellation behavior. Slice 5 intentionally does not add Worker restart,
supervision, or recovery loops.

Lifecycle delivery is best effort. The browser shell listens to
`visibilitychange` when the page becomes hidden and to `pagehide`; it avoids
`unload` and `beforeunload`. A lifecycle event sends a typed asynchronous
flush request to the Worker and uses `keepalive` for eligible OTLP fetches.
Routine OTLP delivery remains Worker-side `fetch()`.

The PoC does not promise durable delivery, exactly-once delivery, retry/outbox
guarantees, or completion after the browser terminates execution. `sendBeacon`
is only modeled as a constrained optional fallback boundary for destinations
that need no custom headers; it is not the normal OTLP exporter and does not
upgrade capture or routing semantics.

## Slice 6 Runtime Characterization And Examples

Runtime characterization is split between a runtime-neutral core normalizer and
the Prompt API/browser shell:

```text
Prompt API/browser shell
        |
safe availability and browser signals
        |
runtime-neutral normalization
        |
observation runtime summary
        |
example runtime status panels
```

The core accepts values and reduces them to the domain shape: runtime type,
browser family, browser major version, availability, streaming support, and
structured-output support. It does not inspect `window`, `navigator`,
`LanguageModel`, Prompt API sessions, model internals, GPU details, device
capacity, or raw user content. Unknown, unsupported, or unavailable information
stays explicit rather than being guessed.

The Prompt API shell may inspect browser-safe facts such as user-agent brand
major version and whether the native `LanguageModel` global is present. It may
also mark streaming support as supported when the observed session actually
exposes `promptStreaming()`. Model identifiers, model versions, context limits,
and usage values are reported only when the runtime exposes them through the
approved observation model; they are not derived from prompt or response text.

The examples map the architecture to screen-recordable developer surfaces:

- `support-triage`: primary prompt observation surface, real/deterministic
  runtime mode, Worker state, queue/lifecycle diagnostics, capture mode, and
  normalized telemetry.
- `streaming-assistant`: incremental stream consumption, TTFO, total duration,
  native provenance, Worker state, and existing lifecycle/final-attempt status
  where useful.
- `private-document-summary`: metadata/redacted/full capture behavior and
  visible proof that metadata telemetry omits content.
- `ecommerce-extraction`: application extraction result, console plus OTLP
  fanout, delivery state, and shared observation identity.

## Slice 7 Final Validation Boundary

Slice 7 does not add product runtime behavior. It hardens the release-candidate
proof by validating the complete public flow from build scripts, automated test
suites, native Prompt API gates, examples, docs, scope boundaries, and
`validation.md`.

Telemetry overhead evidence is measured separately from browser AI model
latency. The validation helpers distinguish baseline deterministic operation
timing, instrumented deterministic operation timing, incremental page-side
observer work, serialization/message payload shape, Worker-side processing cost
where measurable, and destination/export timing. Native Chrome Prompt API
latency, TTFO, and total duration may be recorded as runtime evidence, but they
are not treated as SDK overhead unless a measurement isolates the
instrumentation delta.

The final verification command remains an automation convenience over the same
architecture:

```text
typecheck
unit tests
integration tests
deterministic browser E2E
build
example-serving validation
```

Native `prompt()` and `promptStreaming()` compatibility gates remain separate
because they require installed Chrome, native `window.LanguageModel`, and
browser-managed model readiness. A final PASS requires those gates to pass in a
supported environment or to be recorded honestly as BLOCKED/UNAVAILABLE when
the environment cannot satisfy the native prerequisites.
