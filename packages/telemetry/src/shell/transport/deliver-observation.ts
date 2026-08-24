import type { TelemetryObservation } from "../../core/observation/types.js";
import { planDeliveries } from "../../core/routing/plan-deliveries.js";
import { normalizeDeliveryFailure, normalizeDeliverySuccess } from "../../core/routing/normalize-delivery-result.js";
import type { DeliveryAttempt, DestinationConfig } from "../../core/routing/types.js";
import { createConsoleDestination } from "./console-destination.js";
import { postOtlpHttpJson } from "./fetch-transport.js";
import { mapToOtlpHttpJson } from "./map-to-otlp-http-json.js";

function payloadBytes(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

export async function deliverObservation(
  observation: TelemetryObservation,
  destinations: DestinationConfig[] | undefined
): Promise<DeliveryAttempt[]> {
  const commands = planDeliveries(observation, destinations);
  const attempts = await Promise.all(commands.map(async (command): Promise<DeliveryAttempt> => {
    const startedAt = new Date().toISOString();
    let body: string | undefined;
    try {
      if (command.destination.type === "console") {
        await createConsoleDestination(command.destination).deliver(observation);
      } else {
        body = JSON.stringify(mapToOtlpHttpJson(observation));
        await postOtlpHttpJson(command.destination, body);
      }
      return normalizeDeliverySuccess({
        destinationId: command.destinationId,
        type: command.destination.type,
        observationId: observation.observationId,
        startedAt,
        endedAt: new Date().toISOString(),
        payloadBytes: body ? payloadBytes(body) : undefined
      });
    } catch (error) {
      return normalizeDeliveryFailure({
        destinationId: command.destinationId,
        type: command.destination.type,
        observationId: observation.observationId,
        error,
        startedAt,
        endedAt: new Date().toISOString(),
        payloadBytes: body ? payloadBytes(body) : undefined
      });
    }
  }));
  return attempts;
}
