import assert from "assert";
import { observePromptApi } from "../../dist/src/public/index.js";

const consoleObservations = [];
const statuses = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => {
  throw new TypeError("network blocked");
};

const failingOtlpController = observePromptApi({
  session: {
    async prompt() {
      return "app result";
    }
  },
  destinations: [
    { type: "console", id: "console-ok", write: (observation) => consoleObservations.push(observation) },
    {
      type: "otlp",
      id: "otlp-fail",
      endpoint: "https://collector.example/fail"
    }
  ],
  runtime: { availability: "available" },
  onStatus(status) {
    statuses.push(status);
  }
});

assert.equal(await failingOtlpController.prompt("prompt"), "app result");
assert.equal(consoleObservations.length, 1);
assert.equal(statuses.some((status) => status.type === "destination.sent" && status.destinationId === "console-ok"), true);
assert.equal(statuses.some((status) => status.type === "destination.failed" && status.destinationId === "otlp-fail"), true);

const requests = [];
const consoleFailureStatuses = [];
globalThis.fetch = async (url, init) => {
  requests.push({ url: String(url), init });
  return { ok: true, status: 200 };
};
const consoleFailingController = observePromptApi({
  capture: "full",
  session: {
    async prompt() {
      return "FULL_RESPONSE_SENTINEL";
    }
  },
  destinations: [
    {
      type: "console",
      id: "console-fail",
      write() {
        throw new Error("console unavailable");
      }
    },
    {
      type: "otlp",
      id: "otlp-ok",
      endpoint: "https://collector.example/ok"
    }
  ],
  runtime: { availability: "available" },
  onStatus(status) {
    consoleFailureStatuses.push(status);
  }
});

assert.equal(await consoleFailingController.prompt("FULL_PROMPT_SENTINEL"), "FULL_RESPONSE_SENTINEL");
assert.equal(requests.length, 1);
assert.equal(consoleFailureStatuses.some((status) => status.type === "destination.failed" && status.destinationId === "console-fail"), true);
assert.equal(consoleFailureStatuses.some((status) => status.type === "destination.sent" && status.destinationId === "otlp-ok"), true);
assert.equal(requests[0].init.body.includes("FULL_PROMPT_SENTINEL"), true);
assert.equal(requests[0].init.body.includes("FULL_RESPONSE_SENTINEL"), true);
globalThis.fetch = originalFetch;
