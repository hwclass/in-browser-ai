import type { ObservationOutcome, RuntimeSummary } from "../../../core/observation/types.js";
import { normalizeError } from "../../../core/observation/normalize-observation.js";
import { createStreamingTimingTracker } from "../../../core/observation/streaming-timing.js";
import type { WorkerBridge } from "../../worker/worker-bridge.js";
import type { PromptApiSession } from "./observe-prompt.js";
import { extractUsageContext } from "./extract-usage-context.js";

export type PromptStreamingObservationShellOptions = {
  session: PromptApiSession;
  bridge: WorkerBridge;
  sessionId: string;
  runtime: RuntimeSummary;
  idGenerator: () => string;
  now?: () => number;
};

type StreamSummaryState = {
  outputCount: number;
  producedOutput: boolean;
};

function classifyOutcome(error: unknown): ObservationOutcome {
  if (error && typeof error === "object" && (error as { name?: unknown }).name === "AbortError") {
    return "cancelled";
  }
  return "error";
}

function isReadableStream(value: unknown): value is ReadableStream<unknown> {
  return typeof ReadableStream !== "undefined" && value instanceof ReadableStream;
}

function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  return Boolean(value && typeof (value as { [Symbol.asyncIterator]?: unknown })[Symbol.asyncIterator] === "function");
}

function chunkProducedOutput(chunk: unknown): boolean {
  if (typeof chunk === "string") return chunk.length > 0;
  return chunk !== undefined && chunk !== null;
}

export function createPromptStreamingObservationShell(options: PromptStreamingObservationShellOptions) {
  const now = options.now || Date.now;

  return function observedPromptStreaming(
    input: unknown,
    promptOptions?: unknown
  ): AsyncIterable<unknown> | ReadableStream<unknown> {
    if (!options.session.promptStreaming) {
      throw new TypeError("Prompt API session does not support promptStreaming()");
    }

    const operationId = options.idGenerator();
    const observationId = options.idGenerator();
    const startedAt = now();
    const timing = createStreamingTimingTracker(startedAt);
    const state: StreamSummaryState = { outputCount: 0, producedOutput: false };
    let finalized = false;

    const recordOutput = (chunk: unknown): void => {
      state.outputCount += 1;
      if (!chunkProducedOutput(chunk)) return;
      state.producedOutput = true;
      timing.recordOutput(now());
    };

    const postSummary = async (outcome: ObservationOutcome, endedAt: number, error?: unknown): Promise<void> => {
      if (finalized) return;
      finalized = true;
      const metadata = extractUsageContext(options.session);
      await options.bridge.postObservation({
        observationId,
        sessionId: options.sessionId,
        operationId,
        operation: "promptStreaming",
        startedAt,
        endedAt,
        outcome,
        runtime: options.runtime,
        error: normalizeError(error),
        usage: metadata.usage,
        context: metadata.context,
        stream: {
          outputCount: state.outputCount,
          producedOutput: state.producedOutput,
          timeToFirstOutputMs: timing.firstOutputAt === undefined ? undefined : Math.max(0, timing.firstOutputAt - startedAt)
        }
      }).catch(() => undefined);
    };

    let nativeStream: AsyncIterable<unknown> | ReadableStream<unknown>;
    try {
      nativeStream = options.session.promptStreaming(input, promptOptions);
    } catch (error) {
      void postSummary(classifyOutcome(error), now(), error);
      throw error;
    }

    if (isReadableStream(nativeStream)) {
      const reader = nativeStream.getReader();
      return new ReadableStream<unknown>({
        async pull(controller) {
          try {
            const next = await reader.read();
            if (next.done) {
              await postSummary("success", now());
              controller.close();
              return;
            }
            recordOutput(next.value);
            controller.enqueue(next.value);
          } catch (error) {
            await postSummary(classifyOutcome(error), now(), error);
            controller.error(error);
          }
        },
        async cancel(reason) {
          await reader.cancel(reason).catch(() => undefined);
          const cancellation = reason || { name: "AbortError", message: "Stream consumption cancelled" };
          await postSummary(classifyOutcome(cancellation), now(), cancellation);
        }
      });
    }

    if (!isAsyncIterable(nativeStream)) {
      const error = new TypeError("promptStreaming() must return a ReadableStream or AsyncIterable");
      void postSummary("error", now(), error);
      throw error;
    }

    const asyncIterable = nativeStream;

    return {
      [Symbol.asyncIterator](): AsyncIterator<unknown> {
        const iterator = asyncIterable[Symbol.asyncIterator]();
        return {
          async next() {
            try {
              const next = await iterator.next();
              if (next.done) {
                await postSummary("success", now());
                return next;
              }
              recordOutput(next.value);
              return next;
            } catch (error) {
              await postSummary(classifyOutcome(error), now(), error);
              throw error;
            }
          },
          async return(value?: unknown) {
            await iterator.return?.();
            await postSummary("cancelled", now(), { name: "AbortError", message: "Stream consumption cancelled" });
            return { done: true, value };
          },
          async throw(error?: unknown) {
            await iterator.throw?.(error);
            await postSummary(classifyOutcome(error), now(), error);
            throw error;
          }
        };
      }
    };
  };
}
