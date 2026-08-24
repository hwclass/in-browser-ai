import { createServer } from "http";
import { readFile } from "fs/promises";
import { extname, join, normalize } from "path";

const root = process.cwd();
const port = Number(process.env.PORT || 4173);
const types = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"]
]);

createServer(async (request, response) => {
  const rawPath = new URL(request.url || "/", `http://127.0.0.1:${port}`).pathname;
  if (request.method === "POST" && rawPath === "/otlp/v1/logs") {
    request.resume();
    response.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type"
    });
    response.end();
    return;
  }
  if (request.method === "OPTIONS" && rawPath === "/otlp/v1/logs") {
    response.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type"
    });
    response.end();
    return;
  }
  let filePath = rawPath === "/" ? "/examples/index.html" : rawPath;
  if (filePath.endsWith("/")) filePath += "index.html";
  const absolute = normalize(join(root, filePath));
  if (!absolute.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }
  try {
    const body = await readFile(absolute);
    response.writeHead(200, { "content-type": types.get(extname(absolute)) || "application/octet-stream" });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`Examples listening at http://127.0.0.1:${port}/examples/`);
});
