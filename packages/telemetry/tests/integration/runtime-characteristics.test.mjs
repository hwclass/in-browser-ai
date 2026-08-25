import assert from "assert";
import { observePromptApi } from "../../dist/src/public/index.js";
import { inspectPromptApiAvailability } from "../../dist/src/shell/runtimes/prompt-api/availability.js";

const unavailable = inspectPromptApiAvailability({
  languageModelPresent: false,
  userAgent: "Mozilla/5.0 Firefox/128.0"
});

assert.deepEqual(unavailable, {
  runtimeType: "prompt-api",
  browserFamily: "firefox",
  browserMajor: 128,
  availability: "unavailable",
  streamingSupport: "unsupported",
  structuredOutputSupport: "unknown"
});

const session = {
  usage: { inputTokens: 1, outputTokens: 2 },
  async prompt() {
    return "ok";
  },
  promptStreaming() {
    return (async function* () {
      yield "ok";
    })();
  }
};

const observations = [];
const controller = observePromptApi({
  session,
  worker: { forceInProcess: true },
  destinations: [{
    type: "console",
    write(observation) {
      observations.push(observation);
    }
  }]
});

assert.equal(await controller.prompt("hello"), "ok");
assert.equal(observations.length, 1);
assert.equal(observations[0].runtime.runtimeType, "prompt-api");
assert.equal(observations[0].runtime.availability, "unknown");
assert.equal(observations[0].runtime.streamingSupport, "supported");
assert.equal(observations[0].runtime.structuredOutputSupport, "unknown");
assert.equal(JSON.stringify(observations[0].runtime).includes("GPU"), false);
assert.equal(JSON.stringify(observations[0].runtime).includes("modelName"), false);
