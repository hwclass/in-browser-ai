import { applyCapturePolicy } from "../../../core/capture/apply-capture-policy.js";
import type { CaptureMode } from "../../../core/capture/types.js";
import type { PromptObservationInput } from "../../../core/observation/types.js";

export type PromptObservationPayloadInput = Omit<PromptObservationInput, "capture"> & {
  captureMode?: CaptureMode;
  input?: unknown;
  output?: unknown;
  inputCharacters?: number;
  outputCharacters?: number;
};

export function buildPromptObservationPayload(input: PromptObservationPayloadInput): PromptObservationInput {
  const {
    captureMode,
    input: promptInput,
    output,
    inputCharacters,
    outputCharacters,
    ...observation
  } = input;

  return {
    ...observation,
    capture: applyCapturePolicy({
      mode: captureMode,
      input: promptInput,
      output,
      inputCharacters,
      outputCharacters
    })
  };
}
