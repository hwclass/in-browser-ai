import assert from "assert";
import { observePromptApi } from "../../dist/src/public/index.js";

class FailingWorker {
  onmessage = null;
  onerror = null;

  constructor() {
    queueMicrotask(() => {
      this.onmessage?.({
        data: {
          protocolVersion: "telemetry.worker.v1",
          messageId: "ready_1",
          type: "worker.ready",
          createdAt: "2026-08-24T00:00:00.000Z",
          payload: {}
        }
      });
    });
  }

  postMessage(message) {
    this.onmessage?.({
      data: {
        protocolVersion: message.protocolVersion,
        messageId: message.messageId,
        type: "worker.processingFailed",
        createdAt: "2026-08-24T00:00:00.010Z",
        payload: {
          phase: "processing",
          error: { name: "Error", message: "normalization exploded" }
        }
      }
    });
  }
}

const statuses = [];
const controller = observePromptApi({
  session: {
    async prompt() {
      return "app result despite telemetry failure";
    }
  },
  worker: {
    workerFactory: () => new FailingWorker()
  },
  onStatus(status) {
    statuses.push(status);
  }
});

assert.equal(await controller.prompt("PROCESSING_FAILURE_PROMPT"), "app result despite telemetry failure");
assert.equal(statuses.some((status) => status.type === "worker.ready"), true);
assert.equal(statuses.some((status) => status.type === "worker.processingFailed"), true);
assert.equal(JSON.stringify(statuses).includes("PROCESSING_FAILURE_PROMPT"), false);
