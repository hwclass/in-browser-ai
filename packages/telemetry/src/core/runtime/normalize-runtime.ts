import type { RuntimeAvailability, SupportStatus } from "../observation/types.js";
import type { RuntimeCharacterizationInput, RuntimeCharacteristics } from "./types.js";

const availabilityValues = new Set<RuntimeAvailability>([
  "available",
  "downloadable",
  "downloading",
  "unavailable",
  "unknown"
]);

const supportValues = new Set<SupportStatus>(["supported", "unsupported", "unknown"]);

function normalizeBrowserFamily(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "chrome" || normalized === "google chrome" || normalized === "chromium") return "chromium";
  if (normalized === "firefox") return "firefox";
  if (normalized === "safari") return "safari";
  if (normalized === "edge" || normalized === "microsoft edge") return "edge";
  return undefined;
}

function normalizeBrowserMajor(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number.parseInt(value, 10) : NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function normalizeAvailability(value: unknown): RuntimeAvailability {
  return typeof value === "string" && availabilityValues.has(value as RuntimeAvailability)
    ? value as RuntimeAvailability
    : "unknown";
}

function normalizeSupport(value: unknown): SupportStatus {
  if (typeof value === "boolean") return value ? "supported" : "unsupported";
  return typeof value === "string" && supportValues.has(value as SupportStatus)
    ? value as SupportStatus
    : "unknown";
}

export function normalizeRuntimeCharacteristics(input: RuntimeCharacterizationInput = {}): RuntimeCharacteristics {
  const browserFamily = normalizeBrowserFamily(input.browserFamily);
  const browserMajor = normalizeBrowserMajor(input.browserMajor);
  return {
    runtimeType: "prompt-api",
    ...(browserFamily ? { browserFamily } : {}),
    ...(browserMajor ? { browserMajor } : {}),
    availability: normalizeAvailability(input.availability),
    streamingSupport: normalizeSupport(input.streamingSupport),
    structuredOutputSupport: normalizeSupport(input.structuredOutputSupport)
  };
}
