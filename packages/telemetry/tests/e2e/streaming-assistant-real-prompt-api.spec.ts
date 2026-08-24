import { chromium, expect, test } from "@playwright/test";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

type NativeStreamingProvenance = {
  executablePath: string;
  browserVersion?: string;
  cdpBrowserProduct?: string;
  cdpUserAgent?: string;
  pageUserAgent?: string;
  userAgentBrands?: { brand: string; version: string }[];
  usingInstalledGoogleChrome: boolean;
  globalPresent: boolean;
  availabilityCalls: number;
  availabilityValues: string[];
  availabilityOptionsJson?: string;
  createCalls: number;
  createResult: "not-called" | "created" | "failed";
  createOptionsJson?: string;
  createError?: string;
  promptStreamingCalls: number;
  promptStreamingResult: "not-called" | "created" | "failed";
  promptStreamingError?: string;
};

type StreamingAssistantState = {
  runtimeMode?: string;
  runtimeProvenance?: string;
  languageModelGlobalPresent?: boolean;
  availability?: string;
  finalAvailability?: string;
  modelState?: string;
  sessionState?: string;
  sessionError?: string;
  streamState?: string;
  streamError?: string;
  applicationChunkCount?: number;
  nativeChunkCount?: number;
  applicationResultLength?: number;
  nativeResultLength?: number;
  applicationResultSha256?: string;
  nativeResultSha256?: string;
  timeToFirstOutputMs?: number;
  durationMs?: number;
  workerMode?: string;
  workerOperational?: boolean;
  latestTelemetry?: {
    operation?: string;
    outcome?: string;
    durationMs?: number;
    timeToFirstOutputMs?: number;
    stream?: { outputCount?: number; producedOutput?: boolean };
  };
};

type Evidence = {
  provenance: NativeStreamingProvenance;
  state: StreamingAssistantState;
  resultText: string;
  telemetryText: string;
  workerMessages: unknown[];
};

const defaultChromeExecutable = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const chromeExecutable = process.env.REAL_PROMPT_API_CHROME_EXECUTABLE || defaultChromeExecutable;
const profileDir = resolve(process.env.REAL_PROMPT_API_PROFILE_DIR || ".real-prompt-api-profile");
const readinessTimeout = Number(process.env.REAL_PROMPT_API_TIMEOUT_MS || 600000);

function blockedReason(evidence: Evidence): string | undefined {
  const { provenance, state } = evidence;
  if (!existsSync(chromeExecutable)) return `UNAVAILABLE: installed Google Chrome executable missing at ${chromeExecutable}`;
  if (!provenance.usingInstalledGoogleChrome) return `FAIL: real-runtime suite did not launch installed Google Chrome (${provenance.executablePath})`;
  if (!provenance.globalPresent || state.languageModelGlobalPresent === false) return "UNAVAILABLE: window.LanguageModel missing";
  if (state.availability === "unavailable") return "UNAVAILABLE: LanguageModel.availability() returned unavailable";
  if (state.sessionState === "failed") return `FAIL: LanguageModel.create() failed: ${state.sessionError || provenance.createError || "unknown error"}`;
  if (state.streamState === "failed") return `FAIL: session.promptStreaming() failed: ${state.streamError || provenance.promptStreamingError || "unknown error"}`;
  if (state.sessionState === "creating" || state.modelState === "downloading" || state.modelState === "preparing") {
    return `BLOCKED: model readiness did not finish before ${readinessTimeout}ms`;
  }
  return undefined;
}

test("streaming-assistant exercises the real Chrome Prompt API streaming Worker telemetry path", async ({ baseURL }, testInfo) => {
  test.setTimeout(readinessTimeout + 30000);
  await mkdir(profileDir, { recursive: true });
  if (!existsSync(chromeExecutable)) test.skip(true, `UNAVAILABLE: installed Google Chrome executable missing at ${chromeExecutable}`);

  const versionBrowser = await chromium.launch({ executablePath: chromeExecutable, headless: false });
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
            create: (...args: unknown[]) => Promise<{ promptStreaming: (...args: unknown[]) => unknown }> | { promptStreaming: (...args: unknown[]) => unknown };
          };
          __nativePromptApiStreamingProvenance?: NativeStreamingProvenance;
        };

        function errorText(error: unknown): string {
          if (error instanceof Error) return `${error.name}: ${error.message}`;
          return String(error);
        }

        const languageModel = globalScope.LanguageModel;
        const provenance: NativeStreamingProvenance = {
          executablePath,
          browserVersion,
          cdpBrowserProduct,
          cdpUserAgent,
          pageUserAgent: navigator.userAgent,
          userAgentBrands: navigator.userAgentData?.brands?.map((brand) => ({ brand: brand.brand, version: brand.version })),
          usingInstalledGoogleChrome: executablePath === defaultChromeExecutable,
          globalPresent: typeof languageModel !== "undefined",
          availabilityCalls: 0,
          availabilityValues: [],
          createCalls: 0,
          createResult: "not-called",
          promptStreamingCalls: 0,
          promptStreamingResult: "not-called"
        };
        globalScope.__nativePromptApiStreamingProvenance = provenance;

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
              provenance.createResult = "created";
              const originalPromptStreaming = session.promptStreaming.bind(session);
              session.promptStreaming = (...streamArgs: unknown[]) => {
                provenance.promptStreamingCalls += 1;
                try {
                  const stream = originalPromptStreaming(...streamArgs);
                  provenance.promptStreamingResult = "created";
                  return stream;
                } catch (error) {
                  provenance.promptStreamingResult = "failed";
                  provenance.promptStreamingError = errorText(error);
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
          provenance.createError = errorText(error);
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

    await page.goto(`${baseURL || "http://127.0.0.1:4173"}/examples/streaming-assistant/?runtime=real`);
    await expect(page.getByRole("heading", { name: "Streaming Assistant" })).toBeVisible();
    await expect(page.locator("[data-testid='runtime-mode']")).toHaveValue("real");
    await page.getByRole("button", { name: "Run with real Prompt API streaming" }).click();

    try {
      await page.waitForFunction(() => {
        const state = (window as typeof window & { __streamingAssistantState?: StreamingAssistantState }).__streamingAssistantState;
        if (!state) return false;
        if (state.sessionState === "blocked" || state.sessionState === "failed") return true;
        return state.streamState === "succeeded" || state.streamState === "failed";
      }, undefined, { timeout: readinessTimeout });
    } catch {
      // Timeout is evaluated below from page state so downloading/preparing can be reported as BLOCKED.
    }

    evidence = await page.evaluate(() => {
      const globalScope = window as typeof window & {
        __nativePromptApiStreamingProvenance?: NativeStreamingProvenance;
        __streamingAssistantState?: StreamingAssistantState;
        __telemetryWorkerMessages?: unknown[];
      };
      return {
        provenance: globalScope.__nativePromptApiStreamingProvenance,
        state: globalScope.__streamingAssistantState,
        resultText: document.querySelector("[data-testid='result']")?.textContent || "",
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
  testInfo.annotations.push({ type: "session-creation", description: state.sessionState || provenance.createResult });
  testInfo.annotations.push({ type: "prompt-streaming", description: state.streamState || provenance.promptStreamingResult });
  testInfo.annotations.push({
    type: "stream-evidence",
    description: JSON.stringify({
      nativeChunkCount: state.nativeChunkCount,
      applicationChunkCount: state.applicationChunkCount,
      nativeLength: state.nativeResultLength,
      applicationLength: state.applicationResultLength,
      nativeSha256: state.nativeResultSha256,
      applicationSha256: state.applicationResultSha256,
      timeToFirstOutputMs: state.timeToFirstOutputMs,
      durationMs: state.durationMs,
      workerMode: state.workerMode,
      workerOperational: state.workerOperational,
      telemetry: state.latestTelemetry
    })
  });

  const blocked = blockedReason(actualEvidence);
  if (blocked) {
    if (blocked.startsWith("FAIL:")) throw new Error(blocked);
    test.skip(true, blocked);
  }

  expect(provenance.globalPresent).toBe(true);
  expect(provenance.availabilityCalls).toBeGreaterThan(0);
  expect(provenance.availabilityOptionsJson).toContain('"expectedInputs":[{"type":"text","languages":["en"]}]');
  expect(provenance.availabilityOptionsJson).toContain('"expectedOutputs":[{"type":"text","languages":["en"]}]');
  expect(provenance.createCalls).toBe(1);
  expect(provenance.createResult).toBe("created");
  expect(provenance.createOptionsJson).toContain('"expectedInputs":[{"type":"text","languages":["en"]}]');
  expect(provenance.createOptionsJson).toContain('"expectedOutputs":[{"type":"text","languages":["en"]}]');
  expect(provenance.promptStreamingCalls).toBe(1);
  expect(provenance.promptStreamingResult).toBe("created");
  expect(state.runtimeMode).toBe("real");
  expect(state.runtimeProvenance).toBe("native");
  expect(state.availability).not.toBe("unavailable");
  expect(state.sessionState).toBe("created");
  expect(state.streamState).toBe("succeeded");
  expect(state.nativeChunkCount).toBeGreaterThan(0);
  expect(state.applicationChunkCount).toBe(state.nativeChunkCount);
  expect(state.nativeResultLength).toBeGreaterThan(0);
  expect(state.nativeResultLength).toBe(state.applicationResultLength);
  expect(state.nativeResultSha256).toBe(state.applicationResultSha256);
  expect(state.timeToFirstOutputMs).toBeGreaterThan(0);
  expect(state.durationMs).toBeGreaterThanOrEqual(state.timeToFirstOutputMs || 0);
  expect(state.workerMode).toBe("browser-worker");
  expect(state.workerOperational).toBe(true);
  expect(state.latestTelemetry?.operation).toBe("promptStreaming");
  expect(state.latestTelemetry?.outcome).toBe("success");
  expect(state.latestTelemetry?.stream?.outputCount).toBe(state.applicationChunkCount);
  expect(state.latestTelemetry?.stream?.producedOutput).toBe(true);
  expect(state.latestTelemetry?.timeToFirstOutputMs).toBeGreaterThan(0);
  expect(state.latestTelemetry?.durationMs).toBeGreaterThanOrEqual(state.latestTelemetry?.timeToFirstOutputMs || 0);
  const observationMessages = actualEvidence.workerMessages.filter((message) => {
    return (message as { type?: unknown }).type === "observation.promptStreaming";
  });
  expect(observationMessages).toHaveLength(1);
  expect(JSON.stringify(actualEvidence.workerMessages)).not.toContain(actualEvidence.resultText.slice(0, 80));
});
