import type { OtlpDestinationConfig } from "../../core/routing/types.js";

export type FetchResult = {
  ok: boolean;
  status: number;
};

export type FetchLike = (input: string, init: { method: string; headers: Record<string, string>; body: string; keepalive?: boolean }) => Promise<{ ok: boolean; status: number }>;

export async function postOtlpHttpJson(
  destination: OtlpDestinationConfig,
  body: string,
  fetcher?: FetchLike,
  options: { keepalive?: boolean } = {}
): Promise<FetchResult> {
  const activeFetch = fetcher || globalThis.fetch?.bind(globalThis);
  if (!activeFetch) throw new TypeError("fetch is unavailable for OTLP delivery");

  const response = await activeFetch(destination.endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(destination.headers || {})
    },
    body,
    ...(options.keepalive ? { keepalive: true } : {})
  });

  if (!response.ok) {
    throw Object.assign(new Error(`OTLP endpoint returned HTTP ${response.status}`), {
      code: "http_status",
      recoverable: response.status >= 500 || response.status === 0
    });
  }
  return { ok: response.ok, status: response.status };
}
