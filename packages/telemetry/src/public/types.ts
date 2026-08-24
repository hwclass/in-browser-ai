import type { RuntimeAvailability, SupportStatus } from "../core/observation/types.js";
import type { ConsoleDestination } from "../shell/transport/console-destination.js";
import type { PromptApiSession } from "../shell/runtimes/prompt-api/observe-prompt.js";

export type TelemetryStatus = { type: "worker.ready" } | { type: "worker.failed"; error: unknown };

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
  destinations?: ConsoleDestination[];
  runtime?: RuntimeConfig;
  onStatus?: (status: TelemetryStatus) => void;
};

export type TelemetryController = {
  readonly status: TelemetryStatusSnapshot;
  prompt(input: unknown, options?: unknown): Promise<unknown>;
  flush(): Promise<void>;
  stop(): Promise<void>;
};
