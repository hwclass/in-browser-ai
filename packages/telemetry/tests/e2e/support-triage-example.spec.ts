import { expect, test } from "@playwright/test";

test("support-triage presents prompt telemetry readiness and diagnostics", async ({ page }) => {
  await page.goto("/examples/support-triage/");

  await expect(page.getByRole("heading", { name: "Support Triage" })).toBeVisible();
  await expect(page.locator("[data-testid='example-purpose']")).toContainText("real browser AI observation");
  await expect(page.locator("[data-testid='runtime-mode']")).toHaveValue("deterministic");

  await page.getByRole("button", { name: "Run triage" }).click();

  await expect(page.locator("[data-testid='result']")).toHaveText("Billing: replacement requested");
  await expect(page.locator("[data-testid='runtime-status']")).toContainText('"runtimeProvenance": "deterministic"');
  await expect(page.locator("[data-testid='runtime-status']")).toContainText('"workerMode": "browser-worker"');
  await expect(page.locator("[data-testid='runtime-status']")).toContainText('"captureMode": "metadata"');
  await expect(page.locator("[data-testid='runtime-status']")).toContainText('"destinationSentCount": 1');
  await expect(page.locator("[data-testid='telemetry']")).toContainText('"operation": "prompt"');
});
