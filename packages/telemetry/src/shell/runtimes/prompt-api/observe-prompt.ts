import type { ObservationOutcome, RuntimeSummary } from "../../../core/observation/types.js";
import { normalizeError } from "../../../core/observation/normalize-observation.js";
import { extractUsageContext } from "./extract-usage-context.js";
import type { WorkerBridge } from "../../worker/worker-bridge.js";

export type PromptApiSession = {
  prompt(input: unknown, options?: unknown): Promise<unknown>;
  promptStreaming?: (input: unknown, options?: unknown) => AsyncIterable<unknown> | ReadableStream<unknown>;
};

export type PromptObservationShellOptions = {
  session: PromptApiSession;
  bridge: WorkerBridge;
  sessionId: string;
  runtime: RuntimeSummary;
  idGenerator: () => string;
  now?: () => number;
};

function classifyOutcome(error: unknown): ObservationOutcome {
  if (error && typeof error === "object" && (error as { name?: unknown }).name === "AbortError") {
    return "cancelled";
  }
  return "error";
}

export function createPromptObservationShell(options: PromptObservationShellOptions) {
  const now = options.now || Date.now;

  return async function observedPrompt(input: unknown, promptOptions?: unknown): Promise<unknown> {
    const operationId = options.idGenerator();
    const startedAt = now();
    try {
      const result = await options.session.prompt(input, promptOptions);
      const endedAt = now();
      const metadata = extractUsageContext(options.session);
      await options.bridge.postObservation({
        observationId: options.idGenerator(),
        sessionId: options.sessionId,
        operationId,
        operation: "prompt",
        startedAt,
        endedAt,
        outcome: "success",
        runtime: options.runtime,
        usage: metadata.usage,
        context: metadata.context
      }).catch(() => undefined);
      return result;
    } catch (error) {
      const endedAt = now();
      const metadata = extractUsageContext(options.session);
      await options.bridge.postObservation({
        observationId: options.idGenerator(),
        sessionId: options.sessionId,
        operationId,
        operation: "prompt",
        startedAt,
        endedAt,
        outcome: classifyOutcome(error),
        runtime: options.runtime,
        error: normalizeError(error),
        usage: metadata.usage,
        context: metadata.context
      }).catch(() => undefined);
      throw error;
    }
  };
}
