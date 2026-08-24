import type { RuntimeAvailability, RuntimeSummary, SupportStatus } from "../../../core/observation/types.js";
import { normalizeRuntimeCharacteristics } from "../../../core/runtime/normalize-runtime.js";

export type PromptApiAvailabilityInput = {
  availability?: RuntimeAvailability;
  browserFamily?: string;
  browserMajor?: number;
  streamingSupport?: SupportStatus;
  structuredOutputSupport?: SupportStatus;
  languageModelPresent?: boolean;
  userAgent?: string;
  userAgentData?: {
    brands?: Array<{ brand: string; version: string }>;
  };
};

function detectBrowser(input: PromptApiAvailabilityInput): Pick<RuntimeSummary, "browserFamily" | "browserMajor"> {
  const brands = input.userAgentData?.brands || [];
  const chromiumBrand = brands.find((brand) => /Chrom(e|ium)|Microsoft Edge/i.test(brand.brand));
  if (chromiumBrand) {
    return {
      browserFamily: /Edge/i.test(chromiumBrand.brand) ? "edge" : "chromium",
      browserMajor: Number.parseInt(chromiumBrand.version, 10)
    };
  }

  const userAgent = input.userAgent || "";
  const chromium = userAgent.match(/(?:Chrome|Chromium)\/([0-9]+)/);
  if (chromium) return { browserFamily: "chromium", browserMajor: Number.parseInt(chromium[1], 10) };
  const firefox = userAgent.match(/Firefox\/([0-9]+)/);
  if (firefox) return { browserFamily: "firefox", browserMajor: Number.parseInt(firefox[1], 10) };
  const safari = !/Chrome|Chromium/i.test(userAgent) ? userAgent.match(/Version\/([0-9]+).*Safari/) : undefined;
  if (safari) return { browserFamily: "safari", browserMajor: Number.parseInt(safari[1], 10) };
  return {};
}

export function inspectPromptApiAvailability(input: PromptApiAvailabilityInput = {}): RuntimeSummary {
  const detected = detectBrowser(input);
  return normalizeRuntimeCharacteristics({
    runtimeType: "prompt-api",
    browserFamily: input.browserFamily || detected.browserFamily,
    browserMajor: input.browserMajor || detected.browserMajor,
    availability: input.availability || (input.languageModelPresent === false ? "unavailable" : "unknown"),
    streamingSupport: input.streamingSupport || (input.languageModelPresent === false ? "unsupported" : "unknown"),
    structuredOutputSupport: input.structuredOutputSupport || "unknown"
  });
}
