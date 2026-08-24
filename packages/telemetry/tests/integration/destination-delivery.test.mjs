import assert from "assert";
import { observePromptApi } from "../../dist/src/public/index.js";

const consoleObservations = [];
const requests = [];
const statuses = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  requests.push({ url: String(url), init });
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
assert.equal(requests.length, 1);
assert.equal(requests[0].url, "https://collector.example/v1/logs");
assert.equal(requests[0].init.method, "POST");
assert.equal(requests[0].init.headers["content-type"], "application/json");
assert.equal(requests[0].init.headers["x-public-token"], "test");

const body = JSON.stringify(JSON.parse(requests[0].init.body));
assert.equal(body.includes("obs_"), false);
assert.equal(body.includes(consoleObservations[0].observationId), true);
assert.equal(body.includes("ORDER_PROMPT_SENTINEL"), false);
assert.equal(body.includes("ORDER_RESULT_SENTINEL"), false);
assert.equal(statuses.some((status) => status.type === "destination.sent" && status.destinationId === "collector-a"), true);
assert.equal(statuses.some((status) => status.type === "destination.sent" && status.destinationId === "console-a"), true);
globalThis.fetch = originalFetch;
