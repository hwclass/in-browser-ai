export function toIsoTimestamp(value: number | string): string {
  if (typeof value === "string") return value;
  return new Date(value).toISOString();
}

export function durationMs(startedAt: number | string, endedAt: number | string): number {
  const start = typeof startedAt === "number" ? startedAt : Date.parse(startedAt);
  const end = typeof endedAt === "number" ? endedAt : Date.parse(endedAt);
  return Math.max(0, end - start);
}
