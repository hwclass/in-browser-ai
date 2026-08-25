export function selectedCaptureMode(select) {
  if (select?.value === "redacted" || select?.value === "full") return select.value;
  return "metadata";
}

export function captureModeDescription(mode) {
  if (mode === "full") return "Full capture is explicit: prompt and response content may appear in telemetry.";
  if (mode === "redacted") return "Redacted capture exports deterministic placeholders instead of raw content.";
  return "Content stayed local: metadata telemetry excludes prompt and response text.";
}

export function renderTelemetryPanel(target, entries) {
  target.textContent = JSON.stringify(entries, null, 2);
}
