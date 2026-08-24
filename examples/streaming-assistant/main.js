import { observePromptApi } from "../../packages/telemetry/dist/src/public/index.js";
import { renderRuntimeStatus } from "../shared/runtime-status.js";
import { renderTelemetryEvidence } from "../shared/telemetry-panel.js";

const promptInput = document.querySelector("#prompt");
const button = document.querySelector("#run");
const result = document.querySelector("#result");
const telemetry = document.querySelector("#telemetry");
const runtimeMode = document.querySelector("#runtime-mode");
const runtimeStatus = document.querySelector("#runtime-status");

const promptApiEnglishOptions = {
  expectedInputs: [{ type: "text", languages: ["en"] }],
  expectedOutputs: [{ type: "text", languages: ["en"] }]
};

const deterministicChunks = [
  "Start with the billing status, ",
  "acknowledge the damaged delivery, ",
  "then offer a replacement."
];

const fakeStreamingSession = {
  usage: { inputTokens: 11, outputTokens: 13 },
  promptStreaming() {
    return (async function* () {
      for (const chunk of deterministicChunks) {
        await new Promise((resolve) => setTimeout(resolve, 25));
        yield chunk;
      }
    })();
  }
};

const observations = [];
let controller;
const globalWithPromptApi = globalThis;

function detectChromeVersion() {
  const brands = navigator.userAgentData?.brands || [];
  const chromeBrand = brands.find((brand) => /Chrom(e|ium)/i.test(brand.brand));
  if (chromeBrand) return chromeBrand.version;
  return navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)/)?.[2];
}

function selectedMode() {
  return runtimeMode?.value === "real" ? "real" : "deterministic";
}

function errorText(error) {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((item) => item.toString(16).padStart(2, "0")).join("");
}

function initialState(mode) {
  const languageModelGlobalPresent = typeof globalWithPromptApi.LanguageModel !== "undefined";
  return {
    runtimeMode: mode,
    runtimeProvenance: mode === "real" ? (languageModelGlobalPresent ? "native" : "missing") : "deterministic",
    captureMode: "metadata",
    chromeVersion: detectChromeVersion(),
    languageModelGlobalPresent,
    modelState: "not-started",
    sessionState: "not-started",
    streamState: "not-started",
    destinationSentCount: 0,
    destinationFailedCount: 0,
    lifecycleFlushCount: 0,
    telemetryCount: observations.length
  };
}

function renderStatus(state = globalWithPromptApi.__streamingAssistantState) {
  if (!runtimeStatus || !state) return;
  renderRuntimeStatus(runtimeStatus, state);
}

function setState(update) {
  const current = globalWithPromptApi.__streamingAssistantState || initialState(selectedMode());
  const next = { ...current, ...update, telemetryCount: observations.length };
  globalWithPromptApi.__streamingAssistantState = next;
  renderStatus(next);
  return next;
}

function renderTelemetry() {
  if (!telemetry) return;
  renderTelemetryEvidence(telemetry, [
    { label: "latest", value: observations[observations.length - 1] },
    { label: "status", value: controller?.status },
    { label: "runtime", value: globalWithPromptApi.__streamingAssistantState }
  ]);
}

function updateRunButtonLabel() {
  if (!button) return;
  button.textContent = selectedMode() === "real" ? "Run with real Prompt API streaming" : "Run streaming assistant";
}

function createController(session, availability) {
  return observePromptApi({
    capture: "metadata",
    session: {
      async prompt() {
        throw new Error("streaming-assistant uses promptStreaming()");
      },
      promptStreaming: session.promptStreaming.bind(session),
      get usage() {
        return session.usage;
      }
    },
    destinations: [
      {
        type: "console",
        write(observation) {
          observations.push(observation);
          setState({
            workerMode: controller?.status.workerMode,
            workerOperational: controller?.status.workerOperational,
            timeToFirstOutputMs: observation.timeToFirstOutputMs,
            durationMs: observation.durationMs,
            latestTelemetry: observation
          });
          renderTelemetry();
          globalThis.console.log("[streaming-assistant telemetry]", observation);
        }
      }
    ],
    runtime: {
      availability,
      browserFamily: "chromium",
      browserMajor: Number(detectChromeVersion()),
      streamingSupport: "supported"
    },
    onStatus(status) {
      const current = globalWithPromptApi.__streamingAssistantState || initialState(selectedMode());
      if (status.type === "worker.starting" || status.type === "worker.ready") {
        setState({ workerStatus: status.type });
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

async function createDeterministicSession() {
  setState({
    runtimeMode: "deterministic",
    runtimeProvenance: "deterministic",
    languageModelGlobalPresent: typeof globalWithPromptApi.LanguageModel !== "undefined",
    availability: "available",
    modelState: "ready",
    sessionState: "created",
    streamState: "not-started"
  });
  return { session: fakeStreamingSession, availability: "available" };
}

function observeNativeStreamingResult(session) {
  return {
    get usage() {
      return session.usage;
    },
    promptStreaming(input, options) {
      const nativeStream = session.promptStreaming(input, options);
      return observeStreamForNativeEvidence(nativeStream);
    }
  };
}

function observeStreamForNativeEvidence(stream) {
  const chunks = [];
  const record = async () => {
    const text = chunks.join("");
    setState({
      nativeChunkCount: chunks.length,
      nativeResultLength: text.length,
      nativeResultSha256: await sha256(text)
    });
  };

  if (typeof ReadableStream !== "undefined" && stream instanceof ReadableStream) {
    return stream.pipeThrough(new TransformStream({
      transform(chunk, streamController) {
        chunks.push(String(chunk));
        streamController.enqueue(chunk);
      },
      async flush() {
        await record();
      }
    }));
  }

  return {
    async *[Symbol.asyncIterator]() {
      for await (const chunk of stream) {
        chunks.push(String(chunk));
        yield chunk;
      }
      await record();
    }
  };
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
      streamState: "blocked"
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
      streamState: "blocked"
    });
    throw error;
  }

  if (availability === "unavailable") {
    setState({ modelState: "blocked", sessionState: "blocked", streamState: "blocked" });
    return { availability, blocked: true };
  }

  try {
    const progressEvents = [];
    setState({
      modelState: availability === "available" ? "preparing" : "downloading",
      sessionState: "creating",
      streamState: "not-started",
      userActivationAtCreate: navigator.userActivation?.isActive
    });
    const session = await languageModel.create({
      ...promptApiEnglishOptions,
      monitor(monitorTarget) {
        monitorTarget.addEventListener("downloadprogress", (event) => {
          const progress = event;
          progressEvents.push({ loaded: progress.loaded, total: progress.lengthComputable ? progress.total : undefined });
          setState({ modelState: "downloading", downloadProgress: progressEvents });
        });
      }
    });
    const finalAvailability = await languageModel.availability(promptApiEnglishOptions).catch(() => undefined);
    setState({
      finalAvailability,
      modelState: "ready",
      sessionState: "created",
      streamState: "not-started",
      downloadProgress: progressEvents
    });
    return { session: observeNativeStreamingResult(session), availability, blocked: false };
  } catch (error) {
    setState({ modelState: "failed", sessionState: "failed", sessionError: errorText(error), streamState: "blocked" });
    throw error;
  }
}

async function consumeStream(stream) {
  const chunks = [];
  const startedAt = performance.now();
  let firstOutputAt;
  setState({ streamState: "streaming", applicationChunkCount: 0 });

  const appendChunk = (chunk) => {
    const text = String(chunk);
    chunks.push(text);
    if (text.length > 0 && firstOutputAt === undefined) {
      firstOutputAt = performance.now();
      setState({ timeToFirstOutputMs: firstOutputAt - startedAt });
    }
    if (result) result.textContent += text;
    setState({ applicationChunkCount: chunks.length });
  };

  if (typeof ReadableStream !== "undefined" && stream instanceof ReadableStream) {
    const reader = stream.getReader();
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      appendChunk(next.value);
    }
  } else {
    for await (const chunk of stream) {
      appendChunk(chunk);
    }
  }

  const text = chunks.join("");
  setState({
    streamState: "succeeded",
    durationMs: performance.now() - startedAt,
    applicationChunkCount: chunks.length,
    applicationResultLength: text.length,
    applicationResultSha256: await sha256(text)
  });
  return text;
}

async function runStreamingAssistant() {
  if (!promptInput || !result) return;
  const mode = selectedMode();
  result.textContent = "";
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
      streamState: "not-started"
    });

    const stream = controller.promptStreaming(promptInput.value);
    await consumeStream(stream);
    setState({
      workerMode: controller.status.workerMode,
      workerOperational: controller.status.workerOperational
    });
    renderTelemetry();
  } catch (error) {
    result.textContent = errorText(error);
    setState({
      streamState: globalWithPromptApi.__streamingAssistantState?.sessionState === "created" ? "failed" : "blocked",
      streamError: errorText(error),
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
  void runStreamingAssistant();
});
