import { inspectPromptApiAvailability } from "../shell/runtimes/prompt-api/availability.js";
import { resolveCaptureMode } from "../core/capture/apply-capture-policy.js";
import { createPromptObservationShell } from "../shell/runtimes/prompt-api/observe-prompt.js";
import { createPromptStreamingObservationShell } from "../shell/runtimes/prompt-api/observe-prompt-streaming.js";
import { createWorkerBridge } from "../shell/worker/worker-bridge.js";
import type { TelemetryController, TelemetryOptions } from "./types.js";

let idSequence = 0;

function nextId(prefix: string): string {
  idSequence += 1;
  return `${prefix}_${idSequence.toString(36)}`;
}

export function observePromptApi(options: TelemetryOptions): TelemetryController {
  const runtime = inspectPromptApiAvailability(options.runtime);
  const captureMode = resolveCaptureMode(options.capture);
  const destination = options.destinations && options.destinations[0] ? options.destinations[0] : { type: "console" as const };
  const bridge = createWorkerBridge(destination);
  const status = { ready: true, workerMode: bridge.mode, workerOperational: bridge.mode === "in-process" };
  const observedBridge = {
    ...bridge,
    async postObservation(payload: Parameters<typeof bridge.postObservation>[0]) {
      const observation = await bridge.postObservation(payload);
      if (observation) status.workerOperational = true;
      return observation;
    }
  };
  options.onStatus?.({ type: "worker.ready" });

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
    flush: () => bridge.flush(),
    async stop() {
      await bridge.flush();
      status.ready = false;
    }
  };
}
