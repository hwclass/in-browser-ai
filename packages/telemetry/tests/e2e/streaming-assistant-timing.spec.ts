import { expect, test } from "@playwright/test";

test("streaming-assistant exercises deterministic streaming telemetry timing", async ({ page }) => {
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

  await page.goto("/examples/streaming-assistant/");
  await expect(page.getByRole("heading", { name: "Streaming Assistant" })).toBeVisible();
  await expect(page.locator("[data-testid='runtime-mode']")).toHaveValue("deterministic");

  await page.getByRole("button", { name: "Run streaming assistant" }).click();
  await expect(page.locator("[data-testid='result']")).toContainText("Start with the billing status");
  await expect(page.locator("[data-testid='result']")).toContainText("then offer a replacement.");
  await expect(page.locator("[data-testid='telemetry']")).toContainText('"operation": "promptStreaming"');
  await expect(page.locator("[data-testid='telemetry']")).toContainText('"outcome": "success"');
  await expect(page.locator("[data-testid='telemetry']")).toContainText('"timeToFirstOutputMs"');
  await expect(page.locator("[data-testid='telemetry']")).toContainText('"stream"');
  await expect(page.locator("[data-testid='telemetry']")).toContainText('"workerMode": "browser-worker"');
  await expect(page.locator("[data-testid='telemetry']")).toContainText('"workerOperational": true');

  const state = await page.evaluate(() => {
    return (window as typeof window & { __streamingAssistantState?: Record<string, unknown> }).__streamingAssistantState;
  });
  expect(state?.streamState).toBe("succeeded");
  expect(state?.applicationChunkCount).toBe(3);
  expect(Number(state?.timeToFirstOutputMs)).toBeGreaterThan(0);
  expect(Number(state?.durationMs)).toBeGreaterThanOrEqual(Number(state?.timeToFirstOutputMs));

  const workerMessages = await page.evaluate(() => {
    return (window as typeof window & { __telemetryWorkerMessages?: unknown[] }).__telemetryWorkerMessages || [];
  });
  const observationMessages = workerMessages.filter((message) => {
    return (message as { type?: unknown }).type === "observation.promptStreaming";
  });
  expect(observationMessages).toHaveLength(1);
  expect(observationMessages[0]).toMatchObject({
    protocolVersion: "telemetry.worker.v1",
    type: "observation.promptStreaming",
    payload: {
      operation: "promptStreaming",
      outcome: "success",
      stream: {
        outputCount: 3,
        producedOutput: true
      }
    }
  });

  const serializedWorkerMessages = JSON.stringify(workerMessages);
  expect(serializedWorkerMessages).not.toContain("Start with the billing status");
  expect(serializedWorkerMessages).not.toContain("then offer a replacement.");
});
