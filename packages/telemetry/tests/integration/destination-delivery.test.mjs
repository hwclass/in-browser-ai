import assert from "assert";
import { observePromptApi } from "../../dist/src/public/index.js";
import { createObservationMessage } from "../../dist/src/shell/worker/protocol.js";

const consoleObservations = [];
const requests = [];
const statuses = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  requests.push({ url: String(url), init });
  if (String(url).includes("/fail")) {
    throw new TypeError("simulated collector failure");
  }
  return { ok: true, status: 204 };
};

const controller = observePromptApi({
  capture: "metadata",
  session: {
    async prompt() {
      return "ORDER_RESULT_SENTINEL";
    }
  },
  destinations: [
    { type: "console", id: "console-a", write: (observation) => consoleObservations.push(observation) },
    {
      type: "otlp",
      id: "collector-a",
      endpoint: "https://collector.example/v1/logs",
      headers: { "x-public-token": "test" }
    },
    {
      type: "otlp",
      id: "collector-b",
      endpoint: "https://collector.example/fail/v1/logs"
    }
  ],
  runtime: { availability: "available" },
  onStatus(status) {
    statuses.push(status);
  }
});

const result = await controller.prompt("ORDER_PROMPT_SENTINEL");
assert.equal(result, "ORDER_RESULT_SENTINEL");
assert.equal(consoleObservations.length, 1);
assert.equal(requests.length, 2);
assert.equal(requests[0].url, "https://collector.example/v1/logs");
assert.equal(requests[0].init.method, "POST");
assert.equal(requests[0].init.headers["content-type"], "application/json");
assert.equal(requests[0].init.headers["x-public-token"], "test");
assert.equal(requests[1].url, "https://collector.example/fail/v1/logs");
assert.equal(requests[1].init.method, "POST");

const successfulOtlpBody = JSON.stringify(JSON.parse(requests[0].init.body));
const failedOtlpBody = JSON.stringify(JSON.parse(requests[1].init.body));
const consoleObservationId = consoleObservations[0].observationId;
assert.equal(successfulOtlpBody.includes("obs_"), false);
assert.equal(successfulOtlpBody.includes(consoleObservationId), true);
assert.equal(failedOtlpBody.includes(consoleObservationId), true);
assert.equal(successfulOtlpBody.includes("ORDER_PROMPT_SENTINEL"), false);
assert.equal(successfulOtlpBody.includes("ORDER_RESULT_SENTINEL"), false);
assert.equal(failedOtlpBody.includes("ORDER_PROMPT_SENTINEL"), false);
assert.equal(failedOtlpBody.includes("ORDER_RESULT_SENTINEL"), false);
assert.equal(JSON.stringify(consoleObservations).includes("ORDER_PROMPT_SENTINEL"), false);
assert.equal(JSON.stringify(consoleObservations).includes("ORDER_RESULT_SENTINEL"), false);
assert.equal(statuses.some((status) => status.type === "destination.sent" && status.destinationId === "collector-a"), true);
assert.equal(statuses.some((status) => status.type === "destination.failed" && status.destinationId === "collector-b"), true);
assert.equal(statuses.some((status) => status.type === "destination.sent" && status.destinationId === "console-a"), true);
for (const status of statuses.filter((item) => item.type.startsWith("destination."))) {
  assert.equal(status.observationId, consoleObservationId);
}
assert.equal(consoleObservations[0].capture.mode, "metadata");
assert.equal("input" in consoleObservations[0].capture, false);
assert.equal("output" in consoleObservations[0].capture, false);

const workerMessageJson = JSON.stringify(createObservationMessage(consoleObservations[0], {
  destinations: [
    { type: "console", id: "console-a" },
    { type: "otlp", id: "collector-a", endpoint: "https://collector.example/v1/logs", encoding: "otlp-http-json" },
    { type: "otlp", id: "collector-b", endpoint: "https://collector.example/fail/v1/logs", encoding: "otlp-http-json" }
  ]
}));
assert.equal(workerMessageJson.includes("ORDER_PROMPT_SENTINEL"), false);
assert.equal(workerMessageJson.includes("ORDER_RESULT_SENTINEL"), false);
globalThis.fetch = originalFetch;
