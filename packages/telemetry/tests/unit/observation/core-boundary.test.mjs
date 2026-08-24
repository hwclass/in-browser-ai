import assert from "assert";
import { readFile } from "fs/promises";
import { normalizePromptObservation } from "../../../dist/src/core/observation/normalize-observation.js";

const coreFiles = [
  "packages/telemetry/src/core/capture/apply-capture-policy.ts",
  "packages/telemetry/src/core/capture/redact-content.ts",
  "packages/telemetry/src/core/capture/types.ts",
  "packages/telemetry/src/core/observation/types.ts",
  "packages/telemetry/src/core/observation/normalize-observation.ts",
  "packages/telemetry/src/core/observation/timing.ts",
  "packages/telemetry/src/core/routing/normalize-delivery-result.ts",
  "packages/telemetry/src/core/routing/plan-deliveries.ts",
  "packages/telemetry/src/core/routing/types.ts"
];

for (const file of coreFiles) {
  const source = await readFile(file, "utf8");
  assert(!source.includes("window"), `${file} must not reference window`);
  assert(!source.includes("Worker"), `${file} must not reference Worker globals or protocol`);
  assert(!/from .*prompt-api/.test(source), `${file} must not import Prompt API shell modules`);
  assert(!source.includes("fetch"), `${file} must not reference fetch`);
  assert(!source.includes("console."), `${file} must not perform console side effects`);
  assert(!source.includes("lifecycle"), `${file} must not reference lifecycle APIs`);
  assert(!source.includes("shell/worker/protocol"), `${file} must not import Worker protocol`);
}

assert.equal(typeof normalizePromptObservation, "function");
