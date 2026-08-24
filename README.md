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
