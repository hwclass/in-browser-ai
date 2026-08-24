import { expect, test } from "@playwright/test";

test("private-document-summary keeps content out of metadata telemetry and requires explicit full capture", async ({ page }) => {
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

  await page.goto("/examples/private-document-summary/");
  await expect(page.getByRole("heading", { name: "Private Document Summary" })).toBeVisible();
  await expect(page.locator("[data-testid='capture-mode']")).toHaveValue("metadata");

  await page.getByRole("button", { name: "Summarize" }).click();
  await expect(page.locator("[data-testid='result']")).toContainText("Renewal date and payment terms");
  await expect(page.locator("[data-testid='privacy-status']")).toContainText("Content stayed local");
  await expect(page.locator("[data-testid='telemetry']")).toContainText('"mode": "metadata"');

  const metadataTelemetry = await page.locator("[data-testid='telemetry']").innerText();
  expect(metadataTelemetry).not.toContain("PRIVATE_DOCUMENT_SENTINEL");
  expect(metadataTelemetry).not.toContain("CONFIDENTIAL_SUMMARY_SENTINEL");
  expect(metadataTelemetry).not.toContain('"input"');
  expect(metadataTelemetry).not.toContain('"output"');

  const metadataWorkerMessages = await page.evaluate(() => {
    return (window as typeof window & { __telemetryWorkerMessages?: unknown[] }).__telemetryWorkerMessages || [];
  });
  expect(metadataWorkerMessages).toHaveLength(1);
  expect(JSON.stringify(metadataWorkerMessages)).not.toContain("PRIVATE_DOCUMENT_SENTINEL");
  expect(JSON.stringify(metadataWorkerMessages)).not.toContain("CONFIDENTIAL_SUMMARY_SENTINEL");

  await page.locator("[data-testid='capture-mode']").selectOption("redacted");
  await page.getByRole("button", { name: "Summarize" }).click();
  await expect(page.locator("[data-testid='telemetry']")).toContainText('"mode": "redacted"');
  const redactedTelemetry = await page.locator("[data-testid='telemetry']").innerText();
  expect(redactedTelemetry).toContain("[redacted");
  expect(redactedTelemetry).not.toContain("PRIVATE_DOCUMENT_SENTINEL");
  expect(redactedTelemetry).not.toContain("CONFIDENTIAL_SUMMARY_SENTINEL");

  await page.locator("[data-testid='capture-mode']").selectOption("full");
  await page.getByRole("button", { name: "Summarize" }).click();
  await expect(page.locator("[data-testid='privacy-status']")).toContainText("Full capture is explicit");
  await expect(page.locator("[data-testid='telemetry']")).toContainText('"mode": "full"');
  await expect(page.locator("[data-testid='telemetry']")).toContainText("PRIVATE_DOCUMENT_SENTINEL");
  await expect(page.locator("[data-testid='telemetry']")).toContainText("CONFIDENTIAL_SUMMARY_SENTINEL");
});
