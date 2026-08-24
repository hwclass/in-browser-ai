import { observePromptApi } from "../../packages/telemetry/dist/src/public/index.js";
import { captureModeDescription, renderTelemetryPanel, selectedCaptureMode } from "../shared/harness.js";

const documentInput = document.querySelector("#document");
const captureSelect = document.querySelector("#capture-mode");
const button = document.querySelector("#summarize");
const result = document.querySelector("#result");
const telemetry = document.querySelector("#telemetry");
const privacyStatus = document.querySelector("#privacy-status");

const observations = [];
let controller;
const globalWithState = globalThis;

const fakePromptSession = {
  usage: { inputTokens: 27, outputTokens: 8 },
  async prompt() {
    return "CONFIDENTIAL_SUMMARY_SENTINEL: Renewal date and payment terms are the key items.";
  }
};

function setState(update) {
  const current = globalWithState.__privateDocumentSummaryState || {
    captureMode: selectedCaptureMode(captureSelect),
    telemetryCount: observations.length
  };
  const next = { ...current, ...update, telemetryCount: observations.length };
  globalWithState.__privateDocumentSummaryState = next;
  return next;
}

function renderTelemetry() {
  if (!telemetry) return;
  const state = globalWithState.__privateDocumentSummaryState;
  renderTelemetryPanel(telemetry, [
    { label: "latest", value: observations[observations.length - 1] },
    { label: "status", value: controller?.status },
    {
      label: "state",
      value: state
        ? {
            captureMode: state.captureMode,
            workerMode: state.workerMode,
            workerOperational: state.workerOperational,
            telemetryCount: state.telemetryCount
          }
        : state
    }
  ]);
}

function updatePrivacyStatus() {
  const mode = selectedCaptureMode(captureSelect);
  if (privacyStatus) privacyStatus.textContent = captureModeDescription(mode);
  setState({ captureMode: mode });
  return mode;
}

function createController(capture) {
  return observePromptApi({
    capture,
    session: fakePromptSession,
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
          globalThis.console.log("[private-document-summary telemetry]", observation);
        }
      }
    ],
    runtime: {
      availability: "available",
      browserFamily: "chromium"
    }
  });
}

async function runSummary() {
  if (!documentInput || !result) return;
  const capture = updatePrivacyStatus();
  controller = createController(capture);
  const output = await controller.prompt(documentInput.value);
  result.textContent = String(output);
  setState({
    captureMode: capture,
    applicationResult: String(output),
    workerMode: controller.status.workerMode,
    workerOperational: controller.status.workerOperational
  });
  renderTelemetry();
}

captureSelect?.addEventListener("change", () => {
  updatePrivacyStatus();
  renderTelemetry();
});

button?.addEventListener("click", () => {
  void runSummary();
});

updatePrivacyStatus();
renderTelemetry();
