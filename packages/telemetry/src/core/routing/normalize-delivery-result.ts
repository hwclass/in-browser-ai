import { normalizeError } from "../observation/normalize-observation.js";
import type { DeliveryAttempt, DestinationConfig } from "./types.js";

export function normalizeDeliverySuccess(input: {
  destinationId: string;
  type: DestinationConfig["type"];
  observationId: string;
  startedAt?: string;
  endedAt?: string;
  payloadBytes?: number;
}): DeliveryAttempt {
  return { ...input, status: "sent" };
}

export function normalizeDeliveryFailure(input: {
  destinationId: string;
  type: DestinationConfig["type"];
  observationId: string;
  error: unknown;
  startedAt?: string;
  endedAt?: string;
  payloadBytes?: number;
}): DeliveryAttempt {
  return {
    destinationId: input.destinationId,
    type: input.type,
    observationId: input.observationId,
    status: "failed",
    ...(input.startedAt ? { startedAt: input.startedAt } : {}),
    ...(input.endedAt ? { endedAt: input.endedAt } : {}),
    ...(input.payloadBytes !== undefined ? { payloadBytes: input.payloadBytes } : {}),
    error: normalizeError(input.error)
  };
}
