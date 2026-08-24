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
assert.deepEqual(successSink.observations[0].capture, {
  mode: "metadata",
  inputCharacters: 33,
  outputCharacters: 30
});
assert.equal("input" in successSink.observations[0].capture, false);
assert.equal("output" in successSink.observations[0].capture, false);

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
assert.equal(failureSink.observations[0].capture.mode, "metadata");
assert.equal("input" in failureSink.observations[0].capture, false);

const redactedSink = createConsoleSink();
const redactedController = observePromptApi({
  capture: "redacted",
  session: {
    async prompt(input) {
      assert.equal(input, "PROMPT_PRIVATE_SENTINEL");
      return "RESPONSE_PRIVATE_SENTINEL";
    }
  },
  destinations: [redactedSink.destination],
  runtime: { availability: "available" }
});
assert.equal(await redactedController.prompt("PROMPT_PRIVATE_SENTINEL"), "RESPONSE_PRIVATE_SENTINEL");
assert.equal(redactedSink.observations[0].capture.mode, "redacted");
assert.equal(redactedSink.observations[0].capture.input, "[redacted 23 chars]");
assert.equal(redactedSink.observations[0].capture.output, "[redacted 25 chars]");
assert.equal(JSON.stringify(redactedSink.observations[0]).includes("PROMPT_PRIVATE_SENTINEL"), false);
assert.equal(JSON.stringify(redactedSink.observations[0]).includes("RESPONSE_PRIVATE_SENTINEL"), false);

const fullSink = createConsoleSink();
const fullController = observePromptApi({
  capture: "full",
  session: {
    async prompt(input) {
      assert.equal(input, "PROMPT_FULL_SENTINEL");
      return "RESPONSE_FULL_SENTINEL";
    }
  },
  destinations: [fullSink.destination],
  runtime: { availability: "available" }
});
assert.equal(await fullController.prompt("PROMPT_FULL_SENTINEL"), "RESPONSE_FULL_SENTINEL");
assert.equal(fullSink.observations[0].capture.mode, "full");
assert.equal(fullSink.observations[0].capture.input, "PROMPT_FULL_SENTINEL");
assert.equal(fullSink.observations[0].capture.output, "RESPONSE_FULL_SENTINEL");
