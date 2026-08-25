import { expect, test } from "@playwright/test";

test("ecommerce-extraction presents app result and console plus OTLP fanout evidence", async ({ page }) => {
  await page.route("**/otlp/v1/logs", async (route) => {
    await route.fulfill({ status: 204, body: "" });
  });

  await page.goto("/examples/ecommerce-extraction/");

  await expect(page.getByRole("heading", { name: "Ecommerce Extraction" })).toBeVisible();
  await expect(page.locator("[data-testid='example-purpose']")).toContainText("console/OTLP fanout");
  await expect(page.locator("[data-testid='capture-mode']")).toHaveValue("metadata");
  await expect(page.locator("[data-testid='destination-mode']")).toHaveValue("console-otlp");

  await page.getByRole("button", { name: "Extract product details" }).click();

  await expect(page.locator("[data-testid='result']")).toContainText('"sku": "BAG-042"');
  await expect(page.locator("[data-testid='delivery-status']")).toContainText("console: sent");
  await expect(page.locator("[data-testid='delivery-status']")).toContainText("local-otlp: sent");
  await expect(page.locator("[data-testid='telemetry']")).toContainText('"sharedObservationId"');
  await expect(page.locator("[data-testid='telemetry']")).toContainText('"workerMode": "browser-worker"');
});
