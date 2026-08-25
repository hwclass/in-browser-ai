import assert from "assert";
import {
  TELEMETRY_WORKER_PROTOCOL_VERSION,
  createObservationMessage,
  isTelemetryWorkerMessage
} from "../../../dist/src/shell/worker/protocol.js";

const message = createObservationMessage({
  messageId: "msg_1",
  observationId: "obs_1",
  sessionId: "session_1",
  operationId: "op_1",
  operation: "prompt",
  startedAt: 1,
  endedAt: 2,
  outcome: "success",
  runtime: {
    runtimeType: "prompt-api",
    availability: "available",
    streamingSupport: "unknown",
    structuredOutputSupport: "unknown"
  }
});

assert.equal(message.protocolVersion, TELEMETRY_WORKER_PROTOCOL_VERSION);
assert.equal(message.type, "observation.prompt");
assert.equal(isTelemetryWorkerMessage(message), true);
assert.deepEqual(JSON.parse(JSON.stringify(message)), message);
assert.equal("input" in message.payload, false);
assert.equal("output" in message.payload, false);
assert.equal(isTelemetryWorkerMessage({ type: "observation.prompt" }), false);

const streamingMessage = createObservationMessage({
  messageId: "msg_stream",
  observationId: "obs_stream",
  sessionId: "session_1",
  operationId: "op_stream",
  operation: "promptStreaming",
  startedAt: 1,
  endedAt: 5,
  outcome: "success",
  runtime: {
    runtimeType: "prompt-api",
    availability: "available",
    streamingSupport: "supported",
    structuredOutputSupport: "unknown"
  },
  stream: {
    outputCount: 2,
    producedOutput: true,
    timeToFirstOutputMs: 1
  }
});

assert.equal(streamingMessage.type, "observation.promptStreaming");
assert.equal(isTelemetryWorkerMessage(streamingMessage), true);
assert.deepEqual(JSON.parse(JSON.stringify(streamingMessage)), streamingMessage);
assert.equal("chunks" in streamingMessage.payload, false);
