import { expect, test } from "@playwright/test";

test("examples index provides a screen-recordable path through all required examples", async ({ page }) => {
  await page.goto("/examples/");

  await expect(page.getByRole("heading", { name: "in-browser-ai Telemetry Examples" })).toBeVisible();

  const examples = [
    ["Support Triage", "support-triage/"],
    ["Streaming Assistant", "streaming-assistant/"],
    ["Private Document Summary", "private-document-summary/"],
    ["Ecommerce Extraction", "ecommerce-extraction/"]
  ] as const;

  for (const [label, href] of examples) {
    const link = page.getByRole("link", { name: label });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", new RegExp(`${href}$`));
  }

  await expect(page.locator("[data-testid='demo-path']")).toContainText("real browser AI can be observed");
  await expect(page.locator("[data-testid='demo-path']")).toContainText("streaming can be observed without breaking the stream");
  await expect(page.locator("[data-testid='demo-path']")).toContainText("developers control content capture");
  await expect(page.locator("[data-testid='demo-path']")).toContainText("telemetry can fan out");
  await expect(page.locator("[data-testid='demo-path']")).toContainText("failures and lifecycle attempts do not break inference");
  await expect(page.locator("[data-testid='demo-path']")).toContainText("runtime characteristics are inspectable");
});
