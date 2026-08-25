import assert from "assert";
import {
  REQUIRED_ACCEPTANCE_KEYS,
  REQUIRED_FUNCTIONAL_REQUIREMENT_KEYS,
  summarizeValidationCoverage,
  validateFinalValidationReport
} from "../../dist/src/core/validation/validation-report.js";

const passingReport = {
  requirements: Object.fromEntries(REQUIRED_FUNCTIONAL_REQUIREMENT_KEYS.map((key) => [key, "PASS"])),
  acceptance: Object.fromEntries(REQUIRED_ACCEPTANCE_KEYS.map((key) => [key, "PASS"])),
  commands: {
    typecheck: "PASS",
    unit: "PASS",
    integration: "PASS",
    e2e: "PASS",
    build: "PASS",
    nativePrompt: "PASS",
    nativeStreaming: "PASS"
  },
  examples: {
    "support-triage": "PASS",
    "ecommerce-extraction": "PASS",
    "private-document-summary": "PASS",
    "streaming-assistant": "PASS"
  },
  docs: "PASS",
  overhead: "PASS",
  scope: "PASS",
  finalDecision: "PASS"
};

const summary = summarizeValidationCoverage(passingReport);
assert.equal(summary.functionalRequirementsPassed, 29);
assert.equal(summary.functionalRequirementsTotal, 29);
assert.equal(summary.acceptanceCriteriaPassed, 11);
assert.equal(summary.acceptanceCriteriaTotal, 11);
assert.equal(summary.missingRequirements.length, 0);
assert.equal(summary.missingAcceptance.length, 0);
assert.equal(summary.failedChecks.length, 0);
assert.equal(summary.readyForPass, true);

const validation = validateFinalValidationReport(passingReport);
assert.equal(validation.status, "PASS");
assert.equal(validation.issues.length, 0);

const incompleteReport = {
  ...passingReport,
  requirements: { ...passingReport.requirements, "FR-024": "FAIL" },
  overhead: "FAIL"
};
const incompleteValidation = validateFinalValidationReport(incompleteReport);
assert.equal(incompleteValidation.status, "FAIL");
assert.equal(incompleteValidation.issues.some((issue) => issue.includes("FR-024")), true);
assert.equal(incompleteValidation.issues.some((issue) => issue.includes("overhead")), true);
