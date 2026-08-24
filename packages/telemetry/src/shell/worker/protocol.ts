import type { PromptObservationInput } from "../../core/observation/types.js";

export const TELEMETRY_WORKER_PROTOCOL_VERSION = "telemetry.worker.v1";

export type ObservationPromptMessage = {
  protocolVersion: typeof TELEMETRY_WORKER_PROTOCOL_VERSION;
  messageId: string;
  type: "observation.prompt";
  createdAt: string;
  payload: PromptObservationInput;
};

export type WorkerReadyMessage = {
  protocolVersion: typeof TELEMETRY_WORKER_PROTOCOL_VERSION;
  messageId: string;
  type: "worker.ready";
  createdAt: string;
  payload: Record<string, never>;
};

export type WorkerControlMessage = {
  protocolVersion: typeof TELEMETRY_WORKER_PROTOCOL_VERSION;
  messageId: string;
  type: "worker.control";
  createdAt: string;
  payload: {
    command: "flush" | "stop";
  };
};

export type TelemetryWorkerMessage = ObservationPromptMessage | WorkerReadyMessage | WorkerControlMessage;

export function createObservationMessage(
  payload: PromptObservationInput,
  options: { messageId?: string; createdAt?: string } = {}
): ObservationPromptMessage {
  return {
    protocolVersion: TELEMETRY_WORKER_PROTOCOL_VERSION,
    messageId: options.messageId || payload.observationId,
    type: "observation.prompt",
    createdAt: options.createdAt || new Date().toISOString(),
    payload
  };
}

export function isTelemetryWorkerMessage(value: unknown): value is TelemetryWorkerMessage {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    record.protocolVersion === TELEMETRY_WORKER_PROTOCOL_VERSION &&
    typeof record.messageId === "string" &&
    typeof record.createdAt === "string" &&
    (record.type === "observation.prompt" || record.type === "worker.ready" || record.type === "worker.control") &&
    typeof record.payload === "object" &&
    record.payload !== null
  );
}
