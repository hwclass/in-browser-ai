import assert from "assert";
import { normalizeRuntimeCharacteristics } from "../../../dist/src/core/runtime/normalize-runtime.js";

assert.deepEqual(normalizeRuntimeCharacteristics({ runtimeType: "prompt-api" }), {
  runtimeType: "prompt-api",
  availability: "unknown",
  streamingSupport: "unknown",
  structuredOutputSupport: "unknown"
});

assert.deepEqual(normalizeRuntimeCharacteristics({
  runtimeType: "prompt-api",
  browserFamily: "Chromium",
  browserMajor: "151",
  availability: "available",
  streamingSupport: true,
  structuredOutputSupport: false
}), {
  runtimeType: "prompt-api",
  browserFamily: "chromium",
  browserMajor: 151,
  availability: "available",
  streamingSupport: "supported",
  structuredOutputSupport: "unsupported"
});

const unknown = normalizeRuntimeCharacteristics({
  runtimeType: "prompt-api",
  browserFamily: "UnknownBrowser/12",
  browserMajor: "not-a-number",
  availability: "probably",
  streamingSupport: "maybe",
  structuredOutputSupport: "not exposed"
});

assert.equal(unknown.browserFamily, undefined);
assert.equal(unknown.browserMajor, undefined);
assert.equal(unknown.availability, "unknown");
assert.equal(unknown.streamingSupport, "unknown");
assert.equal(unknown.structuredOutputSupport, "unknown");
assert.equal(JSON.stringify(unknown).includes("model"), false);
