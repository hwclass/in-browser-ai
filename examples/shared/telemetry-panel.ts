export type TelemetryPanelEntry = {
  label: string;
  value: unknown;
};

export function renderTelemetryEvidence(target: HTMLElement | null, entries: TelemetryPanelEntry[]): void {
  if (!target) return;
  target.textContent = JSON.stringify(entries, null, 2);
}
