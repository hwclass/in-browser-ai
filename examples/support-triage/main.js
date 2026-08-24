import { observePromptApi } from "../../packages/telemetry/dist/src/public/index.js";
import { renderTelemetryPanel } from "../shared/harness.js";

const ticket = document.querySelector("#ticket");
const button = document.querySelector("#triage");
const result = document.querySelector("#result");
const telemetry = document.querySelector("#telemetry");
const runtimeMode = document.querySelector("#runtime-mode");
const runtimeStatus = document.querySelector("#runtime-status");

const fakePromptSession = {
  usage: { inputTokens: 18, outputTokens: 5 },
  async prompt() {
    return "Billing: replacement requested";
  }
};

const observations = [];
let controller;
const globalWithPromptApi = globalThis;
const promptApiEnglishOptions = {
  expectedInputs: [{ type: "text", languages: ["en"] }],
  expectedOutputs: [{ type: "text", languages: ["en"] }]
};

function detectChromeVersion() {
  const brands = navigator.userAgentData?.brands || [];
  const chromeBrand = brands.find((brand) => /Chrom(e|ium)/i.test(brand.brand));
  if (chromeBrand) return chromeBrand.version;
  return navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)/)?.[2];
}

function errorText(error) {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

function edgeSlice(value, side) {
  return side === "start" ? value.slice(0, 24) : value.slice(Math.max(0, value.length - 24));
}

function edgeCodePoints(value, side) {
  return Array.from(edgeSlice(value, side)).map((item) => item.codePointAt(0) || 0);
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((item) => item.toString(16).padStart(2, "0")).join("");
}

async function resultEvidence(prefix, value) {
  return {
    [`${prefix}ResultLength`]: value.length,
    [`${prefix}ResultSha256`]: await sha256(value),
    [`${prefix}ResultStartJson`]: JSON.stringify(edgeSlice(value, "start")),
    [`${prefix}ResultEndJson`]: JSON.stringify(edgeSlice(value, "end")),
    [`${prefix}LeadingCodePoints`]: edgeCodePoints(value, "start"),
    [`${prefix}TrailingCodePoints`]: edgeCodePoints(value, "end")
  };
}

async function displayEvidence(target) {
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

function selectedMode() {
  return runtimeMode?.value === "real" ? "real" : "deterministic";
}

function initialState(mode) {
  const languageModelGlobalPresent = typeof globalWithPromptApi.LanguageModel !== "undefined";
  return {
    runtimeMode: mode,
    runtimeProvenance: mode === "real" ? (languageModelGlobalPresent ? "native" : "missing") : "deterministic",
    chromeVersion: detectChromeVersion(),
    languageModelGlobalPresent,
    modelState: "not-started",
    sessionState: "not-started",
    promptState: "not-started",
    telemetryCount: observations.length
  };
}

function renderStatus(state = globalWithPromptApi.__supportTriageState) {
  if (!runtimeStatus || !state) return;
  runtimeStatus.textContent = JSON.stringify(state, null, 2);
}

function setState(update) {
  const current = globalWithPromptApi.__supportTriageState || initialState(selectedMode());
  const next = { ...current, ...update, telemetryCount: observations.length };
  globalWithPromptApi.__supportTriageState = next;
  renderStatus(next);
  return next;
}

function renderTelemetry() {
  if (!telemetry) return;
  renderTelemetryPanel(telemetry, [
    { label: "latest", value: observations[observations.length - 1] },
    { label: "status", value: controller?.status },
    { label: "runtime", value: globalWithPromptApi.__supportTriageState }
  ]);
}

function updateRunButtonLabel() {
  if (!button) return;
  button.textContent = selectedMode() === "real" ? "Run with real Prompt API" : "Run triage";
}

function createController(session, availability) {
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
          globalThis.console.log("[support-triage telemetry]", observation);
        }
      }
    ],
    runtime: {
      availability,
      browserFamily: "chromium",
      browserMajor: Number(detectChromeVersion())
    }
  });
}

function observeNativePromptResult(session) {
  return {
    get usage() {
      return session.usage;
    },
    async prompt(input, options) {
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

async function createDeterministicSession() {
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

async function createRealSession() {
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

  let availability;
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
    const progressEvents = [];
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
          progressEvents.push({ loaded: event.loaded, total: event.lengthComputable ? event.total : undefined });
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

async function runTriage() {
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
