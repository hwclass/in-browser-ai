import assert from "assert";
import {
  createFlushRequestMessage,
  createFlushResultMessage,
  isTelemetryWorkerMessage,
  TELEMETRY_WORKER_PROTOCOL_VERSION
} from "../../../dist/src/shell/worker/protocol.js";
import { validateTelemetryWorkerMessage } from "../../../dist/src/shell/worker/validate-message.js";

const request = createFlushRequestMessage({
  reason: "lifecycle",
  keepalive: true,
  allowBeaconFallback: false,
  pendingCount: 2
}, {
  messageId: "flush_1",
  createdAt: "2026-08-24T00:00:00.000Z"
});

assert.deepEqual(request, {
  protocolVersion: TELEMETRY_WORKER_PROTOCOL_VERSION,
  messageId: "flush_1",
  type: "worker.flush",
  createdAt: "2026-08-24T00:00:00.000Z",
  payload: {
    reason: "lifecycle",
    keepalive: true,
    allowBeaconFallback: false,
    pendingCount: 2
  }
});
assert.equal(isTelemetryWorkerMessage(request), true);
assert.equal(validateTelemetryWorkerMessage(request), true);

const result = createFlushResultMessage({
  requestMessageId: "flush_1",
  reason: "lifecycle",
  attempted: true,
  pendingCount: 2,
  deliveryAttempts: []
}, {
  messageId: "flush_result_1",
  createdAt: "2026-08-24T00:00:00.010Z"
});

assert.equal(result.type, "worker.flushResult");
assert.equal(result.payload.requestMessageId, "flush_1");
assert.equal(result.payload.attempted, true);
assert.equal(isTelemetryWorkerMessage(result), true);
assert.equal(validateTelemetryWorkerMessage(result), true);
