import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const e2eDir = fileURLToPath(new URL("tests/e2e", import.meta.url));
const timeout = Number(process.env.REAL_PROMPT_API_TIMEOUT_MS || 600000);

export default defineConfig({
  testDir: e2eDir,
  testMatch: /.*support-triage-real-prompt-api\.spec\.ts/,
  timeout: timeout + 30000,
  use: {
    headless: false,
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
