import { normalizeError } from "../observation/normalize-observation.js";
import type { WorkerFailureModel, WorkerFailurePhase } from "./types.js";

export function modelWorkerFailure(error: unknown, phase: WorkerFailurePhase): WorkerFailureModel {
  return {
    status: {
      type: phase === "initialization" ? "worker.failed" : "worker.processingFailed",
      phase,
      error: normalizeError(error) || { message: "Unknown Worker failure" }
    },
    failOpen: true,
    restart: false
  };
}
