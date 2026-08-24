import type { TelemetryError } from "../observation/types.js";

export type StartupQueueDrainStatus = "not-ready" | "draining" | "drained" | "failed";

export type StartupQueueSnapshot = {
  capacity: number;
  queuedCount: number;
  droppedCount: number;
  drainStatus: StartupQueueDrainStatus;
};

export type StartupQueueEnqueueResult =
  | { status: "queued"; queuedCount: number; messageId: string }
  | { status: "dropped"; queuedCount: number; droppedCount: number; droppedMessageId: string };

export type WorkerFailurePhase = "initialization" | "processing";

export type WorkerFailureStatus = {
  type: "worker.failed" | "worker.processingFailed";
  phase: WorkerFailurePhase;
  error: TelemetryError;
};

export type WorkerFailureModel = {
  status: WorkerFailureStatus;
  failOpen: true;
  restart: false;
};

export type FlushReason = "manual" | "lifecycle" | "stop";

export type FlushRequest = {
  reason: FlushReason;
  keepalive?: boolean;
  allowBeaconFallback?: boolean;
  pendingCount?: number;
};

export type FlushResult = {
  attempted: boolean;
  pendingCount: number;
};
