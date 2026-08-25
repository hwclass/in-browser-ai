import assert from "assert";
import { redactContent, redactText } from "../../../dist/src/core/capture/redact-content.js";

assert.equal(redactText("Sensitive account 12345"), "[redacted 23 chars]");
assert.equal(redactText(""), "[redacted 0 chars]");
assert.equal(redactText(undefined), undefined);
assert.equal(redactText({ value: "object" }), "[redacted 15 chars]");

const result = redactContent({
  input: "PRIVATE_DOCUMENT_SENTINEL: salary terms",
  output: "PRIVATE_SUMMARY_SENTINEL: renewal date"
});

assert.deepEqual(result, {
  input: "[redacted 39 chars]",
  output: "[redacted 38 chars]",
  inputCharacters: 39,
  outputCharacters: 38,
  redactionSummary: "input: 39 chars redacted; output: 38 chars redacted"
});
assert.equal(JSON.stringify(result).includes("PRIVATE_DOCUMENT_SENTINEL"), false);
assert.equal(JSON.stringify(result).includes("PRIVATE_SUMMARY_SENTINEL"), false);
