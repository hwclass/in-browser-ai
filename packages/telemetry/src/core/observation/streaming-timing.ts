export type StreamingTimingTracker = {
  startedAt: number;
  firstOutputAt?: number;
  recordOutput(at: number): boolean;
};

export type StreamingTimingSummary = {
  startedAt: number;
  endedAt: number;
  durationMs: number;
  producedOutput: boolean;
  timeToFirstOutputMs?: number;
};

export function createStreamingTimingTracker(startedAt: number): StreamingTimingTracker {
  return {
    startedAt,
    recordOutput(at: number): boolean {
      if (this.firstOutputAt !== undefined) return false;
      this.firstOutputAt = at;
      return true;
    }
  };
}

export function finalizeStreamingTiming(
  tracker: StreamingTimingTracker,
  endedAt: number
): StreamingTimingSummary {
  const summary: StreamingTimingSummary = {
    startedAt: tracker.startedAt,
    endedAt,
    durationMs: Math.max(0, endedAt - tracker.startedAt),
    producedOutput: tracker.firstOutputAt !== undefined
  };

  if (tracker.firstOutputAt !== undefined) {
    summary.timeToFirstOutputMs = Math.max(0, tracker.firstOutputAt - tracker.startedAt);
  }

  return summary;
}
