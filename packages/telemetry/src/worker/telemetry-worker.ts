import { normalizePromptObservation } from "../core/observation/normalize-observation.js";
import type { TelemetryObservation } from "../core/observation/types.js";
import { isTelemetryWorkerMessage, type TelemetryWorkerMessage } from "../shell/worker/protocol.js";
import { validateTelemetryWorkerMessage } from "../shell/worker/validate-message.js";

export type WorkerDelivery = {
  deliver(observation: TelemetryObservation): Promise<void> | void;
};

export async function processTelemetryWorkerMessage(
  message: TelemetryWorkerMessage,
  delivery: WorkerDelivery
): Promise<TelemetryObservation | undefined> {
  if (message.type !== "observation.prompt" && message.type !== "observation.promptStreaming") return undefined;
  const observation = normalizePromptObservation(message.payload);
  await delivery.deliver(observation);
  return observation;
}

export function isProcessableWorkerMessage(message: unknown): message is TelemetryWorkerMessage {
  return isTelemetryWorkerMessage(message) && validateTelemetryWorkerMessage(message);
}

const workerGlobal = globalThis as typeof globalThis & {
  postMessage?: (message: unknown) => void;
  onmessage?: (event: MessageEvent<unknown>) => void;
};

if (typeof workerGlobal.postMessage === "function") {
  workerGlobal.onmessage = (event: MessageEvent<unknown>) => {
    const message = event.data;
    if (!isProcessableWorkerMessage(message)) return;
    void processTelemetryWorkerMessage(message, {
      deliver(observation) {
        workerGlobal.postMessage?.({
          protocolVersion: message.protocolVersion,
          messageId: message.messageId,
          type: "observation.normalized",
          createdAt: new Date().toISOString(),
          payload: observation
        });
      }
    });
  };
}
