import { expect, test } from "@playwright/test";

test("streaming-assistant presents streaming timing runtime and lifecycle diagnostics", async ({ page }) => {
  await page.goto("/examples/streaming-assistant/");

  await expect(page.getByRole("heading", { name: "Streaming Assistant" })).toBeVisible();
  await expect(page.locator("[data-testid='example-purpose']")).toContainText("real streaming + TTFO/duration");
  await expect(page.locator("[data-testid='runtime-mode']")).toHaveValue("deterministic");

  await page.getByRole("button", { name: "Run streaming assistant" }).click();

  await expect(page.locator("[data-testid='result']")).toContainText("Start with the billing status");
  await expect(page.locator("[data-testid='runtime-status']")).toContainText('"timeToFirstOutputMs"');
  await expect(page.locator("[data-testid='runtime-status']")).toContainText('"durationMs"');
  await expect(page.locator("[data-testid='runtime-status']")).toContainText('"workerMode": "browser-worker"');
  await expect(page.locator("[data-testid='runtime-status']")).toContainText('"captureMode": "metadata"');

  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: false }));
  });

  await expect(page.locator("[data-testid='runtime-status']")).toContainText('"lifecycleFlushCount": 1');
  await expect(page.locator("[data-testid='telemetry']")).toContainText('"operation": "promptStreaming"');
});
