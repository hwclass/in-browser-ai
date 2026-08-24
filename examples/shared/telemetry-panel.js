export function renderTelemetryEvidence(target, entries) {
  if (!target) return;
  target.textContent = JSON.stringify(entries, null, 2);
}
