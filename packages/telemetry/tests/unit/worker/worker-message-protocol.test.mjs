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
