import type { TelemetryWorkerMessage } from "./protocol.js";
import { isTelemetryWorkerMessage } from "./protocol.js";

const CONTENT_KEYS = new Set(["input", "output", "prompt", "response", "chunks"]);

function hasContentBearingField(value: unknown, path: string[] = []): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) {
    return value.some((item, index) => hasContentBearingField(item, path.concat(String(index))));
  }
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (CONTENT_KEYS.has(key) && typeof item === "string") return true;
    if (hasContentBearingField(item, path.concat(key))) return true;
  }
  return false;
}

export function validateTelemetryWorkerMessage(value: unknown): value is TelemetryWorkerMessage {
  if (!isTelemetryWorkerMessage(value)) return false;
  if (value.type !== "observation.prompt" && value.type !== "observation.promptStreaming") return true;
  if (value.payload.capture?.mode !== "metadata") return true;
  return !hasContentBearingField(value.payload);
}
