export type TelemetryPanelEntry = {
  label: string;
  value: unknown;
};

export type ExampleCaptureMode = "metadata" | "redacted" | "full";

export function selectedCaptureMode(select: HTMLSelectElement | null): ExampleCaptureMode {
  if (select?.value === "redacted" || select?.value === "full") return select.value;
  return "metadata";
}

export function captureModeDescription(mode: ExampleCaptureMode): string {
  if (mode === "full") return "Full capture is explicit: prompt and response content may appear in telemetry.";
  if (mode === "redacted") return "Redacted capture exports deterministic placeholders instead of raw content.";
  return "Content stayed local: metadata telemetry excludes prompt and response text.";
}

export function renderTelemetryPanel(target: HTMLElement, entries: TelemetryPanelEntry[]): void {
  target.textContent = JSON.stringify(entries, null, 2);
}
