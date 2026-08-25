import assert from "assert";
import { mapToOtlpHttpJson } from "../../../dist/src/shell/transport/map-to-otlp-http-json.js";

const observation = {
  schemaVersion: "0.1.0",
  observationId: "obs_map",
  sessionId: "session_map",
  operationId: "op_map",
  operation: "promptStreaming",
  startedAt: "2026-08-24T00:00:00.000Z",
  endedAt: "2026-08-24T00:00:01.250Z",
  durationMs: 1250,
  timeToFirstOutputMs: 80,
  outcome: "success",
  runtime: {
    runtimeType: "prompt-api",
    browserFamily: "chromium",
    browserMajor: 151,
    availability: "available",
    streamingSupport: "supported",
    structuredOutputSupport: "unknown"
  },
  usage: { inputTokens: 4, outputTokens: 9 },
  capture: { mode: "metadata", inputCharacters: 27, outputCharacters: 41 },
  stream: { outputCount: 3, producedOutput: true }
};

const payload = mapToOtlpHttpJson(observation);
assert.equal(Array.isArray(payload.resourceLogs), true);
const record = payload.resourceLogs[0].scopeLogs[0].logRecords[0];
assert.equal(record.body.stringValue, "browser_ai.inference");

const attributes = Object.fromEntries(record.attributes.map((attribute) => [attribute.key, attribute.value]));
assert.deepEqual(attributes["browser_ai.observation_id"], { stringValue: "obs_map" });
assert.deepEqual(attributes["browser_ai.operation"], { stringValue: "promptStreaming" });
assert.deepEqual(attributes["browser_ai.capture.mode"], { stringValue: "metadata" });
assert.deepEqual(attributes["browser_ai.duration_ms"], { intValue: "1250" });
assert.deepEqual(attributes["browser_ai.time_to_first_output_ms"], { intValue: "80" });
assert.deepEqual(attributes["browser_ai.observation_json"], { stringValue: JSON.stringify(observation) });
assert.equal(JSON.stringify(payload).includes("PRIVATE_SENTINEL"), false);
