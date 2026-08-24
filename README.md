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
npm run examples
```

Open `http://127.0.0.1:4173/examples/support-triage/`.

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
