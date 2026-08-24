import type { ObservationPromptMessage } from "../../shell/worker/protocol.js";
import type { StartupQueueEnqueueResult, StartupQueueSnapshot } from "./types.js";

export type StartupQueue = {
  enqueue(message: ObservationPromptMessage): StartupQueueEnqueueResult;
  drain(): ObservationPromptMessage[];
  fail(): void;
  snapshot(): StartupQueueSnapshot;
};

export function createStartupQueue(options: { capacity?: number } = {}): StartupQueue {
  const capacity = Math.max(0, Math.floor(options.capacity ?? 8));
  const messages: ObservationPromptMessage[] = [];
  let droppedCount = 0;
  let drainStatus: StartupQueueSnapshot["drainStatus"] = "not-ready";

  return {
    enqueue(message) {
      if (messages.length >= capacity) {
        droppedCount += 1;
        return {
          status: "dropped",
          queuedCount: messages.length,
          droppedCount,
          droppedMessageId: message.messageId
        };
      }
      messages.push(message);
      drainStatus = "not-ready";
      return {
        status: "queued",
        queuedCount: messages.length,
        messageId: message.messageId
      };
    },
    drain() {
      drainStatus = "draining";
      const drained = messages.splice(0, messages.length);
      drainStatus = "drained";
      return drained;
    },
    fail() {
      messages.splice(0, messages.length);
      drainStatus = "failed";
    },
    snapshot() {
      return {
        capacity,
        queuedCount: messages.length,
        droppedCount,
        drainStatus
      };
    }
  };
}
