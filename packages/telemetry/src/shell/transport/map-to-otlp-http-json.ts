import type { TelemetryObservation } from "../../core/observation/types.js";

type OtlpAnyValue =
  | { stringValue: string }
  | { intValue: string }
  | { doubleValue: number }
  | { boolValue: boolean };

type OtlpAttribute = {
  key: string;
  value: OtlpAnyValue;
};

export type OtlpHttpJsonPayload = {
  resourceLogs: Array<{
    resource: { attributes: OtlpAttribute[] };
    scopeLogs: Array<{
      scope: { name: string; version: string };
      logRecords: Array<{
        timeUnixNano?: string;
        observedTimeUnixNano?: string;
        severityText: "INFO";
        body: { stringValue: "browser_ai.inference" };
        attributes: OtlpAttribute[];
      }>;
    }>;
  }>;
};

function unixNano(iso: string): string | undefined {
  const millis = Date.parse(iso);
  if (!Number.isFinite(millis)) return undefined;
  return String(Math.trunc(millis * 1_000_000));
}

function attribute(key: string, value: unknown): OtlpAttribute | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "boolean") return { key, value: { boolValue: value } };
  if (typeof value === "number" && Number.isFinite(value)) {
    if (Number.isInteger(value)) return { key, value: { intValue: String(value) } };
    return { key, value: { doubleValue: value } };
  }
  return { key, value: { stringValue: String(value) } };
}

function attributes(values: Array<[string, unknown]>): OtlpAttribute[] {
  return values.flatMap(([key, value]) => {
    const item = attribute(key, value);
    return item ? [item] : [];
  });
}

export function mapToOtlpHttpJson(observation: TelemetryObservation): OtlpHttpJsonPayload {
  const recordAttributes = attributes([
    ["browser_ai.schema_version", observation.schemaVersion],
    ["browser_ai.observation_id", observation.observationId],
    ["browser_ai.session_id", observation.sessionId],
    ["browser_ai.operation_id", observation.operationId],
    ["browser_ai.operation", observation.operation],
    ["browser_ai.outcome", observation.outcome],
    ["browser_ai.duration_ms", observation.durationMs],
    ["browser_ai.time_to_first_output_ms", observation.timeToFirstOutputMs],
    ["browser_ai.runtime.type", observation.runtime.runtimeType],
    ["browser_ai.runtime.browser_family", observation.runtime.browserFamily],
    ["browser_ai.runtime.browser_major", observation.runtime.browserMajor],
    ["browser_ai.runtime.availability", observation.runtime.availability],
    ["browser_ai.runtime.streaming_support", observation.runtime.streamingSupport],
    ["browser_ai.runtime.structured_output_support", observation.runtime.structuredOutputSupport],
    ["browser_ai.capture.mode", observation.capture.mode],
    ["browser_ai.capture.input_characters", observation.capture.inputCharacters],
    ["browser_ai.capture.output_characters", observation.capture.outputCharacters],
    ["browser_ai.usage.input_tokens", observation.usage?.inputTokens],
    ["browser_ai.usage.output_tokens", observation.usage?.outputTokens],
    ["browser_ai.stream.output_count", observation.stream?.outputCount],
    ["browser_ai.stream.produced_output", observation.stream?.producedOutput],
    ["browser_ai.observation_json", JSON.stringify(observation)]
  ]);

  if (observation.capture.mode !== "metadata") {
    recordAttributes.push(...attributes([
      ["browser_ai.capture.input", observation.capture.input],
      ["browser_ai.capture.output", observation.capture.output],
      ["browser_ai.capture.redaction_summary", observation.capture.mode === "redacted" ? observation.capture.redactionSummary : undefined]
    ]));
  }

  return {
    resourceLogs: [
      {
        resource: {
          attributes: attributes([
            ["service.name", "@in-browser-ai/telemetry"],
            ["telemetry.sdk.name", "in-browser-ai"]
          ])
        },
        scopeLogs: [
          {
            scope: { name: "@in-browser-ai/telemetry", version: observation.schemaVersion },
            logRecords: [
              {
                timeUnixNano: unixNano(observation.startedAt),
                observedTimeUnixNano: unixNano(observation.endedAt),
                severityText: "INFO",
                body: { stringValue: "browser_ai.inference" },
                attributes: recordAttributes
              }
            ]
          }
        ]
      }
    ]
  };
}
