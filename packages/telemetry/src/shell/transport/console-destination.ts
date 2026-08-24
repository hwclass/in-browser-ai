import type { TelemetryObservation } from "../../core/observation/types.js";

export type ConsoleDestination = {
  type: "console";
  id?: string;
  write?: (observation: TelemetryObservation) => void;
};

export function createConsoleDestination(destination: ConsoleDestination = { type: "console" }) {
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
