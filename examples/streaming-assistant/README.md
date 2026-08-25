# Streaming Assistant

This example demonstrates Slice 2 streaming observability for Prompt API
`promptStreaming()` and the Slice 6 runtime/DX surface for streaming.

## Deterministic Test Runtime

The default mode uses a fake Prompt API-compatible streaming session. It is used
for repeatable validation of ordered chunks, no-output behavior, failures,
cancellation, time to first output, total duration, and unchanged application
stream consumption.

## Real Chrome Prompt API

Open the example with `?runtime=real` in a Chrome environment where
`window.LanguageModel` is available. The real mode uses:

```ts
expectedInputs: [{ type: "text", languages: ["en"] }]
expectedOutputs: [{ type: "text", languages: ["en"] }]
```

for both `LanguageModel.availability()` and `LanguageModel.create()`. The page
shows native runtime provenance, availability, Worker mode, Worker operational
state, incremental output, time to first output, total duration, and normalized
streaming telemetry.

The page also exposes existing lifecycle/final-delivery-attempt diagnostics in
the runtime status panel when a lifecycle transition occurs. This reuses the
shared lifecycle implementation from Slice 5; support-triage remains the primary
non-streaming lifecycle proof surface.

Telemetry remains metadata-oriented by default. Raw generated stream content is
not sent to the telemetry Worker merely for telemetry, and native mode never
falls back silently to the deterministic fixture.

For screen recording, show the runtime selector, run the stream, point to the
incremental application output, then inspect TTFO, total duration, Worker state,
and normalized telemetry.
