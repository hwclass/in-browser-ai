import { expect, test } from "@playwright/test";

test("private-document-summary presents metadata redacted and full capture evidence", async ({ page }) => {
  await page.goto("/examples/private-document-summary/");

  await expect(page.getByRole("heading", { name: "Private Document Summary" })).toBeVisible();
  await expect(page.locator("[data-testid='example-purpose']")).toContainText("privacy/capture modes");
  await expect(page.locator("[data-testid='capture-mode']")).toHaveValue("metadata");

  await page.getByRole("button", { name: "Summarize" }).click();
  await expect(page.locator("[data-testid='privacy-status']")).toContainText("Content stayed local");
  await expect(page.locator("[data-testid='telemetry']")).toContainText('"mode": "metadata"');
  await expect(page.locator("[data-testid='telemetry']")).not.toContainText("PRIVATE_DOCUMENT_SENTINEL");

  await page.locator("[data-testid='capture-mode']").selectOption("redacted");
  await page.getByRole("button", { name: "Summarize" }).click();
  await expect(page.locator("[data-testid='telemetry']")).toContainText('"mode": "redacted"');
  await expect(page.locator("[data-testid='telemetry']")).toContainText("[redacted");

  await page.locator("[data-testid='capture-mode']").selectOption("full");
  await page.getByRole("button", { name: "Summarize" }).click();
  await expect(page.locator("[data-testid='privacy-status']")).toContainText("Full capture is explicit");
  await expect(page.locator("[data-testid='telemetry']")).toContainText("PRIVATE_DOCUMENT_SENTINEL");
});
