import assert from "assert";
import { observePromptApi } from "../../dist/src/public/index.js";

function createConsoleSink() {
  const observations = [];
  return {
    destination: { type: "console", write: (observation) => observations.push(observation) },
    observations
  };
}

const successSink = createConsoleSink();
const successSession = {
  async prompt(input) {
    assert.equal(input, "Please triage this support ticket");
    return "Billing: replacement requested";
  },
  usage: { inputTokens: 8, outputTokens: 4 }
};

const controller = observePromptApi({
  session: successSession,
  destinations: [successSink.destination],
  runtime: { availability: "available" }
});

const result = await controller.prompt("Please triage this support ticket");
assert.equal(result, "Billing: replacement requested");
await controller.flush();
assert.equal(successSink.observations.length, 1);
assert.equal(successSink.observations[0].operation, "prompt");
assert.equal(successSink.observations[0].outcome, "success");
assert.equal(successSink.observations[0].usage.inputTokens, 8);
assert.equal("input" in successSink.observations[0], false);
assert.equal("output" in successSink.observations[0], false);

const failure = new Error("The operation was aborted");
failure.name = "AbortError";
const failureSink = createConsoleSink();
const failureController = observePromptApi({
  session: {
    async prompt() {
      throw failure;
    }
  },
  destinations: [failureSink.destination],
  runtime: { availability: "available" }
});

await assert.rejects(() => failureController.prompt("cancel me"), failure);
await failureController.flush();
assert.equal(failureSink.observations[0].outcome, "cancelled");
assert.equal(failureSink.observations[0].error.name, "AbortError");
