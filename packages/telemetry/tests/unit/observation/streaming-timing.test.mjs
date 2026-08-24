import assert from "assert";
import {
  createStreamingTimingTracker,
  finalizeStreamingTiming
} from "../../../dist/src/core/observation/streaming-timing.js";

const outputTracker = createStreamingTimingTracker(100);
assert.equal(outputTracker.firstOutputAt, undefined);
assert.equal(outputTracker.recordOutput(125), true);
assert.equal(outputTracker.firstOutputAt, 125);
assert.equal(outputTracker.recordOutput(130), false);

const outputTiming = finalizeStreamingTiming(outputTracker, 180);
assert.equal(outputTiming.startedAt, 100);
assert.equal(outputTiming.endedAt, 180);
assert.equal(outputTiming.durationMs, 80);
assert.equal(outputTiming.timeToFirstOutputMs, 25);
assert.equal(outputTiming.producedOutput, true);

const noOutputTracker = createStreamingTimingTracker(200);
const noOutputTiming = finalizeStreamingTiming(noOutputTracker, 230);
assert.equal(noOutputTiming.durationMs, 30);
assert.equal(noOutputTiming.timeToFirstOutputMs, undefined);
assert.equal(noOutputTiming.producedOutput, false);
