import type { TelemetryObservation } from "../../core/observation/types.js";
import { createConsoleDestination, type ConsoleDestination } from "../transport/console-destination.js";
import { processTelemetryWorkerMessage } from "../../worker/telemetry-worker.js";
import { createObservationMessage, type ObservationPromptMessage } from "./protocol.js";

export type WorkerBridge = {
  readonly mode: "browser-worker" | "in-process";
  postObservation(payload: ObservationPromptMessage["payload"]): Promise<TelemetryObservation | undefined>;
  flush(): Promise<void>;
};

function createInProcessBridge(destination: ConsoleDestination): WorkerBridge {
  const delivery = createConsoleDestination(destination);

  return {
    mode: "in-process",
    async postObservation(payload) {
      const message = createObservationMessage(payload);
      const cloned = JSON.parse(JSON.stringify(message)) as ObservationPromptMessage;
      return processTelemetryWorkerMessage(cloned, delivery);
    },
    async flush() {
      return undefined;
    }
  };
}

function createBrowserWorkerBridge(destination: ConsoleDestination): WorkerBridge | undefined {
  if (typeof Worker === "undefined") return undefined;
  const delivery = createConsoleDestination(destination);
  const pending = new Map<string, (observation: TelemetryObservation | undefined) => void>();

  try {
    const worker = new Worker(new URL("../../worker/telemetry-worker.js", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<unknown>) => {
      const record = event.data as { messageId?: unknown; payload?: unknown };
      if (typeof record.messageId !== "string") return;
      const resolve = pending.get(record.messageId);
      if (!resolve) return;
      pending.delete(record.messageId);
      const observation = record.payload as TelemetryObservation;
      void delivery.deliver(observation);
      resolve(observation);
    };

    return {
      mode: "browser-worker",
      postObservation(payload) {
        const message = createObservationMessage(payload);
        const cloned = JSON.parse(JSON.stringify(message)) as ObservationPromptMessage;
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

export function createWorkerBridge(destination: ConsoleDestination): WorkerBridge {
  return createBrowserWorkerBridge(destination) || createInProcessBridge(destination);
}
