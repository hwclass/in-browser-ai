export const REQUIRED_FUNCTIONAL_REQUIREMENT_KEYS = [
  "FR-001",
  "FR-002",
  "FR-003",
  "FR-004",
  "FR-005",
  "FR-006",
  "FR-007",
  "FR-008",
  "FR-009",
  "FR-010",
  "FR-011",
  "FR-012",
  "FR-013",
  "FR-014",
  "FR-015",
  "FR-016",
  "FR-017",
  "FR-018",
  "FR-019",
  "FR-020",
  "FR-021",
  "FR-022",
  "FR-023",
  "FR-024",
  "FR-025",
  "FR-026",
  "FR-027",
  "FR-028",
  "FR-029"
] as const;

export const REQUIRED_ACCEPTANCE_KEYS = [
  "SC-001",
  "SC-002",
  "SC-003",
  "SC-004",
  "SC-005",
  "SC-006",
  "SC-007",
  "SC-008",
  "SC-009",
  "SC-010",
  "SC-011"
] as const;

export type ValidationState = "PASS" | "FAIL" | "BLOCKED" | "UNAVAILABLE";

export type FinalValidationReport = {
  requirements: Record<string, ValidationState>;
  acceptance: Record<string, ValidationState>;
  commands: Record<string, ValidationState>;
  examples: Record<string, ValidationState>;
  docs: ValidationState;
  overhead: ValidationState;
  scope: ValidationState;
  finalDecision: ValidationState;
};

export type ValidationCoverageSummary = {
  functionalRequirementsPassed: number;
  functionalRequirementsTotal: number;
  acceptanceCriteriaPassed: number;
  acceptanceCriteriaTotal: number;
  missingRequirements: string[];
  missingAcceptance: string[];
  failedChecks: string[];
  readyForPass: boolean;
};

export function summarizeValidationCoverage(report: FinalValidationReport): ValidationCoverageSummary {
  const missingRequirements = REQUIRED_FUNCTIONAL_REQUIREMENT_KEYS.filter(
    (key) => report.requirements[key] !== "PASS"
  );
  const missingAcceptance = REQUIRED_ACCEPTANCE_KEYS.filter((key) => report.acceptance[key] !== "PASS");
  const failedChecks: string[] = [];

  for (const [key, state] of Object.entries(report.commands)) {
    if (state !== "PASS") failedChecks.push(`commands.${key}:${state}`);
  }
  for (const [key, state] of Object.entries(report.examples)) {
    if (state !== "PASS") failedChecks.push(`examples.${key}:${state}`);
  }
  for (const key of ["docs", "overhead", "scope", "finalDecision"] as const) {
    if (report[key] !== "PASS") failedChecks.push(`${key}:${report[key]}`);
  }

  return {
    functionalRequirementsPassed: REQUIRED_FUNCTIONAL_REQUIREMENT_KEYS.length - missingRequirements.length,
    functionalRequirementsTotal: REQUIRED_FUNCTIONAL_REQUIREMENT_KEYS.length,
    acceptanceCriteriaPassed: REQUIRED_ACCEPTANCE_KEYS.length - missingAcceptance.length,
    acceptanceCriteriaTotal: REQUIRED_ACCEPTANCE_KEYS.length,
    missingRequirements,
    missingAcceptance,
    failedChecks,
    readyForPass: missingRequirements.length === 0 && missingAcceptance.length === 0 && failedChecks.length === 0
  };
}

export function validateFinalValidationReport(report: FinalValidationReport): {
  status: ValidationState;
  issues: string[];
} {
  const summary = summarizeValidationCoverage(report);
  const issues = [
    ...summary.missingRequirements.map((key) => `${key} did not record PASS`),
    ...summary.missingAcceptance.map((key) => `${key} did not record PASS`),
    ...summary.failedChecks.map((key) => `${key} did not record PASS`)
  ];

  return {
    status: issues.length === 0 ? "PASS" : "FAIL",
    issues
  };
}
