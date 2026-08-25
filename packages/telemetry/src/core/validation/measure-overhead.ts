export type MeasurementSource =
  | "integration"
  | "deterministic-e2e-example"
  | "manual-example"
  | "native-chrome"
  | "documented-combination";

export type OverheadSample = {
  baselineOperationMs: number;
  instrumentedOperationMs: number;
  observerMainThreadMs?: number;
  serializationMs?: number;
  postMessageMs?: number;
  workerProcessingMs?: number;
  exportNetworkMs?: number;
  outboundPayloadBytes?: number;
  nativeRuntimeLatencyMs?: number;
  firstOutputBufferedByTelemetry?: boolean;
  summaryObservationCount?: number;
};

export type OverheadStatistic = {
  mean: number;
  min: number;
  max: number;
};

export type OverheadSummary = {
  scenario: string;
  operation: "prompt" | "promptStreaming";
  source: MeasurementSource;
  sampleCount: number;
  runConditions: string;
  baselineOperationMs: OverheadStatistic;
  instrumentedOperationMs: OverheadStatistic;
  instrumentationDeltaMs: OverheadStatistic;
  observerMainThreadMs?: OverheadStatistic;
  serializationMs?: OverheadStatistic;
  postMessageMs?: OverheadStatistic;
  workerProcessingMs?: OverheadStatistic;
  exportNetworkMs?: OverheadStatistic;
  outboundPayloadBytes?: OverheadStatistic;
  nativeRuntimeLatencyMs?: OverheadStatistic;
  modelRuntimeLatencyIncludedInOverhead: false;
  firstOutputBufferedByTelemetry?: boolean;
  summaryObservationCount?: number;
};

function stats(values: number[]): OverheadStatistic {
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length === 0) return { mean: 0, min: 0, max: 0 };
  const sum = finite.reduce((total, value) => total + value, 0);
  return {
    mean: Number((sum / finite.length).toFixed(3)),
    min: Math.min(...finite),
    max: Math.max(...finite)
  };
}

function optionalStats(samples: OverheadSample[], key: keyof OverheadSample): OverheadStatistic | undefined {
  const values = samples
    .map((sample) => sample[key])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return values.length > 0 ? stats(values) : undefined;
}

export function calculateOverheadSummary(input: {
  scenario: string;
  operation: "prompt" | "promptStreaming";
  source: MeasurementSource;
  samples: OverheadSample[];
  runConditions: string;
}): OverheadSummary {
  if (input.samples.length === 0) {
    throw new Error("At least one overhead sample is required");
  }

  return {
    scenario: input.scenario,
    operation: input.operation,
    source: input.source,
    sampleCount: input.samples.length,
    runConditions: input.runConditions,
    baselineOperationMs: stats(input.samples.map((sample) => sample.baselineOperationMs)),
    instrumentedOperationMs: stats(input.samples.map((sample) => sample.instrumentedOperationMs)),
    instrumentationDeltaMs: stats(
      input.samples.map((sample) => sample.instrumentedOperationMs - sample.baselineOperationMs)
    ),
    observerMainThreadMs: optionalStats(input.samples, "observerMainThreadMs"),
    serializationMs: optionalStats(input.samples, "serializationMs"),
    postMessageMs: optionalStats(input.samples, "postMessageMs"),
    workerProcessingMs: optionalStats(input.samples, "workerProcessingMs"),
    exportNetworkMs: optionalStats(input.samples, "exportNetworkMs"),
    outboundPayloadBytes: optionalStats(input.samples, "outboundPayloadBytes"),
    nativeRuntimeLatencyMs: optionalStats(input.samples, "nativeRuntimeLatencyMs"),
    modelRuntimeLatencyIncludedInOverhead: false,
    firstOutputBufferedByTelemetry: input.samples.some((sample) => sample.firstOutputBufferedByTelemetry === true),
    summaryObservationCount: optionalStats(input.samples, "summaryObservationCount")?.max
  };
}

export function measurePayloadBytes(value: unknown): { bytes: number; shape: "json-serializable" } {
  const json = JSON.stringify(value);
  if (json === undefined) throw new Error("Payload is not JSON-serializable");
  return {
    bytes: new TextEncoder().encode(json).byteLength,
    shape: "json-serializable"
  };
}

export function requireSeparatedOverheadSources(summaries: OverheadSummary[]): void {
  for (const summary of summaries) {
    if (summary.source === "native-chrome" && summary.modelRuntimeLatencyIncludedInOverhead !== false) {
      throw new Error("Native Prompt API latency must not be reported as telemetry overhead");
    }
    if (!summary.runConditions || summary.sampleCount < 1) {
      throw new Error(`Overhead summary for ${summary.scenario} must record sample count and run conditions`);
    }
  }
}
