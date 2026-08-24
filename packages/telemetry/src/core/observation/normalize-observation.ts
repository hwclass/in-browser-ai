import type {
  InferenceContext,
  InferenceUsage,
  PromptObservationInput,
  TelemetryError,
  TelemetryObservation
} from "./types.js";
import { durationMs, toIsoTimestamp } from "./timing.js";

function copyDefinedNumbers<T extends Record<string, number | undefined>>(value: T | undefined): T | undefined {
  if (!value) return undefined;
  const output: Record<string, number> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "number" && Number.isFinite(item)) {
      output[key] = item;
    }
  }
  return Object.keys(output).length > 0 ? (output as T) : undefined;
}

export function normalizeError(error: unknown): TelemetryError | undefined {
  if (!error) return undefined;
  if (typeof error === "object") {
    const record = error as Record<string, unknown>;
    const normalized: TelemetryError = {};
    if (typeof record.name === "string") normalized.name = record.name;
    if (typeof record.message === "string") normalized.message = record.message;
    if (typeof record.code === "string") normalized.code = record.code;
    if (typeof record.recoverable === "boolean") normalized.recoverable = record.recoverable;
    return Object.keys(normalized).length > 0 ? normalized : { message: String(error) };
  }
  return { message: String(error) };
}

export function normalizePromptObservation(input: PromptObservationInput): TelemetryObservation {
  const usage = copyDefinedNumbers<InferenceUsage>(input.usage);
  const context = copyDefinedNumbers<InferenceContext>(input.context);
  const observation: TelemetryObservation = {
    schemaVersion: "0.1.0",
    observationId: input.observationId,
    sessionId: input.sessionId,
    operationId: input.operationId,
    operation: input.operation,
    startedAt: toIsoTimestamp(input.startedAt),
    endedAt: toIsoTimestamp(input.endedAt),
    durationMs: durationMs(input.startedAt, input.endedAt),
    outcome: input.outcome,
    runtime: input.runtime
  };

  const error = normalizeError(input.error);
  if (error) observation.error = error;
  if (usage) observation.usage = usage;
  if (context) observation.context = context;
  if (input.stream) {
    observation.stream = {
      outputCount: input.stream.outputCount,
      producedOutput: input.stream.producedOutput
    };
    if (input.stream.timeToFirstOutputMs !== undefined) {
      observation.timeToFirstOutputMs = input.stream.timeToFirstOutputMs;
    }
  }

  return observation;
}
