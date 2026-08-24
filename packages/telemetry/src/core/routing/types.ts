import type { TelemetryObservation, TelemetryError } from "../observation/types.js";

export type ConsoleDestinationConfig = {
  type: "console";
  id?: string;
  enabled?: boolean;
  write?: (observation: TelemetryObservation) => void;
};

export type OtlpDestinationConfig = {
  type: "otlp";
  id?: string;
  enabled?: boolean;
  endpoint: string;
  headers?: Record<string, string>;
  encoding?: "otlp-http-json";
};

export type DestinationConfig = ConsoleDestinationConfig | OtlpDestinationConfig;

export type SerializableDestinationConfig =
  | Omit<ConsoleDestinationConfig, "write">
  | OtlpDestinationConfig;

export type DeliveryCommand = {
  destinationId: string;
  destination: DestinationConfig;
  observation: TelemetryObservation;
};

export type DeliveryAttemptStatus = "sent" | "failed" | "skipped";

export type DeliveryAttempt = {
  destinationId: string;
  type: DestinationConfig["type"];
  observationId: string;
  status: DeliveryAttemptStatus;
  startedAt?: string;
  endedAt?: string;
  error?: TelemetryError;
  payloadBytes?: number;
};
