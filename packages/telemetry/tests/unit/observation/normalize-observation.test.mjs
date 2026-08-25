import assert from "assert";
import { normalizePromptObservation } from "../../../dist/src/core/observation/normalize-observation.js";

const runtime = {
  runtimeType: "prompt-api",
  availability: "available",
  streamingSupport: "unknown",
  structuredOutputSupport: "unknown"
};

const base = {
  observationId: "obs_1",
  sessionId: "session_1",
  operationId: "op_1",
  operation: "prompt",
  startedAt: 100,
  endedAt: 150,
  runtime
};

assert.equal(normalizePromptObservation({ ...base, outcome: "success" }).durationMs, 50);
assert.equal(normalizePromptObservation({ ...base, outcome: "success" }).outcome, "success");

const errorObservation = normalizePromptObservation({
  ...base,
  outcome: "error",
  error: new TypeError("Prompt failed")
});
assert.equal(errorObservation.error.name, "TypeError");
assert.equal(errorObservation.error.message, "Prompt failed");

const cancelled = normalizePromptObservation({
  ...base,
  outcome: "cancelled",
  error: { name: "AbortError", message: "The operation was aborted", code: "ABORT_ERR" }
});
assert.equal(cancelled.outcome, "cancelled");
assert.equal(cancelled.error.code, "ABORT_ERR");
