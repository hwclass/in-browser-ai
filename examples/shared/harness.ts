export type TelemetryPanelEntry = {
  label: string;
  value: unknown;
};

export function renderTelemetryPanel(target: HTMLElement, entries: TelemetryPanelEntry[]): void {
  target.textContent = JSON.stringify(entries, null, 2);
}
