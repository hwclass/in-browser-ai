export function renderRuntimeStatus(target: HTMLElement | null, state: unknown): void {
  if (!target) return;
  target.textContent = JSON.stringify(state, null, 2);
}

export function examplePurpose(text: string): string {
  return text;
}
