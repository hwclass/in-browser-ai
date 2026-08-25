import { observePromptApi, type CaptureMode, type TelemetryController } from "../../packages/telemetry/src/public/index";
import { captureModeDescription, selectedCaptureMode } from "../shared/harness";
import { renderTelemetryEvidence } from "../shared/telemetry-panel";

type PrivateDocumentState = {
  captureMode: CaptureMode;
  workerMode?: string;
  workerOperational?: boolean;
  applicationResult?: string;
  latestTelemetry?: unknown;
  telemetryCount: number;
};

const documentInput = document.querySelector<HTMLTextAreaElement>("#document");
const captureSelect = document.querySelector<HTMLSelectElement>("#capture-mode");
const button = document.querySelector<HTMLButtonElement>("#summarize");
const result = document.querySelector<HTMLElement>("#result");
const telemetry = document.querySelector<HTMLElement>("#telemetry");
const privacyStatus = document.querySelector<HTMLElement>("#privacy-status");

const observations: unknown[] = [];
let controller: TelemetryController | undefined;

const globalWithState = globalThis as typeof globalThis & {
  __privateDocumentSummaryState?: PrivateDocumentState;
};

const fakePromptSession = {
  usage: { inputTokens: 27, outputTokens: 8 },
  async prompt(): Promise<string> {
    return "CONFIDENTIAL_SUMMARY_SENTINEL: Renewal date and payment terms are the key items.";
  }
};

function setState(update: Partial<PrivateDocumentState>): PrivateDocumentState {
  const current = globalWithState.__privateDocumentSummaryState || {
    captureMode: selectedCaptureMode(captureSelect),
    telemetryCount: observations.length
  };
  const next = { ...current, ...update, telemetryCount: observations.length };
  globalWithState.__privateDocumentSummaryState = next;
  return next;
}

function renderTelemetry(): void {
  if (!telemetry) return;
  const state = globalWithState.__privateDocumentSummaryState;
  renderTelemetryEvidence(telemetry, [
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

function updatePrivacyStatus(): CaptureMode {
  const mode = selectedCaptureMode(captureSelect);
  if (privacyStatus) privacyStatus.textContent = captureModeDescription(mode);
  setState({ captureMode: mode });
  return mode;
}

function createController(capture: CaptureMode): TelemetryController {
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

async function runSummary(): Promise<void> {
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
