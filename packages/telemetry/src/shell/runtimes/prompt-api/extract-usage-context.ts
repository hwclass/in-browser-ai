import type { InferenceContext, InferenceUsage } from "../../../core/observation/types.js";

type ExtractionResult = {
  usage?: InferenceUsage;
  context?: InferenceContext;
};

function numberField(source: Record<string, unknown>, key: string): number | undefined {
  const value = source[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function pickUsage(source: unknown): InferenceUsage | undefined {
  if (!source || typeof source !== "object") return undefined;
  const record = source as Record<string, unknown>;
  const usage: InferenceUsage = {};
  const fields: Array<keyof InferenceUsage> = [
    "inputCharacters",
    "outputCharacters",
    "inputTokens",
    "outputTokens",
    "contextWindowUsed",
    "contextWindowLimit"
  ];
  for (const field of fields) {
    const value = numberField(record, field);
    if (typeof value === "number") usage[field] = value;
  }
  return Object.keys(usage).length > 0 ? usage : undefined;
}

function pickContext(source: unknown): InferenceContext | undefined {
  if (!source || typeof source !== "object") return undefined;
  const record = source as Record<string, unknown>;
  const context: InferenceContext = {};
  const contextWindowUsed = numberField(record, "contextWindowUsed");
  const contextWindowLimit = numberField(record, "contextWindowLimit");
  if (typeof contextWindowUsed === "number") context.contextWindowUsed = contextWindowUsed;
  if (typeof contextWindowLimit === "number") context.contextWindowLimit = contextWindowLimit;
  return Object.keys(context).length > 0 ? context : undefined;
}

export function extractUsageContext(source: unknown): ExtractionResult {
  if (!source || typeof source !== "object") return {};
  const record = source as Record<string, unknown>;
  const usage = pickUsage(record.usage) || pickUsage(record);
  const context = pickContext(record.context) || pickContext(record);
  const result: ExtractionResult = {};
  if (usage) result.usage = usage;
  if (context) result.context = context;
  return result;
}
