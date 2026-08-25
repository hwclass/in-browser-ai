import assert from "assert";
import { createStartupQueue } from "../../../dist/src/core/batching/startup-queue.js";

function observation(id) {
  return {
    protocolVersion: "telemetry.worker.v1",
    messageId: id,
    type: "observation.prompt",
    createdAt: "2026-08-24T00:00:00.000Z",
    payload: {
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
      capture: { mode: "metadata", inputCharacters: 20, outputCharacters: 10 }
    }
  };
}

const queue = createStartupQueue({ capacity: 2 });
assert.deepEqual(queue.snapshot(), {
  capacity: 2,
  queuedCount: 0,
  droppedCount: 0,
  drainStatus: "not-ready"
});

assert.equal(queue.enqueue(observation("obs_1")).status, "queued");
assert.equal(queue.enqueue(observation("obs_2")).status, "queued");
const overflow = queue.enqueue(observation("obs_3"));
assert.equal(overflow.status, "dropped");
assert.equal(overflow.droppedMessageId, "obs_3");
assert.deepEqual(queue.snapshot(), {
  capacity: 2,
  queuedCount: 2,
  droppedCount: 1,
  drainStatus: "not-ready"
});

assert.deepEqual(queue.drain().map((item) => item.messageId), ["obs_1", "obs_2"]);
assert.deepEqual(queue.snapshot(), {
  capacity: 2,
  queuedCount: 0,
  droppedCount: 1,
  drainStatus: "drained"
});

const zeroQueue = createStartupQueue({ capacity: 0 });
assert.equal(zeroQueue.enqueue(observation("obs_zero")).status, "dropped");
assert.deepEqual(zeroQueue.drain(), []);

const metadataJson = JSON.stringify(queue.enqueue(observation("obs_private")));
assert.equal(metadataJson.includes("PRIVATE_PROMPT_SENTINEL"), false);
assert.equal(metadataJson.includes("PRIVATE_RESPONSE_SENTINEL"), false);
