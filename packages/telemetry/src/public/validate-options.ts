import type { DestinationConfig } from "../core/routing/types.js";

const SECRET_HEADER_NAMES = new Set(["authorization", "cookie", "set-cookie", "x-api-key", "x-auth-token"]);

export function validateDestinations(destinations: DestinationConfig[] | undefined): DestinationConfig[] | undefined {
  if (!destinations) return undefined;
  return destinations.map((destination) => {
    if (destination.type !== "otlp") return destination;
    for (const headerName of Object.keys(destination.headers || {})) {
      if (SECRET_HEADER_NAMES.has(headerName.toLowerCase())) {
        throw new TypeError(`OTLP destination ${destination.id || destination.endpoint} uses a private browser header: ${headerName}`);
      }
    }
    return {
      ...destination,
      encoding: destination.encoding || "otlp-http-json"
    };
  });
}
