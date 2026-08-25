import type { CaptureMode, CaptureResult } from "./types.js";
import { redactContent } from "./redact-content.js";

export type CapturePolicyInput = {
  mode?: unknown;
  input?: unknown;
  output?: unknown;
  inputCharacters?: number;
  outputCharacters?: number;
};

function textFromValue(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") return value;
  return String(value);
}

function safeLength(value: unknown, explicitLength: number | undefined): number | undefined {
  if (typeof explicitLength === "number" && Number.isFinite(explicitLength)) return explicitLength;
  const text = textFromValue(value);
  return text === undefined ? undefined : text.length;
}

export function resolveCaptureMode(mode: unknown): CaptureMode {
  return mode === "redacted" || mode === "full" || mode === "metadata" ? mode : "metadata";
}

export function applyCapturePolicy(input: CapturePolicyInput): CaptureResult {
  const mode = resolveCaptureMode(input.mode);
  try {
    const inputCharacters = safeLength(input.input, input.inputCharacters);
    const outputCharacters = safeLength(input.output, input.outputCharacters);

    if (mode === "metadata") {
      return {
        mode,
        ...(inputCharacters !== undefined ? { inputCharacters } : {}),
        ...(outputCharacters !== undefined ? { outputCharacters } : {})
      };
    }

    if (mode === "redacted") {
      return {
        mode,
        ...redactContent({ input: input.input, output: input.output })
      };
    }

    const inputText = textFromValue(input.input);
    const outputText = textFromValue(input.output);
    return {
      mode,
      ...(inputText !== undefined ? { input: inputText } : {}),
      ...(outputText !== undefined ? { output: outputText } : {}),
      ...(inputCharacters !== undefined ? { inputCharacters } : {}),
      ...(outputCharacters !== undefined ? { outputCharacters } : {})
    };
  } catch {
    return {
      mode: "metadata",
      failure: {
        mode,
        reason: "capture-policy-failed"
      }
    };
  }
}
