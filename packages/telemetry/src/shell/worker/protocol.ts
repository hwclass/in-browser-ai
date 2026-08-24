import type { PromptObservationInput } from "../../core/observation/types.js";
import type { FlushRequest, FlushResult, WorkerFailurePhase } from "../../core/batching/types.js";
import type { TelemetryError } from "../../core/observation/types.js";
import type { DeliveryAttempt } from "../../core/routing/types.js";
import type { SerializableDestinationConfig } from "../../core/routing/types.js";

export const TELEMETRY_WORKER_PROTOCOL_VERSION = "telemetry.worker.v1";

export type ObservationPromptMessage = {
  protocolVersion: typeof TELEMETRY_WORKER_PROTOCOL_VERSION;
  messageId: string;
  type: "observation.prompt" | "observation.promptStreaming";
  createdAt: string;
  destinations?: SerializableDestinationConfig[];
  delivery?: {
    keepalive?: boolean;
    finalAttempt?: boolean;
  };
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
  payload: { command: "hello" | "stop" };
};

export type WorkerFlushRequestMessage = {
  protocolVersion: typeof TELEMETRY_WORKER_PROTOCOL_VERSION;
  messageId: string;
  type: "worker.flush";
  createdAt: string;
  payload: FlushRequest;
};

export type WorkerFlushResultMessage = {
  protocolVersion: typeof TELEMETRY_WORKER_PROTOCOL_VERSION;
  messageId: string;
  type: "worker.flushResult";
  createdAt: string;
  payload: FlushResult & {
    requestMessageId: string;
    reason: FlushRequest["reason"];
    deliveryAttempts: DeliveryAttempt[];
  };
};

export type WorkerProcessingFailedMessage = {
  protocolVersion: typeof TELEMETRY_WORKER_PROTOCOL_VERSION;
  messageId: string;
  type: "worker.processingFailed";
  createdAt: string;
  payload: {
    phase: WorkerFailurePhase;
    error: TelemetryError;
  };
};

export type TelemetryWorkerMessage =
  | ObservationPromptMessage
  | WorkerReadyMessage
  | WorkerControlMessage
  | WorkerFlushRequestMessage
  | WorkerFlushResultMessage
  | WorkerProcessingFailedMessage;

export function createObservationMessage(
  payload: PromptObservationInput,
  options: {
    messageId?: string;
    createdAt?: string;
    destinations?: SerializableDestinationConfig[];
    delivery?: ObservationPromptMessage["delivery"];
  } = {}
): ObservationPromptMessage {
  return {
    protocolVersion: TELEMETRY_WORKER_PROTOCOL_VERSION,
    messageId: options.messageId || payload.observationId,
    type: payload.operation === "promptStreaming" ? "observation.promptStreaming" : "observation.prompt",
    createdAt: options.createdAt || new Date().toISOString(),
    ...(options.destinations ? { destinations: options.destinations } : {}),
    ...(options.delivery ? { delivery: options.delivery } : {}),
    payload
  };
}

export function createWorkerReadyMessage(options: { messageId?: string; createdAt?: string } = {}): WorkerReadyMessage {
  return {
    protocolVersion: TELEMETRY_WORKER_PROTOCOL_VERSION,
    messageId: options.messageId || "worker_ready",
    type: "worker.ready",
    createdAt: options.createdAt || new Date().toISOString(),
    payload: {}
  };
}

export function createControlMessage(
  payload: WorkerControlMessage["payload"],
  options: { messageId?: string; createdAt?: string } = {}
): WorkerControlMessage {
  return {
    protocolVersion: TELEMETRY_WORKER_PROTOCOL_VERSION,
    messageId: options.messageId || `control_${Date.now().toString(36)}`,
    type: "worker.control",
    createdAt: options.createdAt || new Date().toISOString(),
    payload
  };
}

export function createFlushRequestMessage(
  payload: FlushRequest,
  options: { messageId?: string; createdAt?: string } = {}
): WorkerFlushRequestMessage {
  return {
    protocolVersion: TELEMETRY_WORKER_PROTOCOL_VERSION,
    messageId: options.messageId || `flush_${Date.now().toString(36)}`,
    type: "worker.flush",
    createdAt: options.createdAt || new Date().toISOString(),
    payload
  };
}

export function createFlushResultMessage(
  payload: WorkerFlushResultMessage["payload"],
  options: { messageId?: string; createdAt?: string } = {}
): WorkerFlushResultMessage {
  return {
    protocolVersion: TELEMETRY_WORKER_PROTOCOL_VERSION,
    messageId: options.messageId || `flush_result_${Date.now().toString(36)}`,
    type: "worker.flushResult",
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
    (
      record.type === "observation.prompt" ||
      record.type === "observation.promptStreaming" ||
      record.type === "worker.ready" ||
      record.type === "worker.flush" ||
      record.type === "worker.flushResult" ||
      record.type === "worker.processingFailed" ||
      record.type === "worker.control"
    ) &&
    typeof record.payload === "object" &&
    record.payload !== null
  );
}
