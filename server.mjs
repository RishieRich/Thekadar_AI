import { createServer } from "node:http";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleRequest } from "./server/router.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, "dist");
const PORT = Number(process.env.PORT || 8787);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
};

async function serveStatic(req, res, pathname) {
  const normalizedPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(distDir, normalizedPath));

  if (!filePath.startsWith(distDir)) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  try {
    await access(filePath);
    const buffer = await readFile(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
    res.end(buffer);
  } catch {
    try {
      const indexPath = path.join(distDir, "index.html");
      const buffer = await readFile(indexPath);
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(buffer);
    } catch {
      res.writeHead(404);
      res.end("Build output not found. Run `npm run build` first.");
    }
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (url.pathname.startsWith("/api/") || url.pathname === "/api") {
    await handleRequest(req, res);
  } else {
    await serveStatic(req, res, url.pathname);
  }
});

server.listen(PORT, () => {
  console.log(`Thekedar AI server running on http://localhost:${PORT}`);
});
