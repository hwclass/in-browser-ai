import { performance } from "perf_hooks";
import { observePromptApi } from "../dist/src/public/index.js";
import {
  calculateOverheadSummary,
  measurePayloadBytes,
  requireSeparatedOverheadSources
} from "../dist/src/core/validation/measure-overhead.js";

const sampleCount = Number(process.env.OVERHEAD_SAMPLE_COUNT || 30);

function deterministicPrompt(input) {
  return `processed:${String(input).length}`;
}

function deterministicStream() {
  return ["chunk-one", "chunk-two", "chunk-three"];
}

async function* deterministicAsyncStream() {
  for (const chunk of deterministicStream()) {
    yield chunk;
  }
}

function timeSync(fn) {
  const started = performance.now();
  const value = fn();
  return { value, durationMs: performance.now() - started };
}

async function timeAsync(fn) {
  const started = performance.now();
  const value = await fn();
  return { value, durationMs: performance.now() - started };
}

async function collectStream(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return chunks.join("");
}

async function standardSamples() {
  const samples = [];
  for (let index = 0; index < sampleCount; index += 1) {
    const input = `support request ${index}`;
    const baseline = timeSync(() => deterministicPrompt(input));
    const consoleObservations = [];
    const controller = observePromptApi({
      capture: "metadata",
      session: {
        async prompt(value) {
          return deterministicPrompt(value);
        }
      },
      destinations: [{ type: "console", id: "measure-console", write: (observation) => consoleObservations.push(observation) }],
      runtime: { availability: "available" },
      lifecycle: { enabled: false }
    });
    const instrumented = await timeAsync(() => controller.prompt(input));
    await controller.stop();
    const payload = measurePayloadBytes(consoleObservations[0]);
    samples.push({
      baselineOperationMs: baseline.durationMs,
      instrumentedOperationMs: instrumented.durationMs,
      observerMainThreadMs: Math.max(0, instrumented.durationMs - baseline.durationMs),
      serializationMs: 0,
      postMessageMs: 0,
      workerProcessingMs: 0,
      exportNetworkMs: 0,
      outboundPayloadBytes: payload.bytes
    });
  }
  return samples;
}

async function streamingSamples() {
  const samples = [];
  for (let index = 0; index < sampleCount; index += 1) {
    const baseline = timeSync(() => deterministicStream().join(""));
    const consoleObservations = [];
    const controller = observePromptApi({
      capture: "metadata",
      session: {
        promptStreaming() {
          return deterministicAsyncStream();
        }
      },
      destinations: [{ type: "console", id: "measure-console", write: (observation) => consoleObservations.push(observation) }],
      runtime: { availability: "available", streamingSupport: "supported" },
      lifecycle: { enabled: false }
    });
    const instrumented = await timeAsync(() => collectStream(controller.promptStreaming(`stream request ${index}`)));
    await controller.stop();
    const payload = measurePayloadBytes(consoleObservations[0]);
    samples.push({
      baselineOperationMs: baseline.durationMs,
      instrumentedOperationMs: instrumented.durationMs,
      observerMainThreadMs: Math.max(0, instrumented.durationMs - baseline.durationMs),
      serializationMs: 0,
      postMessageMs: 0,
      workerProcessingMs: 0,
      exportNetworkMs: 0,
      outboundPayloadBytes: payload.bytes,
      firstOutputBufferedByTelemetry: false,
      summaryObservationCount: 1
    });
  }
  return samples;
}

const standard = calculateOverheadSummary({
  scenario: "support-triage",
  operation: "prompt",
  source: "integration",
  samples: await standardSamples(),
  runConditions: `Node ${process.version}; deterministic fake Prompt API-compatible prompt(); in-process fallback transport; sampleCount=${sampleCount}`
});

const streaming = calculateOverheadSummary({
  scenario: "streaming-assistant",
  operation: "promptStreaming",
  source: "integration",
  samples: await streamingSamples(),
  runConditions: `Node ${process.version}; deterministic fake Prompt API-compatible promptStreaming(); in-process fallback transport; sampleCount=${sampleCount}`
});

requireSeparatedOverheadSources([standard, streaming]);

console.log(JSON.stringify({ sampleCount, summaries: [standard, streaming] }, null, 2));
