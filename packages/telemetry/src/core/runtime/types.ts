import type { RuntimeAvailability, RuntimeSummary, SupportStatus } from "../observation/types.js";

export type RuntimeCharacterizationInput = {
  runtimeType?: "prompt-api";
  browserFamily?: string;
  browserMajor?: number | string;
  availability?: RuntimeAvailability | string;
  streamingSupport?: SupportStatus | boolean | string;
  structuredOutputSupport?: SupportStatus | boolean | string;
};

export type RuntimeCharacteristics = RuntimeSummary;
