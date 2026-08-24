export function renderRuntimeStatus(target, state) {
  if (!target) return;
  target.textContent = JSON.stringify(state, null, 2);
}

export function examplePurpose(text) {
  return text;
}
