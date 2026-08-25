import assert from "assert";
import { observePromptApi } from "../../dist/src/public/index.js";
import { buildPromptObservationPayload } from "../../dist/src/shell/runtimes/prompt-api/build-observation-message.js";
import { createObservationMessage } from "../../dist/src/shell/worker/protocol.js";
import { validateTelemetryWorkerMessage } from "../../dist/src/shell/worker/validate-message.js";

const privatePrompt = "PRIVATE_DOCUMENT_SENTINEL employee salary and medical notes";
const privateResponse = "PRIVATE_RESPONSE_SENTINEL summarize locally only";
const observations = [];

const controller = observePromptApi({
  capture: "metadata",
  session: {
    async prompt(input) {
      assert.equal(input, privatePrompt);
      return privateResponse;
    }
  },
  destinations: [{ type: "console", write: (observation) => observations.push(observation) }],
  runtime: { availability: "available" }
});

const appResult = await controller.prompt(privatePrompt);
assert.equal(appResult, privateResponse);
assert.equal(observations.length, 1);
assert.equal(observations[0].capture.mode, "metadata");
assert.equal("input" in observations[0].capture, false);
assert.equal("output" in observations[0].capture, false);

const observedJson = JSON.stringify(observations);
assert.equal(observedJson.includes("PRIVATE_DOCUMENT_SENTINEL"), false);
assert.equal(observedJson.includes("PRIVATE_RESPONSE_SENTINEL"), false);

const metadataPayload = buildPromptObservationPayload({
  captureMode: "metadata",
  observationId: "obs_metadata",
  sessionId: "session_metadata",
  operationId: "op_metadata",
  operation: "prompt",
  startedAt: 1,
  endedAt: 2,
  outcome: "success",
  runtime: {
    runtimeType: "prompt-api",
    availability: "available",
    streamingSupport: "unknown",
    structuredOutputSupport: "unknown"
  },
  input: privatePrompt,
  output: privateResponse
});
const messageJson = JSON.stringify(createObservationMessage(metadataPayload));
assert.equal(messageJson.includes("PRIVATE_DOCUMENT_SENTINEL"), false);
assert.equal(messageJson.includes("PRIVATE_RESPONSE_SENTINEL"), false);

const validMetadataMessage = createObservationMessage(metadataPayload);
assert.equal(validateTelemetryWorkerMessage(validMetadataMessage), true);

const invalidMetadataPayload = buildPromptObservationPayload({
  captureMode: "metadata",
  observationId: "obs_invalid",
  sessionId: "session_invalid",
  operationId: "op_invalid",
  operation: "prompt",
  startedAt: 1,
  endedAt: 2,
  outcome: "success",
  runtime: {
    runtimeType: "prompt-api",
    availability: "available",
    streamingSupport: "unknown",
    structuredOutputSupport: "unknown"
  },
  input: privatePrompt,
  output: privateResponse
});
const invalidMessage = createObservationMessage({
  ...invalidMetadataPayload,
  capture: { ...invalidMetadataPayload.capture, input: privatePrompt }
});
assert.equal(validateTelemetryWorkerMessage(invalidMessage), false);

const redactedPayload = buildPromptObservationPayload({
  captureMode: "redacted",
  observationId: "obs_redacted",
  sessionId: "session_redacted",
  operationId: "op_redacted",
  operation: "prompt",
  startedAt: 1,
  endedAt: 2,
  outcome: "success",
  runtime: {
    runtimeType: "prompt-api",
    availability: "available",
    streamingSupport: "unknown",
    structuredOutputSupport: "unknown"
  },
  input: privatePrompt,
  output: privateResponse
});
assert.equal(JSON.stringify(redactedPayload).includes("PRIVATE_DOCUMENT_SENTINEL"), false);
assert.equal(validateTelemetryWorkerMessage(createObservationMessage(redactedPayload)), true);

const fullPayload = buildPromptObservationPayload({
  captureMode: "full",
  observationId: "obs_full",
  sessionId: "session_full",
  operationId: "op_full",
  operation: "prompt",
  startedAt: 1,
  endedAt: 2,
  outcome: "success",
  runtime: {
    runtimeType: "prompt-api",
    availability: "available",
    streamingSupport: "unknown",
    structuredOutputSupport: "unknown"
  },
  input: privatePrompt,
  output: privateResponse
});
assert.equal(fullPayload.capture.input, privatePrompt);
assert.equal(fullPayload.capture.output, privateResponse);
assert.equal(validateTelemetryWorkerMessage(createObservationMessage(fullPayload)), true);
