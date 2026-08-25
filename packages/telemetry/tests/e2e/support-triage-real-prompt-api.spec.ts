import { chromium, expect, test } from "@playwright/test";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

type NativeProvenance = {
  executablePath: string;
  browserVersion?: string;
  cdpBrowserProduct?: string;
  cdpUserAgent?: string;
  pageUserAgent?: string;
  userAgentBrands?: { brand: string; version: string }[];
  chromeVersion?: string;
  usingInstalledGoogleChrome: boolean;
  globalPresent: boolean;
  instrumentationError?: string;
  availabilityCalls: number;
  availabilityValues: string[];
  availabilityOptionsJson?: string;
  createCalls: number;
  createResult: "not-called" | "created" | "failed";
  createError?: string;
  createOptionsJson?: string;
  createdSessionToken?: string;
  promptCalls: number;
  promptResult: "not-called" | "succeeded" | "failed";
  promptError?: string;
  promptOutputLength?: number;
  promptSessionToken?: string;
};

type SupportTriageState = {
  runtimeMode?: string;
  runtimeProvenance?: string;
  chromeVersion?: string;
  languageModelGlobalPresent?: boolean;
  availability?: string;
  finalAvailability?: string;
  modelState?: string;
  downloadProgress?: { loaded?: number; total?: number }[];
  userActivationAtCreate?: boolean;
  sessionState?: string;
  sessionError?: string;
  promptState?: string;
  promptError?: string;
  promptOutputLength?: number;
  nativeResultLength?: number;
  nativeResultSha256?: string;
  nativeResultStartJson?: string;
  nativeResultEndJson?: string;
  nativeLeadingCodePoints?: number[];
  nativeTrailingCodePoints?: number[];
  applicationResultLength?: number;
  applicationResultSha256?: string;
  applicationResultStartJson?: string;
  applicationResultEndJson?: string;
  applicationLeadingCodePoints?: number[];
  applicationTrailingCodePoints?: number[];
  domTextContentLength?: number;
  domInnerTextLength?: number;
  domTrimmedLength?: number;
  domStartJson?: string;
  domEndJson?: string;
  domLeadingCodePoints?: number[];
  domTrailingCodePoints?: number[];
  workerMode?: string;
  workerOperational?: boolean;
  latestTelemetry?: {
    operation?: string;
    outcome?: string;
    durationMs?: number;
    runtime?: { runtimeType?: string; availability?: string; browserFamily?: string };
  };
};

type Evidence = {
  provenance: NativeProvenance;
  state: SupportTriageState;
  resultText: string;
  telemetryText: string;
  resultInnerText: string;
  workerMessages: unknown[];
};

const defaultChromeExecutable = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const chromeExecutable = process.env.REAL_PROMPT_API_CHROME_EXECUTABLE || defaultChromeExecutable;
const profileDir = resolve(process.env.REAL_PROMPT_API_PROFILE_DIR || ".real-prompt-api-profile");
const readinessTimeout = Number(process.env.REAL_PROMPT_API_TIMEOUT_MS || 600000);

function chromeMajorFromVersion(value: string | undefined): number | undefined {
  const match = value?.match(/(\d+)/);
  return match ? Number(match[1]) : undefined;
}

function blockedReason(evidence: Evidence): string | undefined {
  const { provenance, state } = evidence;
  if (!existsSync(chromeExecutable)) return `BLOCKED/UNAVAILABLE: installed Google Chrome executable missing at ${chromeExecutable}`;
  if (!provenance.usingInstalledGoogleChrome) return `FAIL: real-runtime suite did not launch installed Google Chrome (${provenance.executablePath})`;
  if (!provenance.globalPresent || state.languageModelGlobalPresent === false) return "BLOCKED/UNAVAILABLE: window.LanguageModel missing";
  if (provenance.instrumentationError) return `FAIL: native provenance instrumentation failed: ${provenance.instrumentationError}`;
  if (state.availability === "unavailable") return "BLOCKED/UNAVAILABLE: LanguageModel.availability() returned unavailable";
  if (state.sessionState === "failed") return `FAIL: LanguageModel.create() failed: ${state.sessionError || provenance.createError || "unknown error"}`;
  if (state.promptState === "failed") return `FAIL: session.prompt() failed: ${state.promptError || provenance.promptError || "unknown error"}`;
  if (state.sessionState === "creating" || state.modelState === "downloading" || state.modelState === "preparing") {
    return `BLOCKED: model readiness did not finish before ${readinessTimeout}ms; state=${state.modelState}; progress=${JSON.stringify(state.downloadProgress || [])}`;
  }
  return undefined;
}

test("support-triage exercises the real Chrome Prompt API Worker telemetry path", async ({ baseURL }, testInfo) => {
  test.setTimeout(readinessTimeout + 30000);
  await mkdir(profileDir, { recursive: true });
  if (!existsSync(chromeExecutable)) test.skip(true, `BLOCKED/UNAVAILABLE: installed Google Chrome executable missing at ${chromeExecutable}`);

  const versionBrowser = await chromium.launch({
    executablePath: chromeExecutable,
    headless: false
  });
  const playwrightBrowserVersion = versionBrowser.version();
  await versionBrowser.close();

  const context = await chromium.launchPersistentContext(profileDir, {
    executablePath: chromeExecutable,
    headless: false,
    viewport: { width: 1280, height: 720 },
    acceptDownloads: false
  });

  let evidence: Evidence | undefined;
  try {
    const page = context.pages()[0] || (await context.newPage());
    const cdpSession = await context.newCDPSession(page);
    const cdpVersion = (await cdpSession.send("Browser.getVersion")) as { product?: string; userAgent?: string };

    await page.addInitScript(
      ({ executablePath, browserVersion, cdpBrowserProduct, cdpUserAgent, defaultChromeExecutable }) => {
        const OriginalWorker = window.Worker;
        const workerMessages: unknown[] = [];
        (window as typeof window & { __telemetryWorkerMessages?: unknown[] }).__telemetryWorkerMessages = workerMessages;

        class ObservedWorker extends OriginalWorker {
          postMessage(message: unknown, transfer?: Transferable[]): void {
            workerMessages.push(JSON.parse(JSON.stringify(message)));
            super.postMessage(message, transfer as never);
          }
        }

        window.Worker = ObservedWorker as unknown as typeof Worker;

        const globalScope = window as typeof window & {
          LanguageModel?: {
            availability: (...args: unknown[]) => Promise<unknown> | unknown;
            create: (...args: unknown[]) => Promise<{ prompt: (...args: unknown[]) => Promise<unknown> | unknown }> | { prompt: (...args: unknown[]) => Promise<unknown> | unknown };
          };
          __nativePromptApiProvenance?: NativeProvenance;
        };

        function chromeVersion(): string | undefined {
          const brands = navigator.userAgentData?.brands || [];
          const chromeBrand = brands.find((brand) => /Chrom(e|ium)/i.test(brand.brand));
          if (chromeBrand) return chromeBrand.version;
          return navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)/)?.[2];
        }

        function errorText(error: unknown): string {
          if (error instanceof Error) return `${error.name}: ${error.message}`;
          return String(error);
        }

        const languageModel = globalScope.LanguageModel;
        const provenance: NativeProvenance = {
          executablePath,
          browserVersion,
          cdpBrowserProduct,
          cdpUserAgent,
          pageUserAgent: navigator.userAgent,
          userAgentBrands: navigator.userAgentData?.brands?.map((brand) => ({ brand: brand.brand, version: brand.version })),
          chromeVersion: chromeVersion(),
          usingInstalledGoogleChrome: executablePath === defaultChromeExecutable,
          globalPresent: typeof languageModel !== "undefined",
          availabilityCalls: 0,
          availabilityValues: [],
          createCalls: 0,
          createResult: "not-called",
          promptCalls: 0,
          promptResult: "not-called"
        };
        globalScope.__nativePromptApiProvenance = provenance;

        if (!languageModel) return;

        try {
          const originalAvailability = languageModel.availability.bind(languageModel);
          const originalCreate = languageModel.create.bind(languageModel);

          languageModel.availability = async (...args: unknown[]) => {
            provenance.availabilityCalls += 1;
            provenance.availabilityOptionsJson = JSON.stringify(args[0]);
            const value = await originalAvailability(...args);
            provenance.availabilityValues.push(String(value));
            return value;
          };

          languageModel.create = async (...args: unknown[]) => {
            provenance.createCalls += 1;
            provenance.createOptionsJson = JSON.stringify(args[0], (key, value) => key === "monitor" && typeof value === "function" ? "[function monitor]" : value);
            try {
              const session = await originalCreate(...args);
              const sessionToken = crypto.randomUUID();
              provenance.createResult = "created";
              provenance.createdSessionToken = sessionToken;

              const originalPrompt = session.prompt.bind(session);
              session.prompt = async (...promptArgs: unknown[]) => {
                provenance.promptCalls += 1;
                provenance.promptSessionToken = sessionToken;
                try {
                  const output = await originalPrompt(...promptArgs);
                  provenance.promptResult = "succeeded";
                  provenance.promptOutputLength = String(output).length;
                  return output;
                } catch (error) {
                  provenance.promptResult = "failed";
                  provenance.promptError = errorText(error);
                  throw error;
                }
              };

              return session;
            } catch (error) {
              provenance.createResult = "failed";
              provenance.createError = errorText(error);
              throw error;
            }
          };
        } catch (error) {
          provenance.instrumentationError = errorText(error);
        }
      },
      {
        executablePath: chromeExecutable,
        browserVersion: playwrightBrowserVersion,
        cdpBrowserProduct: cdpVersion.product,
        cdpUserAgent: cdpVersion.userAgent,
        defaultChromeExecutable
      }
    );

    await page.goto(`${baseURL || "http://127.0.0.1:4173"}/examples/support-triage/?runtime=real`);
    await expect(page.getByRole("heading", { name: "Support Triage" })).toBeVisible();
    await expect(page.locator("[data-testid='runtime-mode']")).toHaveValue("real");
    await expect(page.getByRole("button", { name: "Run with real Prompt API" })).toBeVisible();

    await page.getByRole("button", { name: "Run with real Prompt API" }).click();

    try {
      await page.waitForFunction(() => {
        const state = (window as typeof window & { __supportTriageState?: SupportTriageState }).__supportTriageState;
        if (!state) return false;
        if (state.sessionState === "blocked" || state.sessionState === "failed") return true;
        return state.promptState === "succeeded" || state.promptState === "failed";
      }, undefined, { timeout: readinessTimeout });
    } catch {
      // Timeout is evaluated below from page state so downloading/preparing can be reported as BLOCKED, not relabelled as PASS.
    }

    evidence = await page.evaluate(() => {
      const globalScope = window as typeof window & {
        __nativePromptApiProvenance?: NativeProvenance;
        __supportTriageState?: SupportTriageState;
        __telemetryWorkerMessages?: unknown[];
      };
      return {
        provenance: globalScope.__nativePromptApiProvenance,
        state: globalScope.__supportTriageState,
        resultText: document.querySelector("[data-testid='result']")?.textContent || "",
        resultInnerText: (document.querySelector("[data-testid='result']") as HTMLElement | null)?.innerText || "",
        telemetryText: document.querySelector("[data-testid='telemetry']")?.textContent || "",
        workerMessages: globalScope.__telemetryWorkerMessages || []
      } as Evidence;
    });
  } finally {
    await context.close();
  }

  expect(evidence?.provenance).toBeTruthy();
  expect(evidence?.state).toBeTruthy();
  const actualEvidence = evidence as Evidence;
  const { provenance, state } = actualEvidence;

  testInfo.annotations.push({ type: "chrome-executable", description: provenance.executablePath });
  testInfo.annotations.push({ type: "browser-version", description: provenance.browserVersion || "unknown" });
  testInfo.annotations.push({ type: "cdp-browser-product", description: provenance.cdpBrowserProduct || "unknown" });
  testInfo.annotations.push({ type: "cdp-user-agent", description: provenance.cdpUserAgent || "unknown" });
  testInfo.annotations.push({ type: "page-user-agent", description: provenance.pageUserAgent || "unknown" });
  testInfo.annotations.push({ type: "user-agent-brands", description: JSON.stringify(provenance.userAgentBrands || []) });
  testInfo.annotations.push({ type: "language-model-global", description: String(provenance.globalPresent) });
  testInfo.annotations.push({ type: "initial-availability", description: provenance.availabilityValues[0] || state.availability || "not-called" });
  testInfo.annotations.push({ type: "final-availability", description: state.finalAvailability || "not-recorded" });
  testInfo.annotations.push({ type: "availability-options", description: provenance.availabilityOptionsJson || "not-called" });
  testInfo.annotations.push({ type: "create-options", description: provenance.createOptionsJson || "not-called" });
  testInfo.annotations.push({ type: "user-activation-at-create", description: String(state.userActivationAtCreate) });
  testInfo.annotations.push({ type: "download-progress", description: JSON.stringify(state.downloadProgress || []) });
  testInfo.annotations.push({ type: "session-creation", description: state.sessionState || provenance.createResult });
  testInfo.annotations.push({ type: "prompt-execution", description: state.promptState || provenance.promptResult });
  testInfo.annotations.push({
    type: "result-evidence",
    description: JSON.stringify({
      nativeLength: state.nativeResultLength,
      nativeSha256: state.nativeResultSha256,
      applicationLength: state.applicationResultLength,
      applicationSha256: state.applicationResultSha256,
      domTextContentLength: state.domTextContentLength,
      domInnerTextLength: state.domInnerTextLength,
      domTrimmedLength: state.domTrimmedLength,
      nativeStartJson: state.nativeResultStartJson,
      nativeEndJson: state.nativeResultEndJson,
      applicationStartJson: state.applicationResultStartJson,
      applicationEndJson: state.applicationResultEndJson,
      domStartJson: state.domStartJson,
      domEndJson: state.domEndJson,
      nativeLeadingCodePoints: state.nativeLeadingCodePoints,
      nativeTrailingCodePoints: state.nativeTrailingCodePoints,
      domLeadingCodePoints: state.domLeadingCodePoints,
      domTrailingCodePoints: state.domTrailingCodePoints,
      workerMode: state.workerMode,
      workerOperational: state.workerOperational,
      telemetryEmitted: Boolean(state.latestTelemetry)
    })
  });

  const reason = blockedReason(actualEvidence);
  if (reason?.startsWith("FAIL:")) throw new Error(reason);
  if (reason) test.skip(true, reason);

  expect(provenance.executablePath).toBe(defaultChromeExecutable);
  expect(provenance.usingInstalledGoogleChrome).toBe(true);
  expect(chromeMajorFromVersion(provenance.browserVersion)).toBeGreaterThanOrEqual(120);
  expect(provenance.pageUserAgent).toContain("Chrome/");
  expect(provenance.globalPresent).toBe(true);
  expect(provenance.availabilityCalls).toBeGreaterThan(0);
  expect(provenance.availabilityOptionsJson).toContain('"expectedInputs":[{"type":"text","languages":["en"]}]');
  expect(provenance.availabilityOptionsJson).toContain('"expectedOutputs":[{"type":"text","languages":["en"]}]');
  expect(provenance.availabilityValues[0]).toBe("available");
  expect(state.availability).toBe("available");
  expect(state.userActivationAtCreate).toBe(true);
  expect(provenance.createCalls).toBe(1);
  expect(provenance.createOptionsJson).toContain('"expectedInputs":[{"type":"text","languages":["en"]}]');
  expect(provenance.createOptionsJson).toContain('"expectedOutputs":[{"type":"text","languages":["en"]}]');
  expect(provenance.createOptionsJson).toContain('"monitor":"[function monitor]"');
  expect(provenance.createResult).toBe("created");
  expect(state.sessionState).toBe("created");
  expect(state.modelState).toBe("ready");
  expect(state.promptState).toBe("succeeded");
  expect(state.runtimeMode).toBe("real");
  expect(state.runtimeProvenance).toBe("native");

  expect(state.nativeResultLength).toBeGreaterThan(0);
  expect(state.nativeResultLength).toBe(state.applicationResultLength);
  expect(state.nativeResultSha256).toBe(state.applicationResultSha256);
  expect(state.promptOutputLength).toBe(state.applicationResultLength);

  expect(actualEvidence.resultText.length).toBe(state.applicationResultLength);
  expect(state.domTextContentLength).toBe(state.applicationResultLength);
  expect(state.domInnerTextLength).toBe(actualEvidence.resultInnerText.length);
  expect(state.domTrimmedLength).toBe(actualEvidence.resultText.trim().length);
  expect(actualEvidence.resultText.trim().length).toBeGreaterThan(0);

  expect(state.workerMode).toBe("browser-worker");
  expect(state.workerOperational).toBe(true);
  expect(state.latestTelemetry).toMatchObject({
    operation: "prompt",
    outcome: "success",
    runtime: {
      runtimeType: "prompt-api",
      browserFamily: "chromium"
    }
  });
  expect(typeof state.latestTelemetry?.durationMs).toBe("number");
  expect(state.latestTelemetry?.durationMs).toBeGreaterThan(0);

  const workerMessages = actualEvidence.workerMessages;
  expect(workerMessages.length).toBeGreaterThan(0);
  const observationMessage = workerMessages.find((message) => {
    return (message as { type?: unknown }).type === "observation.prompt";
  });
  expect(observationMessage).toMatchObject({
    protocolVersion: "telemetry.worker.v1",
    type: "observation.prompt",
    payload: {
      operation: "prompt",
      outcome: "success"
    }
  });
  expect(JSON.stringify(workerMessages)).not.toContain("Classify this ticket");
  expect(JSON.stringify(workerMessages)).not.toContain("My order arrived damaged");
  const displayedSample = actualEvidence.resultText.trim().slice(0, 80);
  expect(JSON.stringify(workerMessages)).not.toContain(displayedSample);
  expect(actualEvidence.telemetryText).not.toContain("Classify this ticket");
  expect(actualEvidence.telemetryText).not.toContain("My order arrived damaged");
  expect(actualEvidence.telemetryText).not.toContain(displayedSample);
});
