import { readdir } from "fs/promises";
import { join } from "path";
import { pathToFileURL } from "url";

const suite = process.argv[2];
const roots = {
  unit: "packages/telemetry/tests/unit",
  integration: "packages/telemetry/tests/integration",
  e2e: "packages/telemetry/tests/e2e"
};

if (!roots[suite]) {
  console.error(`Unknown test suite: ${suite}`);
  process.exit(1);
}

const tests = [];

async function collect(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await collect(full);
    } else if (entry.name.endsWith(".test.mjs") || entry.name.endsWith(".spec.mjs")) {
      tests.push(full);
    }
  }
}

await collect(roots[suite]);

let failed = 0;
for (const testFile of tests) {
  try {
    await import(pathToFileURL(testFile).href);
    console.log(`PASS ${testFile}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${testFile}`);
    console.error(error && error.stack ? error.stack : error);
  }
}

console.log(`${tests.length - failed}/${tests.length} ${suite} test files passed`);
if (failed > 0) process.exit(1);
