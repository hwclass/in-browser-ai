import type { CaptureResult } from "../capture/types.js";

export type OperationType = "prompt" | "promptStreaming";

export type ObservationOutcome = "success" | "error" | "cancelled";

export type RuntimeAvailability =
  | "available"
  | "downloadable"
  | "downloading"
  | "unavailable"
  | "unknown";

export type SupportStatus = "supported" | "unsupported" | "unknown";

export type RuntimeSummary = {
  runtimeType: "prompt-api";
  browserFamily?: string;
  browserMajor?: number;
  availability: RuntimeAvailability;
  streamingSupport: SupportStatus;
  structuredOutputSupport: SupportStatus;
};

export type TelemetryError = {
  name?: string;
  message?: string;
  code?: string;
  recoverable?: boolean;
};

export type InferenceUsage = {
  inputCharacters?: number;
  outputCharacters?: number;
  inputTokens?: number;
  outputTokens?: number;
  contextWindowUsed?: number;
  contextWindowLimit?: number;
};

export type InferenceContext = {
  contextWindowUsed?: number;
  contextWindowLimit?: number;
};

export type StreamingSummary = {
  outputCount: number;
  producedOutput: boolean;
};

export type PromptObservationInput = {
  observationId: string;
  sessionId: string;
  operationId: string;
  operation: OperationType;
  startedAt: number | string;
  endedAt: number | string;
  outcome: ObservationOutcome;
  runtime: RuntimeSummary;
  error?: unknown;
  usage?: InferenceUsage;
  context?: InferenceContext;
  capture: CaptureResult;
  stream?: StreamingSummary & {
    timeToFirstOutputMs?: number;
  };
};

export type TelemetryObservation = {
  schemaVersion: "0.1.0";
  observationId: string;
  sessionId: string;
  operationId: string;
  operation: OperationType;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  timeToFirstOutputMs?: number;
  outcome: ObservationOutcome;
  error?: TelemetryError;
  runtime: RuntimeSummary;
  usage?: InferenceUsage;
  context?: InferenceContext;
  capture: CaptureResult;
  stream?: StreamingSummary;
};
