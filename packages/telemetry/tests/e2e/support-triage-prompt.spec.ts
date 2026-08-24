import { expect, test } from "@playwright/test";

test("support-triage exercises the real browser Worker prompt telemetry path", async ({ page }) => {
  await page.addInitScript(() => {
    const OriginalWorker = window.Worker;
    const workerMessages: unknown[] = [];
    (window as typeof window & { __telemetryWorkerMessages?: unknown[] }).__telemetryWorkerMessages = workerMessages;

    class ObservedWorker extends OriginalWorker {
      postMessage(message: unknown, transfer?: Transferable[]): void {
        workerMessages.push(JSON.parse(JSON.stringify(message)));
        super.postMessage(message, transfer as never);
      }
    }

    window.Worker = ObservedWorker as unknown as typeof Worker;
  });

  await page.goto("/examples/support-triage/");
  await expect(page.getByRole("heading", { name: "Support Triage" })).toBeVisible();

  await page.getByRole("button", { name: "Run triage" }).click();
  await expect(page.locator("[data-testid='result']")).toHaveText("Billing: replacement requested");
  await expect(page.locator("[data-testid='telemetry']")).toContainText('"operation": "prompt"');
  await expect(page.locator("[data-testid='telemetry']")).toContainText('"outcome": "success"');
  await expect(page.locator("[data-testid='telemetry']")).toContainText('"workerMode": "browser-worker"');
  await expect(page.locator("[data-testid='telemetry']")).toContainText('"workerOperational": true');

  const telemetryText = await page.locator("[data-testid='telemetry']").innerText();
  expect(telemetryText).not.toContain("Classify this ticket");
  expect(telemetryText).not.toContain("My order arrived damaged");
  expect(telemetryText).not.toContain('"input"');
  expect(telemetryText).not.toContain('"output"');

  const workerMessages = await page.evaluate(() => {
    return (window as typeof window & { __telemetryWorkerMessages?: unknown[] }).__telemetryWorkerMessages || [];
  });

  expect(workerMessages.length).toBeGreaterThan(0);
  expect(workerMessages[0]).toMatchObject({
    protocolVersion: "telemetry.worker.v1",
    type: "observation.prompt",
    payload: {
      operation: "prompt",
      outcome: "success"
    }
  });
  expect(JSON.stringify(workerMessages)).not.toContain("Classify this ticket");
  expect(JSON.stringify(workerMessages)).not.toContain("Billing: replacement requested");
});
