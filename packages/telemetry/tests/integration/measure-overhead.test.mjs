import assert from "assert";
import {
  calculateOverheadSummary,
  measurePayloadBytes,
  requireSeparatedOverheadSources
} from "../../dist/src/core/validation/measure-overhead.js";

const standard = calculateOverheadSummary({
  scenario: "support-triage",
  operation: "prompt",
  source: "integration",
  samples: [
    {
      baselineOperationMs: 100,
      instrumentedOperationMs: 104,
      observerMainThreadMs: 1.2,
      serializationMs: 0.3,
      postMessageMs: 0.2,
      workerProcessingMs: 0.7,
      exportNetworkMs: 12
    },
    {
      baselineOperationMs: 120,
      instrumentedOperationMs: 125,
      observerMainThreadMs: 1.4,
      serializationMs: 0.4,
      postMessageMs: 0.3,
      workerProcessingMs: 0.8,
      exportNetworkMs: 14
    }
  ],
  runConditions: "deterministic fake Prompt API-compatible prompt()"
});

assert.equal(standard.scenario, "support-triage");
assert.equal(standard.sampleCount, 2);
assert.equal(standard.baselineOperationMs.mean, 110);
assert.equal(standard.instrumentedOperationMs.mean, 114.5);
assert.equal(standard.instrumentationDeltaMs.mean, 4.5);
assert.equal(standard.modelRuntimeLatencyIncludedInOverhead, false);
assert.equal(standard.exportNetworkMs.mean, 13);

const streaming = calculateOverheadSummary({
  scenario: "streaming-assistant",
  operation: "promptStreaming",
  source: "deterministic-e2e-example",
  samples: [
    {
      baselineOperationMs: 30,
      instrumentedOperationMs: 34,
      observerMainThreadMs: 0.9,
      serializationMs: 0.2,
      postMessageMs: 0.1,
      workerProcessingMs: 0.6,
      firstOutputBufferedByTelemetry: false,
      summaryObservationCount: 1
    }
  ],
  runConditions: "deterministic streaming example-backed E2E"
});

assert.equal(streaming.operation, "promptStreaming");
assert.equal(streaming.firstOutputBufferedByTelemetry, false);
assert.equal(streaming.summaryObservationCount, 1);

const payload = measurePayloadBytes({
  observationId: "obs_example",
  operation: "prompt",
  capture: { mode: "metadata", inputCharacters: 12, outputCharacters: 8 }
});
assert.equal(payload.bytes > 0, true);
assert.equal(payload.shape, "json-serializable");

assert.doesNotThrow(() =>
  requireSeparatedOverheadSources([
    standard,
    streaming,
    {
      scenario: "native-prompt",
      operation: "prompt",
      source: "native-chrome",
      sampleCount: 1,
      runConditions: "real Chrome Prompt API run",
      baselineOperationMs: { mean: 0, min: 0, max: 0 },
      instrumentedOperationMs: { mean: 0, min: 0, max: 0 },
      instrumentationDeltaMs: { mean: 0, min: 0, max: 0 },
      modelRuntimeLatencyIncludedInOverhead: false,
      nativeRuntimeLatencyMs: { mean: 82000, min: 82000, max: 82000 }
    }
  ])
);

assert.throws(
  () =>
    requireSeparatedOverheadSources([
      {
        ...standard,
        source: "native-chrome",
        modelRuntimeLatencyIncludedInOverhead: true
      }
    ]),
  /Native Prompt API latency must not be reported as telemetry overhead/
);
