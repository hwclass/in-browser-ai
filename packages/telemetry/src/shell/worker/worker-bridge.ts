import type { TelemetryObservation } from "../../core/observation/types.js";
import type { DeliveryAttempt, DestinationConfig, SerializableDestinationConfig } from "../../core/routing/types.js";
import { processTelemetryWorkerMessage } from "../../worker/telemetry-worker.js";
import { createObservationMessage, type ObservationPromptMessage } from "./protocol.js";
import { validateTelemetryWorkerMessage } from "./validate-message.js";
import { deliverObservation } from "../transport/deliver-observation.js";

export type WorkerBridge = {
  readonly mode: "browser-worker" | "in-process";
  postObservation(payload: ObservationPromptMessage["payload"]): Promise<TelemetryObservation | undefined>;
  flush(): Promise<void>;
};

export type WorkerBridgeStatusHandler = (attempt: DeliveryAttempt) => void;

function serializableDestinations(destinations: DestinationConfig[]): SerializableDestinationConfig[] {
  return destinations.map((destination) => {
    if (destination.type === "console") {
      const { write: _write, ...serializable } = destination;
      return serializable;
    }
    return destination;
  });
}

function notifyAttempts(attempts: DeliveryAttempt[], onDeliveryAttempt?: WorkerBridgeStatusHandler): void {
  for (const attempt of attempts) onDeliveryAttempt?.(attempt);
}

function createInProcessBridge(destinations: DestinationConfig[], onDeliveryAttempt?: WorkerBridgeStatusHandler): WorkerBridge {
  return {
    mode: "in-process",
    async postObservation(payload) {
      const message = createObservationMessage(payload);
      const cloned = JSON.parse(JSON.stringify(message)) as ObservationPromptMessage;
      if (!validateTelemetryWorkerMessage(cloned)) return undefined;
      const result = await processTelemetryWorkerMessage(cloned, {
        deliver: async (observation) => {
          const attempts = await deliverObservation(observation, destinations);
          notifyAttempts(attempts, onDeliveryAttempt);
        }
      });
      return result?.observation;
    },
    async flush() {
      return undefined;
    }
  };
}

function createBrowserWorkerBridge(destinations: DestinationConfig[], onDeliveryAttempt?: WorkerBridgeStatusHandler): WorkerBridge | undefined {
  if (typeof Worker === "undefined") return undefined;
  const pending = new Map<string, (observation: TelemetryObservation | undefined) => void>();

  try {
    const worker = new Worker(new URL("../../worker/telemetry-worker.js", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<unknown>) => {
      const record = event.data as { messageId?: unknown; payload?: unknown };
      if (typeof record.messageId !== "string") return;
      const resolve = pending.get(record.messageId);
      if (!resolve) return;
      pending.delete(record.messageId);
      const result = record.payload as { observation?: TelemetryObservation; deliveryAttempts?: DeliveryAttempt[] };
      const observation = result.observation;
      if (!observation) {
        resolve(undefined);
        return;
      }
      const attempts = result.deliveryAttempts || [];
      notifyAttempts(attempts, onDeliveryAttempt);
      for (const destination of destinations) {
        if (destination.type === "console" && destination.write) {
          try {
            destination.write(observation);
          } catch (error) {
            onDeliveryAttempt?.({
              destinationId: destination.id || "console",
              type: "console",
              observationId: observation.observationId,
              status: "failed",
              error: error && typeof error === "object" ? error as never : { message: String(error) }
            });
          }
        }
      }
      resolve(observation);
    };

    return {
      mode: "browser-worker",
      postObservation(payload) {
        const message = createObservationMessage(payload, { destinations: serializableDestinations(destinations) });
        const cloned = JSON.parse(JSON.stringify(message)) as ObservationPromptMessage;
        if (!validateTelemetryWorkerMessage(cloned)) return Promise.resolve(undefined);
        return new Promise<TelemetryObservation | undefined>((resolve) => {
          pending.set(cloned.messageId, resolve);
          worker.postMessage(cloned);
        });
      },
      async flush() {
        return undefined;
      }
    };
  } catch {
    return undefined;
  }
}

export function createWorkerBridge(destinations: DestinationConfig[], onDeliveryAttempt?: WorkerBridgeStatusHandler): WorkerBridge {
  return createBrowserWorkerBridge(destinations, onDeliveryAttempt) || createInProcessBridge(destinations, onDeliveryAttempt);
}
