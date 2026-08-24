import type { DeliveryCommand, DestinationConfig } from "./types.js";
import type { TelemetryObservation } from "../observation/types.js";

const DEFAULT_DESTINATION: DestinationConfig = { type: "console", id: "console" };

function destinationId(destination: DestinationConfig, index: number): string {
  if (destination.id) return destination.id;
  return destination.type === "console" ? `console-${index + 1}` : `otlp-${index + 1}`;
}

function isEnabled(destination: DestinationConfig): boolean {
  return destination.enabled !== false;
}

function isValid(destination: DestinationConfig): boolean {
  if (destination.type === "console") return true;
  return typeof destination.endpoint === "string" && destination.endpoint.length > 0;
}

export function planDeliveries(
  observation: TelemetryObservation,
  destinations: DestinationConfig[] | undefined
): DeliveryCommand[] {
  const configured = destinations && destinations.length > 0 ? destinations : [DEFAULT_DESTINATION];
  return configured
    .map((destination, index) => ({ destinationId: destinationId(destination, index), destination, observation }))
    .filter((command) => isEnabled(command.destination) && isValid(command.destination));
}
