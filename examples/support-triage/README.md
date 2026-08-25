# Support Triage

This example demonstrates prompt telemetry and the primary non-streaming PoC
flow through:

```text
Prompt API session
-> observation shell
-> typed Worker protocol
-> browser Dedicated Worker
-> Functional Core normalization
-> console destination
-> telemetry panel
```

The default mode is `DETERMINISTIC TEST RUNTIME`, which uses a fake
Prompt API-compatible session for repeatable tests. The page shows the active
capture mode, runtime provenance, availability/session state, Worker state,
startup queue/lifecycle diagnostics, destination counts, application result, and
normalized telemetry.

Use `REAL CHROME PROMPT API` from the runtime selector, or open:

```text
http://127.0.0.1:4173/examples/support-triage/?runtime=real
```

Real mode uses `window.LanguageModel` directly. It reports the native
availability value, model readiness/download state, real download progress where
Chrome exposes it, user activation at session creation, session creation state,
prompt execution state, Worker mode, inference result, and normalized telemetry.

The automated real-runtime compatibility gate is:

```bash
npm run test:e2e:real-prompt-api
```

That test records BLOCKED/UNAVAILABLE, DOWNLOADABLE, DOWNLOADING, available,
create-failed, prompt-failed, and prompt-succeeded states separately. It launches
installed Google Chrome with an isolated persistent profile so model download
state can survive repeated runs. It never uses the deterministic fake as a
substitute for the native Prompt API.

If Chrome reports `downloadable` or `downloading`, the real-mode click handler
calls the native `LanguageModel.create({ monitor })` and displays progress
events. If the model cannot become ready before the configured timeout, the test
records the exact blocker instead of passing.

For screen recording, show the runtime selector, click the run button, then
inspect Runtime Status, Application Result, and Telemetry. The important
evidence is visible on the page; DevTools is optional.
