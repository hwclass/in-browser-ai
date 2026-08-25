import assert from "assert";
import { planDeliveries } from "../../../dist/src/core/routing/plan-deliveries.js";
import { validateDestinations } from "../../../dist/src/public/validate-options.js";

const observation = {
  schemaVersion: "0.1.0",
  observationId: "obs_1",
  sessionId: "session_1",
  operationId: "op_1",
  operation: "prompt",
  startedAt: "2026-08-24T00:00:00.000Z",
  endedAt: "2026-08-24T00:00:00.010Z",
  durationMs: 10,
  outcome: "success",
  runtime: {
    runtimeType: "prompt-api",
    availability: "available",
    streamingSupport: "unknown",
    structuredOutputSupport: "unknown"
  },
  capture: { mode: "metadata", inputCharacters: 11, outputCharacters: 7 }
};

assert.deepEqual(planDeliveries(observation, undefined).map((item) => item.destination), [
  { type: "console", id: "console" }
]);

const planned = planDeliveries(observation, [
  { type: "console", id: "local-console" },
  { type: "otlp", id: "local-collector", endpoint: "/otlp/v1/logs" },
  { type: "otlp", endpoint: "/otlp/secondary", enabled: false },
  { type: "otlp", endpoint: "" }
]);

assert.equal(planned.length, 2);
assert.equal(planned[0].destinationId, "local-console");
assert.equal(planned[1].destinationId, "local-collector");
assert.strictEqual(planned[0].observation, observation);
assert.strictEqual(planned[1].observation, observation);
assert.equal(JSON.stringify(planned).includes("datadog"), false);
assert.equal(JSON.stringify(planned).includes("honeycomb"), false);

assert.throws(
  () => validateDestinations([{ type: "otlp", endpoint: "/otlp", headers: { authorization: "secret" } }]),
  /private browser header/
);
assert.deepEqual(validateDestinations([{ type: "otlp", endpoint: "/otlp" }]), [
  { type: "otlp", endpoint: "/otlp", encoding: "otlp-http-json" }
]);
