import type { CaptureMode } from "../core/capture/types.js";
import type { FlushRequest, FlushResult, StartupQueueSnapshot, WorkerFailurePhase } from "../core/batching/types.js";
import type { RuntimeAvailability, SupportStatus } from "../core/observation/types.js";
import type { DeliveryAttempt, DestinationConfig } from "../core/routing/types.js";
import type { PromptApiSession } from "../shell/runtimes/prompt-api/observe-prompt.js";
import type { WorkerBridgeOptions } from "../shell/worker/worker-bridge.js";

export type TelemetryStatus =
  | { type: "worker.ready" }
  | { type: "worker.starting" }
  | { type: "worker.failed"; phase: WorkerFailurePhase; error: unknown }
  | { type: "worker.processingFailed"; phase: WorkerFailurePhase; error: unknown }
  | { type: "startupQueue.queued"; messageId: string; queuedCount: number }
  | { type: "startupQueue.dropped"; messageId: string; queuedCount: number; droppedCount: number }
  | { type: "startupQueue.drained"; drainedCount: number }
  | { type: "destination.sent"; destinationId: string; observationId: string; attempt: DeliveryAttempt }
  | { type: "destination.failed"; destinationId: string; observationId: string; error: unknown; attempt: DeliveryAttempt }
  | { type: "lifecycle.flushAttempted"; pendingCount: number; reason: FlushRequest["reason"]; keepalive?: boolean };

export type TelemetryStatusSnapshot = {
  ready: boolean;
  workerMode: "browser-worker" | "in-process";
  workerOperational: boolean;
  startupQueue: StartupQueueSnapshot;
};

export type RuntimeConfig = {
  availability?: RuntimeAvailability;
  browserFamily?: string;
  browserMajor?: number;
  streamingSupport?: SupportStatus;
  structuredOutputSupport?: SupportStatus;
};

export type TelemetryOptions = {
  session: PromptApiSession;
  capture?: CaptureMode;
  destinations?: DestinationConfig[];
  runtime?: RuntimeConfig;
  worker?: WorkerBridgeOptions;
  lifecycle?: {
    enabled?: boolean;
    flushOnVisibilityHidden?: boolean;
    flushOnPageHide?: boolean;
    allowBeaconFallback?: boolean;
  };
  now?: () => number;
  onStatus?: (status: TelemetryStatus) => void;
};

export type { DestinationConfig };

export type TelemetryController = {
  readonly status: TelemetryStatusSnapshot;
  prompt(input: unknown, options?: unknown): Promise<unknown>;
  promptStreaming(input: unknown, options?: unknown): AsyncIterable<unknown> | ReadableStream<unknown>;
  flush(request?: FlushRequest): Promise<FlushResult>;
  stop(): Promise<void>;
};
