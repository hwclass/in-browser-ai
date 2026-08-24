import { inspectPromptApiAvailability } from "../shell/runtimes/prompt-api/availability.js";
import { resolveCaptureMode } from "../core/capture/apply-capture-policy.js";
import { createPromptObservationShell } from "../shell/runtimes/prompt-api/observe-prompt.js";
import { createPromptStreamingObservationShell } from "../shell/runtimes/prompt-api/observe-prompt-streaming.js";
import { createWorkerBridge } from "../shell/worker/worker-bridge.js";
import { createLifecycleFlush } from "../shell/lifecycle/flush-pending.js";
import { observePageLifecycle } from "../shell/lifecycle/page-lifecycle.js";
import { validateDestinations } from "./validate-options.js";
import type { TelemetryController, TelemetryOptions, TelemetryStatus } from "./types.js";
import type { WorkerBridge } from "../shell/worker/worker-bridge.js";
import type { StartupQueueSnapshot } from "../core/batching/types.js";

let idSequence = 0;

function nextId(prefix: string): string {
  idSequence += 1;
  return `${prefix}_${idSequence.toString(36)}`;
}

export function observePromptApi(options: TelemetryOptions): TelemetryController {
  const navigatorLike = typeof navigator !== "undefined"
    ? navigator as Navigator & { userAgentData?: { brands?: Array<{ brand: string; version: string }> } }
    : undefined;
  const browserLanguageModelPresent = typeof window !== "undefined"
    ? "LanguageModel" in globalThis
    : undefined;
  const runtime = inspectPromptApiAvailability({
    ...options.runtime,
    userAgent: navigatorLike?.userAgent,
    userAgentData: navigatorLike?.userAgentData,
    languageModelPresent: browserLanguageModelPresent
  });
  if (!options.runtime?.streamingSupport && typeof options.session.promptStreaming === "function") {
    runtime.streamingSupport = "supported";
  }
  const captureMode = resolveCaptureMode(options.capture);
  const destinations = validateDestinations(options.destinations) || [{ type: "console" as const, id: "console" }];
  let bridgeRef: WorkerBridge | undefined;
  const status = {
    ready: true,
    workerMode: "in-process" as WorkerBridge["mode"],
    workerOperational: false,
    startupQueue: {
      capacity: options.worker?.startupQueueCapacity ?? 8,
      queuedCount: 0,
      droppedCount: 0,
      drainStatus: "not-ready" as const
    } as StartupQueueSnapshot
  };
  const emitStatus = (next: TelemetryStatus): void => {
    if (bridgeRef) {
      status.workerOperational = bridgeRef.isOperational();
      status.startupQueue = bridgeRef.snapshot().startupQueue;
    }
    options.onStatus?.(next);
  };
  const bridge = createWorkerBridge(destinations, (event) => {
    if (bridgeRef) {
      status.workerOperational = bridgeRef.isOperational();
      status.startupQueue = bridgeRef.snapshot().startupQueue;
    }
    if ("status" in event && event.status === "sent") {
      options.onStatus?.({ type: "destination.sent", destinationId: event.destinationId, observationId: event.observationId, attempt: event });
    } else if ("status" in event && event.status === "failed") {
      options.onStatus?.({
        type: "destination.failed",
        destinationId: event.destinationId,
        observationId: event.observationId,
        error: event.error,
        attempt: event
      });
    } else {
      options.onStatus?.(event as TelemetryStatus);
    }
  }, options.worker);
  bridgeRef = bridge;
  status.workerMode = bridge.mode;
  status.workerOperational = bridge.isOperational();
  status.startupQueue = bridge.snapshot().startupQueue;
  const observedBridge = {
    ...bridge,
    async postObservation(payload: Parameters<typeof bridge.postObservation>[0]) {
      const observation = await bridge.postObservation(payload);
      status.workerOperational = bridge.isOperational();
      status.startupQueue = bridge.snapshot().startupQueue;
      return observation;
    }
  };
  if (bridge.isOperational()) options.onStatus?.({ type: "worker.ready" });

  const lifecycleFlush = createLifecycleFlush({
    pendingCount: () => bridge.snapshot().startupQueue.queuedCount,
    flush: (request) => bridge.flush(request),
    onStatus: emitStatus
  });
  const lifecycleEnabled = options.lifecycle?.enabled !== false;
  const lifecycle = lifecycleEnabled && typeof document !== "undefined" && typeof window !== "undefined"
    ? observePageLifecycle({
      document,
      window,
      flush: () => {
        void lifecycleFlush({
          reason: "lifecycle",
          keepalive: true,
          allowBeaconFallback: options.lifecycle?.allowBeaconFallback
        });
      },
      flushOnVisibilityHidden: options.lifecycle?.flushOnVisibilityHidden,
      flushOnPageHide: options.lifecycle?.flushOnPageHide
    })
    : undefined;

  const sessionId = nextId("session");
  const prompt = createPromptObservationShell({
    session: options.session,
    bridge: observedBridge,
    sessionId,
    runtime,
    captureMode,
    idGenerator: () => nextId("telemetry"),
    now: options.now
  });

  const promptStreaming = createPromptStreamingObservationShell({
    session: options.session,
    bridge: observedBridge,
    sessionId,
    runtime,
    captureMode,
    idGenerator: () => nextId("telemetry"),
    now: options.now
  });

  return {
    status,
    prompt,
    promptStreaming,
    flush: (request) => bridge.flush(request),
    async stop() {
      await bridge.flush({ reason: "stop", keepalive: true, allowBeaconFallback: options.lifecycle?.allowBeaconFallback });
      lifecycle?.stop();
      status.ready = false;
    }
  };
}
