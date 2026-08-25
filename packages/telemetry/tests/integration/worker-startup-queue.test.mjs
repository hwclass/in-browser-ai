import assert from "assert";
import { createWorkerBridge } from "../../dist/src/shell/worker/worker-bridge.js";
import { processTelemetryWorkerMessage } from "../../dist/src/worker/telemetry-worker.js";

class DelayedWorker {
  static instances = [];

  onmessage = null;
  onerror = null;
  posted = [];

  constructor() {
    DelayedWorker.instances.push(this);
  }

  postMessage(message) {
    this.posted.push(JSON.parse(JSON.stringify(message)));
    void processTelemetryWorkerMessage(message).then((result) => {
      this.onmessage?.({
        data: {
          protocolVersion: message.protocolVersion,
          messageId: message.messageId,
          type: "observation.normalized",
          createdAt: "2026-08-24T00:00:00.010Z",
          payload: result
        }
      });
    });
  }

  ready() {
    this.onmessage?.({
      data: {
        protocolVersion: "telemetry.worker.v1",
        messageId: "ready_1",
        type: "worker.ready",
        createdAt: "2026-08-24T00:00:00.000Z",
        payload: {}
      }
    });
  }
}

function payload(id) {
  return {
    schemaVersion: "0.1.0",
    observationId: id,
    sessionId: "session_1",
    operationId: `op_${id}`,
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
    capture: { mode: "metadata", inputCharacters: 23, outputCharacters: 17 }
  };
}

const statuses = [];
const bridge = createWorkerBridge([], (status) => statuses.push(status), {
  startupQueueCapacity: 2,
  workerFactory: () => new DelayedWorker()
});

assert.equal(bridge.mode, "browser-worker");
assert.equal(bridge.isOperational(), false);
assert.equal(await bridge.postObservation(payload("obs_1")), undefined);
assert.equal(await bridge.postObservation(payload("obs_2")), undefined);
assert.equal(await bridge.postObservation(payload("obs_3")), undefined);
assert.deepEqual(bridge.snapshot().startupQueue, {
  capacity: 2,
  queuedCount: 2,
  droppedCount: 1,
  drainStatus: "not-ready"
});

DelayedWorker.instances[0].ready();
await bridge.flush();

assert.deepEqual(DelayedWorker.instances[0].posted.filter((message) => message.type === "observation.prompt").map((message) => message.messageId), ["obs_1", "obs_2"]);
assert.equal(statuses.some((status) => status.type === "startupQueue.queued" && status.messageId === "obs_1"), true);
assert.equal(statuses.some((status) => status.type === "startupQueue.dropped" && status.messageId === "obs_3"), true);
assert.equal(statuses.some((status) => status.type === "startupQueue.drained" && status.drainedCount === 2), true);
assert.equal(JSON.stringify(DelayedWorker.instances[0].posted).includes("PRIVATE_PROMPT_SENTINEL"), false);
