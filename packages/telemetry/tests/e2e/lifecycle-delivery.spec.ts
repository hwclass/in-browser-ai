import { expect, test } from "@playwright/test";

test("support-triage attempts best-effort lifecycle flush on page transition", async ({ page }) => {
  await page.goto("/examples/support-triage/");
  await page.getByRole("button", { name: "Run triage" }).click();
  await expect(page.locator("[data-testid='result']")).toHaveText("Billing: replacement requested");
  await expect(page.locator("[data-testid='telemetry']")).toContainText('"operation": "prompt"');

  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: false }));
  });

  await expect(page.locator("[data-testid='runtime-status']")).toContainText('"lifecycleFlushCount": 1');
  await expect(page.locator("[data-testid='runtime-status']")).toContainText('"lastLifecycleFlushReason": "lifecycle"');
  await expect(page.locator("[data-testid='result']")).toHaveText("Billing: replacement requested");
});
