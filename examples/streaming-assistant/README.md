# Streaming Assistant

This example demonstrates Slice 2 streaming observability for Prompt API
`promptStreaming()`.

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

Slice 2 remains metadata-oriented. Raw generated stream content is not sent to
the telemetry Worker merely for telemetry.
