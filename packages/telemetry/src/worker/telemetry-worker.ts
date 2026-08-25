import { normalizePromptObservation } from "../core/observation/normalize-observation.js";
import type { TelemetryObservation } from "../core/observation/types.js";
import type { DeliveryAttempt } from "../core/routing/types.js";
import { deliverObservation } from "../shell/transport/deliver-observation.js";
import { createFlushResultMessage, createWorkerReadyMessage, isTelemetryWorkerMessage, type TelemetryWorkerMessage } from "../shell/worker/protocol.js";
import { validateTelemetryWorkerMessage } from "../shell/worker/validate-message.js";

export type WorkerDelivery = {
  deliver(observation: TelemetryObservation): Promise<void> | void;
};

export async function processTelemetryWorkerMessage(
  message: TelemetryWorkerMessage,
  delivery?: WorkerDelivery
): Promise<{ observation: TelemetryObservation; deliveryAttempts: DeliveryAttempt[] } | undefined> {
  if (message.type === "worker.flush") {
    return undefined;
  }
  if (message.type !== "observation.prompt" && message.type !== "observation.promptStreaming") return undefined;
  const observation = normalizePromptObservation(message.payload);
  if (delivery) {
    await delivery.deliver(observation);
    return { observation, deliveryAttempts: [] };
  }
  const deliveryAttempts = await deliverObservation(observation, message.destinations, message.delivery);
  return { observation, deliveryAttempts };
}

export function isProcessableWorkerMessage(message: unknown): message is TelemetryWorkerMessage {
  return isTelemetryWorkerMessage(message) && validateTelemetryWorkerMessage(message);
}

const workerGlobal = globalThis as typeof globalThis & {
  postMessage?: (message: unknown) => void;
  onmessage?: (event: MessageEvent<unknown>) => void;
  addEventListener?: (type: "message", listener: (event: MessageEvent<unknown>) => void) => void;
};

if (typeof workerGlobal.postMessage === "function") {
  const handleMessage = (event: MessageEvent<unknown>) => {
    const message = event.data;
    if (!isProcessableWorkerMessage(message)) return;
    if (message.type === "worker.control" && message.payload.command === "hello") {
      workerGlobal.postMessage?.(createWorkerReadyMessage({ messageId: message.messageId }));
      return;
    }
    if (message.type === "worker.flush") {
      const payload = message.payload;
      workerGlobal.postMessage?.(createFlushResultMessage({
        requestMessageId: message.messageId,
        reason: payload.reason,
        attempted: true,
        pendingCount: payload.pendingCount || 0,
        deliveryAttempts: []
      }));
      return;
    }
    void processTelemetryWorkerMessage(message).then((result) => {
      if (!result) return;
        workerGlobal.postMessage?.({
          protocolVersion: message.protocolVersion,
          messageId: message.messageId,
          type: "observation.normalized",
          createdAt: new Date().toISOString(),
          payload: result
        });
    }).catch((error) => {
      workerGlobal.postMessage?.({
        protocolVersion: message.protocolVersion,
        messageId: message.messageId,
        type: "worker.processingFailed",
        createdAt: new Date().toISOString(),
        payload: {
          phase: "processing",
          error: error && typeof error === "object" ? error : { message: String(error) }
        }
      });
    });
  };
  if (typeof workerGlobal.addEventListener === "function") {
    workerGlobal.addEventListener("message", handleMessage);
  } else {
    workerGlobal.onmessage = handleMessage;
  }
}
