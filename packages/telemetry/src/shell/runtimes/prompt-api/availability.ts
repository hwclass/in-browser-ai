import type { RuntimeAvailability, RuntimeSummary, SupportStatus } from "../../../core/observation/types.js";

export type PromptApiAvailabilityInput = {
  availability?: RuntimeAvailability;
  browserFamily?: string;
  browserMajor?: number;
  streamingSupport?: SupportStatus;
  structuredOutputSupport?: SupportStatus;
};

export function inspectPromptApiAvailability(input: PromptApiAvailabilityInput = {}): RuntimeSummary {
  return {
    runtimeType: "prompt-api",
    browserFamily: input.browserFamily,
    browserMajor: input.browserMajor,
    availability: input.availability || "unknown",
    streamingSupport: input.streamingSupport || "unknown",
    structuredOutputSupport: input.structuredOutputSupport || "unknown"
  };
}
