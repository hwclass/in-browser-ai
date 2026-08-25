import type { TelemetryObservation } from "../../core/observation/types.js";
import type { FlushRequest, FlushResult, StartupQueueSnapshot, WorkerFailureStatus } from "../../core/batching/types.js";
import { modelWorkerFailure } from "../../core/batching/fail-open.js";
import { createStartupQueue } from "../../core/batching/startup-queue.js";
import type { DeliveryAttempt, DestinationConfig, SerializableDestinationConfig } from "../../core/routing/types.js";
import { processTelemetryWorkerMessage } from "../../worker/telemetry-worker.js";
import { createControlMessage, createFlushRequestMessage, createObservationMessage, type ObservationPromptMessage } from "./protocol.js";
import { validateTelemetryWorkerMessage } from "./validate-message.js";
import { deliverObservation } from "../transport/deliver-observation.js";

export type WorkerBridge = {
  readonly mode: "browser-worker" | "in-process";
  postObservation(payload: ObservationPromptMessage["payload"]): Promise<TelemetryObservation | undefined>;
  flush(request?: FlushRequest): Promise<FlushResult>;
  isOperational(): boolean;
  snapshot(): { startupQueue: StartupQueueSnapshot };
};

export type WorkerBridgeStatus =
  | DeliveryAttempt
  | WorkerFailureStatus
  | { type: "worker.ready" }
  | { type: "worker.starting" }
  | { type: "startupQueue.queued"; messageId: string; queuedCount: number }
  | { type: "startupQueue.dropped"; messageId: string; queuedCount: number; droppedCount: number }
  | { type: "startupQueue.drained"; drainedCount: number }
  | { type: "lifecycle.flushAttempted"; pendingCount: number; reason: FlushRequest["reason"]; keepalive?: boolean };

export type WorkerBridgeStatusHandler = (status: WorkerBridgeStatus) => void;

export type WorkerLike = {
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  onerror?: ((event: ErrorEvent | Event) => void) | null;
  postMessage(message: unknown): void;
  terminate?: () => void;
};

export type WorkerBridgeOptions = {
  startupQueueCapacity?: number;
  forceInProcess?: boolean;
  workerFactory?: (url: URL, options: WorkerOptions) => WorkerLike;
};

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
  const startupQueue = createStartupQueue({ capacity: 0 });
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
      return { attempted: true, pendingCount: 0 };
    },
    isOperational() {
      return true;
    },
    snapshot() {
      return { startupQueue: startupQueue.snapshot() };
    }
  };
}

function createBrowserWorkerBridge(
  destinations: DestinationConfig[],
  onDeliveryAttempt?: WorkerBridgeStatusHandler,
  options: WorkerBridgeOptions = {}
): WorkerBridge | undefined {
  if (!options.workerFactory && typeof Worker === "undefined") return undefined;
  const pending = new Map<string, (observation: TelemetryObservation | undefined) => void>();
  const startupQueue = createStartupQueue({ capacity: options.startupQueueCapacity });
  let ready = false;
  let failed = false;

  try {
    onDeliveryAttempt?.({ type: "worker.starting" });
    const workerUrl = new URL("../../worker/telemetry-worker.js", import.meta.url);
    const worker = options.workerFactory
      ? options.workerFactory(workerUrl, { type: "module" })
      : new Worker(workerUrl, { type: "module" });

    const sendObservationMessage = (message: ObservationPromptMessage): void => {
      if (!validateTelemetryWorkerMessage(message)) return;
      try {
        worker.postMessage(message);
      } catch (error) {
        onDeliveryAttempt?.(modelWorkerFailure(error, "processing").status);
      }
    };

    const drainStartupQueue = (): void => {
      const drained = startupQueue.drain();
      if (drained.length === 0) return;
      for (const message of drained) sendObservationMessage(message);
      onDeliveryAttempt?.({ type: "startupQueue.drained", drainedCount: drained.length });
    };

    worker.onmessage = (event: MessageEvent<unknown>) => {
      const record = event.data as { messageId?: unknown; payload?: unknown };
      if ((record as { type?: unknown }).type === "worker.ready") {
        ready = true;
        onDeliveryAttempt?.({ type: "worker.ready" });
        drainStartupQueue();
        return;
      }
      if ((record as { type?: unknown }).type === "worker.processingFailed") {
        const payload = record.payload as WorkerFailureStatus;
        onDeliveryAttempt?.({
          type: "worker.processingFailed",
          phase: payload.phase || "processing",
          error: payload.error
        });
        const resolveFailed = typeof record.messageId === "string" ? pending.get(record.messageId) : undefined;
        if (typeof record.messageId === "string") pending.delete(record.messageId);
        resolveFailed?.(undefined);
        return;
      }
      if ((record as { type?: unknown }).type === "worker.flushResult") {
        return;
      }
      if ((record as { type?: unknown }).type !== "observation.normalized") return;
      if (typeof record.messageId !== "string" || !record.payload || typeof record.payload !== "object") return;
      const resolve = pending.get(record.messageId);
      if (resolve) pending.delete(record.messageId);
      const result = record.payload as { observation?: TelemetryObservation; deliveryAttempts?: DeliveryAttempt[] };
      const observation = result.observation;
      if (!observation) {
        resolve?.(undefined);
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
      resolve?.(observation);
    };
    worker.onerror = (event: ErrorEvent | Event) => {
      failed = true;
      ready = false;
      startupQueue.fail();
      onDeliveryAttempt?.(modelWorkerFailure(event, "processing").status);
      for (const resolve of pending.values()) resolve(undefined);
      pending.clear();
    };
    worker.postMessage(createControlMessage({ command: "hello" }));

    return {
      mode: "browser-worker",
      postObservation(payload) {
        const message = createObservationMessage(payload, { destinations: serializableDestinations(destinations) });
        const cloned = JSON.parse(JSON.stringify(message)) as ObservationPromptMessage;
        if (!validateTelemetryWorkerMessage(cloned)) return Promise.resolve(undefined);
        if (!ready) {
          if (failed) return Promise.resolve(undefined);
          const result = startupQueue.enqueue(cloned);
          if (result.status === "queued") {
            onDeliveryAttempt?.({ type: "startupQueue.queued", messageId: result.messageId, queuedCount: result.queuedCount });
          } else {
            onDeliveryAttempt?.({
              type: "startupQueue.dropped",
              messageId: result.droppedMessageId,
              queuedCount: result.queuedCount,
              droppedCount: result.droppedCount
            });
          }
          return Promise.resolve(undefined);
        }
        return new Promise<TelemetryObservation | undefined>((resolve) => {
          pending.set(cloned.messageId, resolve);
          sendObservationMessage(cloned);
        });
      },
      async flush(request = { reason: "manual" }) {
        if (ready) drainStartupQueue();
        const pendingCount = startupQueue.snapshot().queuedCount + pending.size;
        if (ready) {
          try {
            worker.postMessage(createFlushRequestMessage({ ...request, pendingCount }));
          } catch (error) {
            onDeliveryAttempt?.(modelWorkerFailure(error, "processing").status);
          }
        }
        return { attempted: true, pendingCount };
      },
      isOperational() {
        return ready && !failed;
      },
      snapshot() {
        return { startupQueue: startupQueue.snapshot() };
      }
    };
  } catch (error) {
    onDeliveryAttempt?.(modelWorkerFailure(error, "initialization").status);
    return undefined;
  }
}

export function createWorkerBridge(
  destinations: DestinationConfig[],
  onDeliveryAttempt?: WorkerBridgeStatusHandler,
  options: WorkerBridgeOptions = {}
): WorkerBridge {
  if (options.forceInProcess) return createInProcessBridge(destinations, onDeliveryAttempt);
  return createBrowserWorkerBridge(destinations, onDeliveryAttempt, options) || createInProcessBridge(destinations, onDeliveryAttempt);
}
