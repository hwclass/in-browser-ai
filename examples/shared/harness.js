export function renderTelemetryPanel(target, entries) {
  target.textContent = JSON.stringify(entries, null, 2);
}
