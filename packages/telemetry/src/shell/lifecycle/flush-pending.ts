import type { FlushRequest, FlushResult } from "../../core/batching/types.js";
import type { DestinationConfig } from "../../core/routing/types.js";
import type { TelemetryStatus } from "../../public/types.js";

export type LifecycleFlushOptions = {
  pendingCount: () => number;
  flush: (request: FlushRequest) => Promise<FlushResult> | FlushResult;
  onStatus?: (status: TelemetryStatus) => void;
};

export function isBeaconCompatibleDestination(destination: DestinationConfig): boolean {
  return destination.type === "otlp" && (!destination.headers || Object.keys(destination.headers).length === 0);
}

export function createLifecycleFlush(options: LifecycleFlushOptions) {
  return async function flushPendingTelemetry(request: FlushRequest = { reason: "lifecycle" }): Promise<FlushResult> {
    const pendingCount = options.pendingCount();
    const result = await options.flush({ ...request, pendingCount });
    options.onStatus?.({
      type: "lifecycle.flushAttempted",
      pendingCount,
      reason: request.reason,
      keepalive: request.keepalive
    });
    return result;
  };
}
