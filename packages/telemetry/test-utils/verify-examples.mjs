import { spawn } from "child_process";

const port = Number(process.env.PORT || 4173);
const baseUrl = `http://127.0.0.1:${port}`;
const requiredRoutes = [
  "/examples/",
  "/examples/support-triage/",
  "/examples/ecommerce-extraction/",
  "/examples/private-document-summary/",
  "/examples/streaming-assistant/"
];

const server = spawn(process.execPath, ["examples/shared/server.mjs"], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"]
});

let serverOutput = "";
server.stdout.on("data", (chunk) => {
  serverOutput += chunk.toString();
});
server.stderr.on("data", (chunk) => {
  serverOutput += chunk.toString();
});

async function waitForServer() {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/examples/`);
      if (response.ok) return;
    } catch {
      // Keep polling until the local server accepts connections.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Example server did not become ready. Output:\n${serverOutput}`);
}

try {
  await waitForServer();
  for (const route of requiredRoutes) {
    const response = await fetch(`${baseUrl}${route}`);
    if (!response.ok) {
      throw new Error(`${route} returned HTTP ${response.status}`);
    }
    const text = await response.text();
    if (!text.includes("<html") && !text.includes("<!doctype html>")) {
      throw new Error(`${route} did not return an HTML page`);
    }
  }
  console.log(`PASS examples served: ${requiredRoutes.join(", ")}`);
} finally {
  server.kill();
}
