import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const e2eDir = fileURLToPath(new URL("tests/e2e", import.meta.url));

export default defineConfig({
  testDir: e2eDir,
  testMatch: /.*\.spec\.ts/,
  testIgnore: /.*real-prompt-api\.spec\.ts/,
  use: {
    ...devices["Desktop Chrome"],
    channel: "chrome",
    headless: true,
    baseURL: "http://127.0.0.1:4173"
  },
  webServer: {
    command: "npm run examples",
    cwd: repoRoot,
    url: "http://127.0.0.1:4173/examples/support-triage/",
    reuseExistingServer: false,
    timeout: 15000
  }
});
