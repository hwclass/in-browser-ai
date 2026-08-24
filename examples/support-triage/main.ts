import { observePromptApi, type TelemetryController } from "../../packages/telemetry/src/public/index";
import { renderTelemetryPanel } from "../shared/harness";

type RuntimeMode = "deterministic" | "real";
type AvailabilityState = "available" | "downloadable" | "downloading" | "unavailable" | "unknown";

type NativeLanguageModel = {
  availability(options?: PromptApiSessionOptions): Promise<AvailabilityState> | AvailabilityState;
  create(options?: {
    expectedInputs?: PromptApiContentOptions[];
    expectedOutputs?: PromptApiContentOptions[];
    monitor?: (monitorTarget: EventTarget) => void;
  }): Promise<NativePromptSession> | NativePromptSession;
};

type PromptApiContentOptions = {
  type: "text";
  languages: string[];
};

type PromptApiSessionOptions = {
  expectedInputs: PromptApiContentOptions[];
  expectedOutputs: PromptApiContentOptions[];
};

type NativePromptSession = {
  prompt(input: unknown, options?: unknown): Promise<unknown>;
  usage?: unknown;
};

type SupportTriageState = {
  runtimeMode: RuntimeMode;
  runtimeProvenance: "deterministic" | "native" | "missing";
  chromeVersion?: string;
  languageModelGlobalPresent: boolean;
  availability?: AvailabilityState;
  finalAvailability?: AvailabilityState;
  modelState: "not-started" | "preparing" | "downloading" | "ready" | "blocked" | "failed";
  downloadProgress?: { loaded?: number; total?: number }[];
  userActivationAtCreate?: boolean;
  sessionState: "not-started" | "creating" | "created" | "failed" | "blocked";
  sessionError?: string;
  promptState: "not-started" | "succeeded" | "failed" | "blocked";
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
  workerStatus?: string;
  workerFailure?: string;
  startupQueuedCount?: number;
  startupDroppedCount?: number;
  startupDrainedCount?: number;
  destinationSentCount?: number;
  destinationFailedCount?: number;
  lifecycleFlushCount?: number;
  lastLifecycleFlushReason?: string;
  lastLifecyclePendingCount?: number;
  lastLifecycleKeepalive?: boolean;
  latestTelemetry?: unknown;
  telemetryCount: number;
};

const ticket = document.querySelector<HTMLTextAreaElement>("#ticket");
const button = document.querySelector<HTMLButtonElement>("#triage");
const result = document.querySelector<HTMLElement>("#result");
const telemetry = document.querySelector<HTMLElement>("#telemetry");
const runtimeMode = document.querySelector<HTMLSelectElement>("#runtime-mode");
const runtimeStatus = document.querySelector<HTMLElement>("#runtime-status");

const fakePromptSession = {
  usage: { inputTokens: 18, outputTokens: 5 },
  async prompt(): Promise<string> {
    return "Billing: replacement requested";
  }
};

const observations: unknown[] = [];
let controller: TelemetryController | undefined;

const promptApiEnglishOptions: PromptApiSessionOptions = {
  expectedInputs: [{ type: "text", languages: ["en"] }],
  expectedOutputs: [{ type: "text", languages: ["en"] }]
};

const globalWithPromptApi = globalThis as typeof globalThis & {
  LanguageModel?: NativeLanguageModel;
  __supportTriageState?: SupportTriageState;
};

function detectChromeVersion(): string | undefined {
  const brands = navigator.userAgentData?.brands || [];
  const chromeBrand = brands.find((brand) => /Chrom(e|ium)/i.test(brand.brand));
  if (chromeBrand) return chromeBrand.version;
  return navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)/)?.[2];
}

function errorText(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

function edgeSlice(value: string, side: "start" | "end"): string {
  return side === "start" ? value.slice(0, 24) : value.slice(Math.max(0, value.length - 24));
}

function edgeCodePoints(value: string, side: "start" | "end"): number[] {
  return Array.from(edgeSlice(value, side)).map((item) => item.codePointAt(0) || 0);
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((item) => item.toString(16).padStart(2, "0")).join("");
}

async function resultEvidence(prefix: "native" | "application", value: string): Promise<Partial<SupportTriageState>> {
  const evidence = {
    [`${prefix}ResultLength`]: value.length,
    [`${prefix}ResultSha256`]: await sha256(value),
    [`${prefix}ResultStartJson`]: JSON.stringify(edgeSlice(value, "start")),
    [`${prefix}ResultEndJson`]: JSON.stringify(edgeSlice(value, "end")),
    [`${prefix}LeadingCodePoints`]: edgeCodePoints(value, "start"),
    [`${prefix}TrailingCodePoints`]: edgeCodePoints(value, "end")
  };
  return evidence as Partial<SupportTriageState>;
}

async function displayEvidence(target: HTMLElement): Promise<Partial<SupportTriageState>> {
  const textContent = target.textContent || "";
  const innerText = target.innerText || "";
  return {
    domTextContentLength: textContent.length,
    domInnerTextLength: innerText.length,
    domTrimmedLength: textContent.trim().length,
    domStartJson: JSON.stringify(edgeSlice(textContent, "start")),
    domEndJson: JSON.stringify(edgeSlice(textContent, "end")),
    domLeadingCodePoints: edgeCodePoints(textContent, "start"),
    domTrailingCodePoints: edgeCodePoints(textContent, "end")
  };
}

function selectedMode(): RuntimeMode {
  return runtimeMode?.value === "real" ? "real" : "deterministic";
}

function initialState(mode: RuntimeMode): SupportTriageState {
  const languageModelGlobalPresent = typeof globalWithPromptApi.LanguageModel !== "undefined";
  return {
    runtimeMode: mode,
    runtimeProvenance: mode === "real" ? (languageModelGlobalPresent ? "native" : "missing") : "deterministic",
    chromeVersion: detectChromeVersion(),
    languageModelGlobalPresent,
    modelState: "not-started",
    sessionState: "not-started",
    promptState: "not-started",
    startupQueuedCount: 0,
    startupDroppedCount: 0,
    startupDrainedCount: 0,
    destinationSentCount: 0,
    destinationFailedCount: 0,
    lifecycleFlushCount: 0,
    telemetryCount: observations.length
  };
}

function renderStatus(state = globalWithPromptApi.__supportTriageState): void {
  if (!runtimeStatus || !state) return;
  runtimeStatus.textContent = JSON.stringify(state, null, 2);
}

function setState(update: Partial<SupportTriageState>): SupportTriageState {
  const current = globalWithPromptApi.__supportTriageState || initialState(selectedMode());
  const next = { ...current, ...update, telemetryCount: observations.length };
  globalWithPromptApi.__supportTriageState = next;
  renderStatus(next);
  return next;
}

function renderTelemetry(): void {
  if (!telemetry) return;
  renderTelemetryPanel(telemetry, [
    { label: "latest", value: observations[observations.length - 1] },
    { label: "status", value: controller?.status },
    { label: "runtime", value: globalWithPromptApi.__supportTriageState }
  ]);
}

function updateRunButtonLabel(): void {
  if (!button) return;
  button.textContent = selectedMode() === "real" ? "Run with real Prompt API" : "Run triage";
}

function createController(session: NativePromptSession, availability: AvailabilityState): TelemetryController {
  return observePromptApi({
    session,
    destinations: [
      {
        type: "console",
        write(observation) {
          observations.push(observation);
          setState({
            workerMode: controller?.status.workerMode,
            workerOperational: controller?.status.workerOperational,
            latestTelemetry: observation
          });
          renderTelemetry();
          globalThis.console.log("[support-triage telemetry]", observation);
        }
      }
    ],
    runtime: {
      availability,
      browserFamily: "chromium",
      browserMajor: Number(detectChromeVersion())
    },
    onStatus(status) {
      const current = globalWithPromptApi.__supportTriageState || initialState(selectedMode());
      if (status.type === "worker.starting" || status.type === "worker.ready") {
        setState({ workerStatus: status.type });
      } else if (status.type === "worker.failed" || status.type === "worker.processingFailed") {
        setState({ workerStatus: status.type, workerFailure: errorText(status.error) });
      } else if (status.type === "startupQueue.queued") {
        setState({ startupQueuedCount: status.queuedCount });
      } else if (status.type === "startupQueue.dropped") {
        setState({ startupDroppedCount: status.droppedCount });
      } else if (status.type === "startupQueue.drained") {
        setState({ startupDrainedCount: status.drainedCount, startupQueuedCount: 0 });
      } else if (status.type === "destination.sent") {
        setState({ destinationSentCount: (current.destinationSentCount || 0) + 1 });
      } else if (status.type === "destination.failed") {
        setState({ destinationFailedCount: (current.destinationFailedCount || 0) + 1 });
      } else if (status.type === "lifecycle.flushAttempted") {
        setState({
          lifecycleFlushCount: (current.lifecycleFlushCount || 0) + 1,
          lastLifecycleFlushReason: status.reason,
          lastLifecyclePendingCount: status.pendingCount,
          lastLifecycleKeepalive: status.keepalive
        });
      }
      renderTelemetry();
    }
  });
}

function observeNativePromptResult(session: NativePromptSession): NativePromptSession {
  return {
    get usage() {
      return session.usage;
    },
    async prompt(input: unknown, options?: unknown): Promise<unknown> {
      try {
        const nativeResult = await session.prompt(input, options);
        const nativeText = String(nativeResult);
        setState({
          promptState: "succeeded",
          promptOutputLength: nativeText.length,
          ...(await resultEvidence("native", nativeText))
        });
        return nativeResult;
      } catch (error) {
        setState({ promptState: "failed", promptError: errorText(error) });
        throw error;
      }
    }
  };
}

async function createDeterministicSession(): Promise<{ session: NativePromptSession; availability: AvailabilityState }> {
  setState({
    runtimeMode: "deterministic",
    runtimeProvenance: "deterministic",
    languageModelGlobalPresent: typeof globalWithPromptApi.LanguageModel !== "undefined",
    availability: "available",
    modelState: "ready",
    sessionState: "created",
    promptState: "not-started"
  });
  return { session: fakePromptSession, availability: "available" };
}

async function createRealSession(): Promise<{ session?: NativePromptSession; availability: AvailabilityState; blocked: boolean }> {
  setState(initialState("real"));

  const languageModel = globalWithPromptApi.LanguageModel;
  if (!languageModel) {
    setState({
      runtimeProvenance: "missing",
      availability: "unavailable",
      modelState: "blocked",
      sessionState: "blocked",
      promptState: "blocked"
    });
    return { availability: "unavailable", blocked: true };
  }

  let availability: AvailabilityState;
  try {
    availability = await languageModel.availability(promptApiEnglishOptions);
    setState({ runtimeProvenance: "native", availability });
  } catch (error) {
    setState({
      runtimeProvenance: "native",
      availability: "unknown",
      modelState: "failed",
      sessionState: "failed",
      sessionError: errorText(error),
      promptState: "blocked"
    });
    throw error;
  }

  if (availability === "unavailable") {
    setState({ modelState: "blocked", sessionState: "blocked", promptState: "blocked" });
    return { availability, blocked: true };
  }

  try {
    const progressEvents: { loaded?: number; total?: number }[] = [];
    setState({
      modelState: availability === "available" ? "preparing" : "downloading",
      sessionState: "creating",
      promptState: "not-started",
      userActivationAtCreate: navigator.userActivation?.isActive
    });
    const session = await languageModel.create({
      ...promptApiEnglishOptions,
      monitor(monitorTarget) {
        monitorTarget.addEventListener("downloadprogress", (event) => {
          const progress = event as ProgressEvent;
          progressEvents.push({ loaded: progress.loaded, total: progress.lengthComputable ? progress.total : undefined });
          setState({
            modelState: "downloading",
            downloadProgress: progressEvents
          });
        });
      }
    });
    const finalAvailability = await languageModel.availability(promptApiEnglishOptions).catch(() => undefined);
    setState({
      finalAvailability,
      modelState: "ready",
      sessionState: "created",
      promptState: "not-started",
      downloadProgress: progressEvents
    });
    return { session: observeNativePromptResult(session), availability, blocked: false };
  } catch (error) {
    setState({ modelState: "failed", sessionState: "failed", sessionError: errorText(error), promptState: "blocked" });
    throw error;
  }
}

async function runTriage(): Promise<void> {
  if (!ticket || !result) return;
  const mode = selectedMode();
  result.textContent = "Running";
  observations.length = 0;
  controller = undefined;
  setState(initialState(mode));
  renderTelemetry();

  try {
    const sessionSetup = mode === "real" ? await createRealSession() : await createDeterministicSession();
    if (!sessionSetup.session || sessionSetup.blocked) {
      result.textContent = `Blocked: Prompt API ${sessionSetup.availability}`;
      renderTelemetry();
      return;
    }

    controller = createController(sessionSetup.session, sessionSetup.availability);
    setState({
      workerMode: controller.status.workerMode,
      workerOperational: controller.status.workerOperational,
      promptState: "not-started"
    });

    const triage = await controller.prompt(`Classify this ticket: ${ticket.value}`);
    const applicationText = String(triage);
    result.textContent = applicationText;
    setState({
      promptState: "succeeded",
      modelState: globalWithPromptApi.__supportTriageState?.modelState || "ready",
      promptOutputLength: applicationText.length,
      ...(await resultEvidence("application", applicationText)),
      ...(await displayEvidence(result)),
      workerMode: controller.status.workerMode,
      workerOperational: controller.status.workerOperational
    });
    renderTelemetry();
  } catch (error) {
    result.textContent = errorText(error);
    setState({
      promptState: globalWithPromptApi.__supportTriageState?.sessionState === "created" ? "failed" : "blocked",
      promptError: errorText(error),
      workerMode: controller?.status.workerMode,
      workerOperational: controller?.status.workerOperational
    });
    renderTelemetry();
  }
}

const initialMode = new URLSearchParams(location.search).get("runtime") === "real" ? "real" : "deterministic";
if (runtimeMode) runtimeMode.value = initialMode;
updateRunButtonLabel();
setState(initialState(initialMode));
renderTelemetry();

runtimeMode?.addEventListener("change", () => {
  updateRunButtonLabel();
  setState(initialState(selectedMode()));
  renderTelemetry();
});

button?.addEventListener("click", () => {
  void runTriage();
});
