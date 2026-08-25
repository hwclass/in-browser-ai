import { observePromptApi, type CaptureMode, type DestinationConfig, type TelemetryController } from "../../packages/telemetry/src/public/index";
import { selectedCaptureMode } from "../shared/harness";
import { renderTelemetryEvidence } from "../shared/telemetry-panel";

type DestinationMode = "console" | "otlp" | "console-otlp";

type EcommerceExtractionState = {
  captureMode: CaptureMode;
  destinationMode: DestinationMode;
  applicationResult?: string;
  latestTelemetry?: unknown;
  sharedObservationId?: string;
  consoleCount: number;
  otlpSentCount: number;
  deliveryStatus: Record<string, string>;
  workerMode?: string;
  workerOperational?: boolean;
};

const listing = document.querySelector<HTMLTextAreaElement>("#listing");
const captureMode = document.querySelector<HTMLSelectElement>("#capture-mode");
const destinationMode = document.querySelector<HTMLSelectElement>("#destination-mode");
const button = document.querySelector<HTMLButtonElement>("#extract");
const result = document.querySelector<HTMLElement>("#result");
const telemetry = document.querySelector<HTMLElement>("#telemetry");
const deliveryStatus = document.querySelector<HTMLElement>("#delivery-status");

const observations: unknown[] = [];
let controller: TelemetryController | undefined;

const globalWithState = globalThis as typeof globalThis & {
  __ecommerceExtractionState?: EcommerceExtractionState;
};

const fakeSession = {
  usage: { inputTokens: 19, outputTokens: 21 },
  async prompt(): Promise<string> {
    return JSON.stringify({
      sku: "BAG-042",
      title: "Leather Weekender",
      price: 189,
      color: "forest green",
      stock: 12
    }, null, 2);
  }
};

function selectedDestinationMode(): DestinationMode {
  if (destinationMode?.value === "console" || destinationMode?.value === "otlp") return destinationMode.value;
  return "console-otlp";
}

function setState(update: Partial<EcommerceExtractionState>): EcommerceExtractionState {
  const current = globalWithState.__ecommerceExtractionState || {
    captureMode: selectedCaptureMode(captureMode),
    destinationMode: selectedDestinationMode(),
    consoleCount: 0,
    otlpSentCount: 0,
    deliveryStatus: {}
  };
  const next = { ...current, ...update };
  globalWithState.__ecommerceExtractionState = next;
  renderDeliveryStatus(next);
  return next;
}

function renderDeliveryStatus(state = globalWithState.__ecommerceExtractionState): void {
  if (!deliveryStatus || !state) return;
  const entries = Object.entries(state.deliveryStatus);
  deliveryStatus.textContent = entries.length > 0
    ? entries.map(([id, status]) => `${id}: ${status}`).join("\n")
    : "Waiting";
}

function renderTelemetry(): void {
  if (!telemetry) return;
  const state = globalWithState.__ecommerceExtractionState;
  renderTelemetryEvidence(telemetry, [
    { label: "latest", value: observations[observations.length - 1] },
    { label: "status", value: controller?.status },
    {
      label: "delivery",
      value: state
        ? {
            captureMode: state.captureMode,
            destinationMode: state.destinationMode,
            consoleCount: state.consoleCount,
            otlpSentCount: state.otlpSentCount,
            sharedObservationId: state.sharedObservationId,
            deliveryStatus: state.deliveryStatus,
            workerMode: state.workerMode,
            workerOperational: state.workerOperational
          }
        : state
    }
  ]);
}

function destinationsFor(mode: DestinationMode): DestinationConfig[] {
  const destinations: DestinationConfig[] = [];
  if (mode === "console" || mode === "console-otlp") {
    destinations.push({
      type: "console",
      id: "console",
      write(observation) {
        observations.push(observation);
        const state = globalWithState.__ecommerceExtractionState;
        setState({
          latestTelemetry: observation,
          sharedObservationId: observation.observationId,
          consoleCount: (state?.consoleCount || 0) + 1
        });
        renderTelemetry();
      }
    });
  }
  if (mode === "otlp" || mode === "console-otlp") {
    destinations.push({
      type: "otlp",
      id: "local-otlp",
      endpoint: "/otlp/v1/logs"
    });
  }
  return destinations;
}

async function runExtraction(): Promise<void> {
  if (!listing || !result) return;
  observations.length = 0;
  const activeCapture = selectedCaptureMode(captureMode);
  const activeDestinations = selectedDestinationMode();
  setState({
    captureMode: activeCapture,
    destinationMode: activeDestinations,
    applicationResult: undefined,
    latestTelemetry: undefined,
    consoleCount: 0,
    otlpSentCount: 0,
    deliveryStatus: {}
  });
  renderTelemetry();

  controller = observePromptApi({
    capture: activeCapture,
    session: fakeSession,
    destinations: destinationsFor(activeDestinations),
    runtime: { availability: "available", browserFamily: "chromium" },
    onStatus(status) {
    if (status.type === "destination.sent" || status.type === "destination.failed") {
      const current = globalWithState.__ecommerceExtractionState;
      setState({
        sharedObservationId: status.observationId,
        otlpSentCount: status.type === "destination.sent" && status.destinationId === "local-otlp"
            ? (current?.otlpSentCount || 0) + 1
            : (current?.otlpSentCount || 0),
          deliveryStatus: {
            ...(current?.deliveryStatus || {}),
            [status.destinationId]: status.type === "destination.sent" ? "sent" : "failed"
          }
        });
        renderTelemetry();
      }
    }
  });

  const output = await controller.prompt(listing.value);
  result.textContent = String(output);
  setState({
    applicationResult: String(output),
    workerMode: controller.status.workerMode,
    workerOperational: controller.status.workerOperational
  });
  renderTelemetry();
}

button?.addEventListener("click", () => {
  void runExtraction();
});

captureMode?.addEventListener("change", () => {
  setState({ captureMode: selectedCaptureMode(captureMode) });
  renderTelemetry();
});

destinationMode?.addEventListener("change", () => {
  setState({ destinationMode: selectedDestinationMode() });
  renderTelemetry();
});

setState({
  captureMode: selectedCaptureMode(captureMode),
  destinationMode: selectedDestinationMode(),
  consoleCount: 0,
  otlpSentCount: 0,
  deliveryStatus: {}
});
renderTelemetry();
