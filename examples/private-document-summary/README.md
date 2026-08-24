# Private Document Summary

This example demonstrates the Slice 3 capture modes for Prompt API telemetry.

- `metadata` is the default and exports timing, runtime, usage, and character counts without prompt or response text.
- `redacted` must be selected explicitly and exports deterministic placeholders such as `[redacted 42 chars]`.
- `full` must be selected explicitly and may export the private document text and summary text.

The page makes the capture choice visible before each run and shows exported
telemetry in-place:

- metadata mode keeps the private document and generated summary content absent
  from telemetry;
- redacted mode shows only deterministic placeholder text;
- full mode is explicit and visibly content-bearing.

The redaction mode is a deterministic PoC transformation. It should not be read
as a stronger privacy guarantee than the displayed placeholder behavior.

Run it with:

```sh
npm run build
npm run examples
```

Then open `http://127.0.0.1:4173/examples/private-document-summary/`.
