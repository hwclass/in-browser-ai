import assert from "assert";
import { observePromptApi } from "../../dist/src/public/index.js";

const statuses = [];
const controller = observePromptApi({
  session: {
    async prompt() {
      return "app survives worker constructor failure";
    }
  },
  worker: {
    startupQueueCapacity: 1,
    workerFactory() {
      throw new TypeError("worker constructor blocked");
    }
  },
  onStatus(status) {
    statuses.push(status);
  }
});

assert.equal(await controller.prompt("prompt"), "app survives worker constructor failure");
assert.equal(statuses.some((status) => status.type === "worker.failed" && status.phase === "initialization"), true);
assert.equal(controller.status.workerOperational, true);
