# in-browser-ai

Browser AI tooling experiments. The current public PoC slice is
`@in-browser-ai/telemetry` for observing Chrome Prompt API `prompt()` and
`promptStreaming()` operations without changing application behavior.

## Quickstart

```bash
npm install
npm run typecheck
npm test
npm run test:integration
npm run test:e2e
npm run test:e2e:real-prompt-api
npm run test:e2e:real-prompt-api-streaming
npm run measure:overhead
npm run verify
npm run examples
```

Open `http://127.0.0.1:4173/examples/`.

The examples are the primary developer-facing PoC surface:

- `support-triage`: real browser AI observation, unchanged prompt result,
  Worker state, queue/lifecycle diagnostics, and normalized telemetry.
- `streaming-assistant`: incremental streaming output, time to first output,
  total duration, native runtime provenance, and one streaming summary
  observation.
- `private-document-summary`: metadata/redacted/full capture differences, with
  metadata showing content absent from telemetry.
- `ecommerce-extraction`: console plus generic OTLP/HTTP JSON fanout, delivery
  states, and shared observation identity.

## Slice 1 Capability

The support-triage example uses a fake Prompt API-compatible session so the
first telemetry path is screen-recordable even when Chrome Prompt API is not
available locally. The implemented path is:

```text
Prompt API session
-> main-thread observation shell
-> typed Worker protocol
-> Dedicated Worker entry
-> Functional Core normalization
-> console destination
-> support-triage telemetry panel
```

By default, support-triage uses `DETERMINISTIC TEST RUNTIME` so the Slice 1
pipeline is repeatable in CI and on machines without Chrome Prompt API.

For real Chrome Prompt API compatibility, run:

```bash
npm run test:e2e:real-prompt-api
```

The real-runtime test uses installed Chrome and the actual
`window.LanguageModel`; it does not inject a fake, polyfill `LanguageModel`, or
fall back to deterministic mode. The test launches an isolated persistent Chrome
profile at `.real-prompt-api-profile/` so browser-managed Prompt API model state
can survive repeated real-runtime runs. Override the defaults with
`REAL_PROMPT_API_CHROME_EXECUTABLE`, `REAL_PROMPT_API_PROFILE_DIR`, and
`REAL_PROMPT_API_TIMEOUT_MS`.

The real path records missing/unavailable, downloadable, downloading,
available, session creation, and prompt execution states separately. When Chrome
reports `downloadable` or `downloading`, support-triage calls the native
`LanguageModel.create({ monitor })` from the user click path and records real
download progress events where the browser exposes them. In a browser where the
native runtime cannot execute, the result is BLOCKED/UNAVAILABLE, DOWNLOADABLE,
DOWNLOADING, or another exact runtime error rather than proof of real
compatibility.

Chrome's current built-in AI requirements can include compatible OS/browser
configuration, sufficient disk/RAM/CPU/GPU, and an unmetered connection for the
initial model download. Useful local diagnostics include
`chrome://on-device-internals` and the installed Chrome Prompt API/on-device
model flag state when your Chrome configuration requires flags.

Slice 1 telemetry is metadata-oriented. Raw prompt and response content are not
included in Worker messages or normalized observations.

## Slice 2 Capability

The streaming-assistant example extends the same Worker pipeline to
`promptStreaming()`:

```text
Prompt API stream
-> application consumes chunks incrementally
-> main-thread observation shell records summary state
-> typed Worker protocol
-> Dedicated Worker entry
-> Functional Core normalization
-> one console telemetry observation
-> streaming-assistant telemetry panel
```

Run deterministic streaming validation with:

```bash
npm run test:e2e
```

The deterministic streaming path proves ordered output preservation, timing,
no-output behavior, failure, cancellation, and one-summary-observation telemetry
without relying on native model output.

For real Chrome `promptStreaming()` compatibility, run:

```bash
npm run test:e2e:real-prompt-api-streaming
```

This native gate reuses the installed Chrome profile/runtime path from Slice 1
and uses the same English text `expectedInputs` / `expectedOutputs` options for
`LanguageModel.availability()` and `LanguageModel.create()`. Its result is
reported as PASS, FAIL, BLOCKED, or UNAVAILABLE. It never falls back to the
deterministic fixture, and successful native `prompt()` validation does not
stand in for native `promptStreaming()` validation.

Slice 2 remains metadata-oriented. Raw generated stream chunks are not forwarded
to the telemetry Worker merely for telemetry. The telemetry path emits one
normalized streaming summary observation with output count, whether output was
produced, TTFO when output exists, total duration, outcome, runtime details, and
safe usage/context data where available.

## Slice 3 Capture Modes

Telemetry capture defaults to `metadata`:

```ts
observePromptApi({
  session,
  capture: "metadata"
});
```

Supported modes are:

- `metadata`: emits timing, runtime, usage/context when available, and character
  counts; raw prompt, response, private document text, and streaming chunks are
  absent from Worker messages and normalized observations.
- `redacted`: explicit opt-in; prompt/response content is transformed locally
  into deterministic placeholders like `[redacted 42 chars]` before it can cross
  the Worker boundary.
- `full`: explicit opt-in; prompt/response content may appear in telemetry.
  Invalid or unknown configuration falls back to `metadata`, never to `full`.

Run the privacy example:

```bash
npm run build
npm run examples
```

Open `http://127.0.0.1:4173/examples/private-document-summary/`. The page
starts in metadata mode and shows that the private document and generated
summary remain local while telemetry is still exported and inspectable.

## Slice 4 Vendor-Neutral Destinations

`observePromptApi` accepts one or more configured destinations:

```ts
observePromptApi({
  session,
  capture: "metadata",
  destinations: [
    { type: "console", id: "console" },
    { type: "otlp", id: "local-otlp", endpoint: "/otlp/v1/logs" }
  ]
});
```

The SDK creates one normalized observation per Prompt API operation, then fans
that same observation out to each configured destination. Destination routing
does not rerun capture policy, request more content, or change the application
result. If a destination fails, other destinations still run and inference
semantics remain unchanged.

The initial destination types are:

- `console`: writes the normalized observation for local inspection.
- `otlp`: sends an OTLP/HTTP JSON log export to a browser-compatible endpoint.

Browser OTLP delivery is subject to normal browser constraints including CORS,
CSP `connect-src`, endpoint availability, and browser networking limits. Use
local collectors, test endpoints, or public/browser-safe credentials only. Do
not place private server-side observability credentials, privileged collector
tokens, cookies, or `Authorization`/API-key headers in browser configuration.
The PoC includes defensive validation for known private-header names, but it is
not a cryptographic or universal secret detector. A secure relay for privileged
backend credentials is future MVP scope, not Slice 4.

Run the distribution example:

```bash
npm run build
npm run examples
```

Open `http://127.0.0.1:4173/examples/ecommerce-extraction/`. The example
defaults to metadata capture and `console + OTLP` delivery against the local
test endpoint served by the example server.

## Slice 5 Failure And Lifecycle Isolation

Telemetry remains fail-open. Worker startup, Worker processing, console
delivery, and OTLP delivery failures are surfaced through `onStatus` diagnostics
but must not replace successful Prompt API results, thrown Prompt API errors, or
cancellation behavior.

During Dedicated Worker startup, observation messages are held in a bounded
in-memory startup queue. The default capacity is 8 messages. The queue drains in
creation order when the Worker reports ready. If the queue is full, the newest
observation is dropped and the overflow is reported; existing queued
observations keep their order. The startup queue stores already-captured
metadata/redacted/full payloads, so metadata mode still does not send raw
prompt, response, private document, or generated chunk content across the Worker
boundary.

Page lifecycle handling makes a final best-effort flush attempt on
`visibilitychange` to hidden and `pagehide`. Lifecycle requests use the typed
asynchronous Worker protocol and mark eligible OTLP fetches with `keepalive`
where the browser allows it. This is not durable delivery: there is no
IndexedDB outbox, retry guarantee, exactly-once guarantee, `unload`/
`beforeunload` dependency, Worker restart, or supervision loop in the PoC.

`sendBeacon` is treated as a constrained future-compatible fallback boundary,
not the routine exporter. The current routine OTLP path remains Worker-side
`fetch()`; beacon compatibility is limited to destinations that can be sent
without custom headers.

The support-triage example displays Worker readiness, startup queue, delivery,
failure, and lifecycle flush diagnostics in its runtime status panel.

## Slice 6 Developer Experience And Runtime Characterization

Runtime characterization is observational and low-entropy. The SDK reports
Prompt API runtime type, availability, browser family/major version,
streaming support, and structured-output support only when those values are
provided directly or can be detected safely. Unknown or unavailable values remain
`unknown`, `unavailable`, or `unsupported`; the PoC does not infer model names,
model versions, GPU identity, device capacity, or other high-entropy details.

Deterministic example mode is explicitly labeled `DETERMINISTIC TEST RUNTIME`.
Native mode is explicitly labeled `REAL CHROME PROMPT API` and never falls back
to the deterministic runtime. Native Prompt API readiness, download/session
states, and execution failures are shown as runtime/demo state rather than
marketing claims.

The four examples now share a compact inspection pattern: a purpose statement,
application result, runtime/capture status, Worker or delivery state where
useful, and normalized telemetry. This makes the PoC screen-recordable without
requiring a viewer to know the internal architecture or open DevTools.

## Final Validation

Run the release-candidate validation suite with:

```bash
npm run verify
```

`npm run verify` runs typecheck, unit tests, integration tests, deterministic
browser E2E tests, build, and example-serving validation. Native Prompt API
compatibility remains intentionally separate because it depends on installed
Chrome and browser-managed model readiness:

```bash
REAL_PROMPT_API_TIMEOUT_MS=900000 npm run test:e2e:real-prompt-api
REAL_PROMPT_API_TIMEOUT_MS=900000 npm run test:e2e:real-prompt-api-streaming
```

Representative telemetry overhead can be measured with:

```bash
npm run measure:overhead
```

The overhead measurement uses deterministic Prompt API-compatible examples so
SDK instrumentation cost can be distinguished from model/runtime inference
latency. Native Prompt API runs are useful runtime evidence, but their model
latency is not reported as telemetry SDK overhead. Export/network timing is
reported separately from application-blocking observation cost.

Current limitations remain intentional: Prompt API is the only runtime adapter;
lifecycle delivery is best effort; OTLP is direct browser OTLP/HTTP JSON only;
there is no secure relay, hosted collector, dashboard, durable outbox, retry
system, Worker supervision, model routing, hosted docs site, SKILL packaging,
runtime intelligence dataset, or model optimization in the PoC.
