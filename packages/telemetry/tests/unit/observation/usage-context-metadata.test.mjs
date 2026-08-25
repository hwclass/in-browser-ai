import assert from "assert";
import { extractUsageContext } from "../../../dist/src/shell/runtimes/prompt-api/extract-usage-context.js";
import { normalizePromptObservation } from "../../../dist/src/core/observation/normalize-observation.js";

const source = {
  usage: { inputTokens: 12, outputTokens: 7, ignored: "nope" },
  context: { contextWindowUsed: 19, contextWindowLimit: 1024 }
};

assert.deepEqual(extractUsageContext(source), {
  usage: { inputTokens: 12, outputTokens: 7 },
  context: { contextWindowUsed: 19, contextWindowLimit: 1024 }
});

assert.deepEqual(extractUsageContext("raw prompt text"), {});
assert.deepEqual(extractUsageContext({ usage: { inputTokens: "not-a-number" } }), {});

const observation = normalizePromptObservation({
  observationId: "obs_1",
  sessionId: "session_1",
  operationId: "op_1",
  operation: "prompt",
  startedAt: 1,
  endedAt: 2,
  outcome: "success",
  runtime: {
    runtimeType: "prompt-api",
    availability: "available",
    streamingSupport: "unknown",
    structuredOutputSupport: "unknown"
  },
  usage: { inputTokens: 12 },
  context: { contextWindowLimit: 1024 }
});

assert.equal(observation.usage.inputTokens, 12);
assert.equal(observation.context.contextWindowLimit, 1024);
