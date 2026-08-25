import assert from "assert";
import { normalizePromptObservation } from "../../../dist/src/core/observation/normalize-observation.js";

const runtime = {
  runtimeType: "prompt-api",
  availability: "available",
  streamingSupport: "supported",
  structuredOutputSupport: "unknown"
};

const base = {
  observationId: "obs_stream",
  sessionId: "session_stream",
  operationId: "op_stream",
  operation: "promptStreaming",
  startedAt: 100,
  endedAt: 240,
  runtime
};

const success = normalizePromptObservation({
  ...base,
  outcome: "success",
  stream: {
    outputCount: 3,
    producedOutput: true,
    timeToFirstOutputMs: 25
  },
  usage: { outputTokens: 9 }
});

assert.equal(success.operation, "promptStreaming");
assert.equal(success.durationMs, 140);
assert.equal(success.timeToFirstOutputMs, 25);
assert.deepEqual(success.stream, { outputCount: 3, producedOutput: true });
assert.equal(success.usage.outputTokens, 9);
assert.equal("input" in success, false);
assert.equal("output" in success, false);
assert.equal("chunks" in success, false);

const noOutput = normalizePromptObservation({
  ...base,
  outcome: "success",
  stream: {
    outputCount: 0,
    producedOutput: false
  }
});
assert.equal(noOutput.timeToFirstOutputMs, undefined);
assert.deepEqual(noOutput.stream, { outputCount: 0, producedOutput: false });

const failed = normalizePromptObservation({
  ...base,
  outcome: "error",
  error: new Error("stream exploded"),
  stream: {
    outputCount: 1,
    producedOutput: true,
    timeToFirstOutputMs: 10
  }
});
assert.equal(failed.outcome, "error");
assert.equal(failed.error.message, "stream exploded");

const cancelled = normalizePromptObservation({
  ...base,
  outcome: "cancelled",
  error: { name: "AbortError", message: "cancelled" },
  stream: {
    outputCount: 1,
    producedOutput: true,
    timeToFirstOutputMs: 10
  }
});
assert.equal(cancelled.outcome, "cancelled");
assert.equal(cancelled.error.name, "AbortError");
