import assert from "assert";
import { createLifecycleFlush, isBeaconCompatibleDestination } from "../../dist/src/shell/lifecycle/flush-pending.js";
import { observePageLifecycle } from "../../dist/src/shell/lifecycle/page-lifecycle.js";

const flushes = [];
const statuses = [];
const flush = createLifecycleFlush({
  pendingCount: () => 2,
  flush: (request) => {
    flushes.push(request);
    return Promise.resolve({
      attempted: true,
      pendingCount: 2,
      deliveryAttempts: []
    });
  },
  onStatus: (status) => statuses.push(status)
});

await flush({ reason: "lifecycle", keepalive: true, allowBeaconFallback: true });
assert.equal(flushes.length, 1);
assert.equal(flushes[0].reason, "lifecycle");
assert.equal(flushes[0].keepalive, true);
assert.equal(statuses.some((status) => status.type === "lifecycle.flushAttempted" && status.pendingCount === 2), true);

assert.equal(isBeaconCompatibleDestination({ type: "otlp", endpoint: "/otlp/v1/logs" }), true);
assert.equal(isBeaconCompatibleDestination({ type: "otlp", endpoint: "/otlp/v1/logs", headers: { "x-public-token": "ok" } }), false);
assert.equal(isBeaconCompatibleDestination({ type: "console" }), false);

let observed = 0;
const target = new EventTarget();
const lifecycle = observePageLifecycle({
  document: { addEventListener: target.addEventListener.bind(target), removeEventListener: target.removeEventListener.bind(target), visibilityState: "visible" },
  window: { addEventListener: target.addEventListener.bind(target), removeEventListener: target.removeEventListener.bind(target) },
  flush: () => {
    observed += 1;
  },
  flushOnVisibilityHidden: true,
  flushOnPageHide: true
});

target.dispatchEvent(new Event("pagehide"));
assert.equal(observed, 1);
lifecycle.stop();
target.dispatchEvent(new Event("pagehide"));
assert.equal(observed, 1);
