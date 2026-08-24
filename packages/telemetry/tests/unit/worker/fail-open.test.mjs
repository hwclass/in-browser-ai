import assert from "assert";
import { modelWorkerFailure } from "../../../dist/src/core/batching/fail-open.js";

const startup = modelWorkerFailure(new TypeError("Worker blocked"), "initialization");
assert.equal(startup.status.type, "worker.failed");
assert.equal(startup.status.phase, "initialization");
assert.equal(startup.failOpen, true);
assert.equal(startup.restart, false);
assert.equal(startup.status.error.name, "TypeError");
assert.equal(startup.status.error.message, "Worker blocked");

const processing = modelWorkerFailure("bad telemetry payload", "processing");
assert.equal(processing.status.type, "worker.processingFailed");
assert.equal(processing.status.phase, "processing");
assert.equal(processing.failOpen, true);
assert.equal(processing.restart, false);
assert.equal(processing.status.error.message, "bad telemetry payload");
