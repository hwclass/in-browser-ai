import type { TelemetryObservation } from "../../core/observation/types.js";
import type { ConsoleDestinationConfig } from "../../core/routing/types.js";

export type ConsoleDestination = ConsoleDestinationConfig;

export function createConsoleDestination(destination: ConsoleDestinationConfig = { type: "console" }) {
  return {
    async deliver(observation: TelemetryObservation): Promise<void> {
      if (destination.write) {
        destination.write(observation);
        return;
      }
      globalThis.console.log("[in-browser-ai telemetry]", observation);
    }
  };
}
