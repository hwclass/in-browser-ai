import assert from "assert";
import { applyCapturePolicy, resolveCaptureMode } from "../../../dist/src/core/capture/apply-capture-policy.js";

const prompt = "PRIVATE_PROMPT_SENTINEL account 12345";
const response = "PRIVATE_RESPONSE_SENTINEL refund approved";

const metadata = applyCapturePolicy({ mode: "metadata", input: prompt, output: response });
assert.equal(metadata.mode, "metadata");
assert.equal(metadata.inputCharacters, prompt.length);
assert.equal(metadata.outputCharacters, response.length);
assert.equal("input" in metadata, false);
assert.equal("output" in metadata, false);
assert.equal(JSON.stringify(metadata).includes("PRIVATE_PROMPT_SENTINEL"), false);
assert.equal(JSON.stringify(metadata).includes("PRIVATE_RESPONSE_SENTINEL"), false);

const redacted = applyCapturePolicy({ mode: "redacted", input: prompt, output: response });
assert.equal(redacted.mode, "redacted");
assert.equal(redacted.inputCharacters, prompt.length);
assert.equal(redacted.outputCharacters, response.length);
assert.equal(redacted.input, "[redacted 37 chars]");
assert.equal(redacted.output, "[redacted 41 chars]");
assert.equal(redacted.redactionSummary, "input: 37 chars redacted; output: 41 chars redacted");
assert.equal(JSON.stringify(redacted).includes("PRIVATE_PROMPT_SENTINEL"), false);
assert.equal(JSON.stringify(redacted).includes("PRIVATE_RESPONSE_SENTINEL"), false);

const full = applyCapturePolicy({ mode: "full", input: prompt, output: response });
assert.equal(full.mode, "full");
assert.equal(full.input, prompt);
assert.equal(full.output, response);
assert.equal(full.inputCharacters, prompt.length);
assert.equal(full.outputCharacters, response.length);

assert.equal(resolveCaptureMode(undefined), "metadata");
assert.equal(resolveCaptureMode("metadata"), "metadata");
assert.equal(resolveCaptureMode("redacted"), "redacted");
assert.equal(resolveCaptureMode("full"), "full");
assert.equal(resolveCaptureMode("verbose"), "metadata");
assert.equal(resolveCaptureMode(null), "metadata");

const badValue = Object.create(null);
const failed = applyCapturePolicy({ mode: "full", input: badValue, output: response });
assert.equal(failed.mode, "metadata");
assert.equal(failed.failure.mode, "full");
assert.equal(failed.failure.reason, "capture-policy-failed");
assert.equal("input" in failed, false);
assert.equal("output" in failed, false);
