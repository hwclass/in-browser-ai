import type { CaptureMode } from "../core/capture/types.js";
import type { RuntimeAvailability, SupportStatus } from "../core/observation/types.js";
import type { DeliveryAttempt, DestinationConfig } from "../core/routing/types.js";
import type { PromptApiSession } from "../shell/runtimes/prompt-api/observe-prompt.js";

export type TelemetryStatus =
  | { type: "worker.ready" }
  | { type: "worker.failed"; error: unknown }
  | { type: "destination.sent"; destinationId: string; observationId: string; attempt: DeliveryAttempt }
  | { type: "destination.failed"; destinationId: string; observationId: string; error: unknown; attempt: DeliveryAttempt };

export type TelemetryStatusSnapshot = {
  ready: boolean;
  workerMode: "browser-worker" | "in-process";
  workerOperational: boolean;
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
  now?: () => number;
  onStatus?: (status: TelemetryStatus) => void;
};

export type { DestinationConfig };

export type TelemetryController = {
  readonly status: TelemetryStatusSnapshot;
  prompt(input: unknown, options?: unknown): Promise<unknown>;
  promptStreaming(input: unknown, options?: unknown): AsyncIterable<unknown> | ReadableStream<unknown>;
  flush(): Promise<void>;
  stop(): Promise<void>;
};
