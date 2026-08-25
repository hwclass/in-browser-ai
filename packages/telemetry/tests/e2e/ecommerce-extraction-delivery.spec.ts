import { expect, test } from "@playwright/test";

test("ecommerce-extraction fans out one captured observation to console and OTLP", async ({ page }) => {
  const otlpRequests: { url: string; body: string; headers: Record<string, string> }[] = [];
  await page.route("**/otlp/v1/logs", async (route) => {
    otlpRequests.push({
      url: route.request().url(),
      body: route.request().postData() || "",
      headers: route.request().headers()
    });
    await route.fulfill({ status: 204, body: "" });
  });

  await page.goto("/examples/ecommerce-extraction/");
  await expect(page.getByRole("heading", { name: "Ecommerce Extraction" })).toBeVisible();
  await expect(page.locator("[data-testid='capture-mode']")).toHaveValue("metadata");
  await expect(page.locator("[data-testid='destination-mode']")).toHaveValue("console-otlp");

  await page.getByRole("button", { name: "Extract product details" }).click();
  await expect(page.locator("[data-testid='result']")).toContainText('"sku": "BAG-042"');
  await expect(page.locator("[data-testid='delivery-status']")).toContainText("console: sent");
  await expect(page.locator("[data-testid='delivery-status']")).toContainText("local-otlp: sent");
  await expect(page.locator("[data-testid='telemetry']")).toContainText('"operation": "prompt"');
  await expect(page.locator("[data-testid='telemetry']")).toContainText('"mode": "metadata"');

  expect(otlpRequests).toHaveLength(1);
  const body = otlpRequests[0].body;
  expect(body).toContain("browser_ai.inference");
  expect(body).toContain("prompt");
  expect(body).not.toContain("PRIVATE_PRODUCT_PROMPT");
  expect(body).not.toContain("Leather Weekender");

  const state = await page.evaluate(() => {
    return (window as typeof window & { __ecommerceExtractionState?: Record<string, unknown> }).__ecommerceExtractionState;
  });
  expect(state?.applicationResult).toContain('"sku": "BAG-042"');
  expect(state?.consoleCount).toBe(1);
  expect(state?.otlpSentCount).toBe(1);
});
