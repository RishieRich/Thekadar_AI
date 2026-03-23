import { createServer } from "node:http";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { createGrokReply } from "./grok.mjs";
import { ATTENDANCE_STATUSES, createDefaultAttendanceMap, ensureMonthAttendance, monthKeyFromDate } from "./shared/payroll.js";
import { readDb, updateDb } from "./server/store.mjs";

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

function json(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  });
  res.end(JSON.stringify(payload));
}

function notFound(res, message = "Not found") {
  json(res, 404, { error: message });
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  if (!chunks.length) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function parseIdFromPath(pathname, resource) {
  return pathname.replace(`/api/${resource}/`, "");
}

function sanitizeText(value) {
  return String(value || "").trim();
}

function sanitizeBoolean(value, fallback = true) {
  if (typeof value === "boolean") {
    return value;
  }

  return fallback;
}

function sanitizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sanitizeCompany(input = {}, current = {}) {
  return {
    businessName: sanitizeText(input.businessName ?? current.businessName),
    ownerName: sanitizeText(input.ownerName ?? current.ownerName),
    phone: sanitizeText(input.phone ?? current.phone),
    email: sanitizeText(input.email ?? current.email),
    address: sanitizeText(input.address ?? current.address),
    gstin: sanitizeText(input.gstin ?? current.gstin),
    clraLicense: sanitizeText(input.clraLicense ?? current.clraLicense),
    pfRegistration: sanitizeText(input.pfRegistration ?? current.pfRegistration),
    esiRegistration: sanitizeText(input.esiRegistration ?? current.esiRegistration),
    serviceChargeRate: sanitizeNumber(input.serviceChargeRate ?? current.serviceChargeRate, 10),
    gstRate: sanitizeNumber(input.gstRate ?? current.gstRate, 18),
    pfEmployeeRate: sanitizeNumber(input.pfEmployeeRate ?? current.pfEmployeeRate, 12),
    pfEmployerRate: sanitizeNumber(input.pfEmployerRate ?? current.pfEmployerRate, 12),
    pfCap: sanitizeNumber(input.pfCap ?? current.pfCap, 15000),
    esiEmployeeRate: sanitizeNumber(input.esiEmployeeRate ?? current.esiEmployeeRate, 0.75),
    esiEmployerRate: sanitizeNumber(input.esiEmployerRate ?? current.esiEmployerRate, 3.25),
    esiThreshold: sanitizeNumber(input.esiThreshold ?? current.esiThreshold, 21000),
    overtimeMultiplier: sanitizeNumber(input.overtimeMultiplier ?? current.overtimeMultiplier, 2),
  };
}

function sanitizeSite(input = {}, current = {}) {
  return {
    id: current.id || input.id || crypto.randomUUID(),
    name: sanitizeText(input.name ?? current.name),
    clientName: sanitizeText(input.clientName ?? current.clientName),
    location: sanitizeText(input.location ?? current.location),
  };
}

function sanitizeWorker(input = {}, current = {}) {
  return {
    id: current.id || input.id || crypto.randomUUID(),
    name: sanitizeText(input.name ?? current.name),
    role: sanitizeText(input.role ?? current.role),
    dailyWage: sanitizeNumber(input.dailyWage ?? current.dailyWage, 0),
    uan: sanitizeText(input.uan ?? current.uan),
    esiNumber: sanitizeText(input.esiNumber ?? current.esiNumber),
    siteId: sanitizeText(input.siteId ?? current.siteId),
    active: sanitizeBoolean(input.active ?? current.active, true),
  };
}

function buildBootstrap(db, monthKey) {
  return {
    month: monthKey,
    company: db.company,
    sites: db.sites,
    workers: db.workers,
    attendance: ensureMonthAttendance(monthKey, db.workers, db.attendance?.[monthKey] || {}),
  };
}

async function serveStatic(req, res, pathname) {
  const normalizedPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(distDir, normalizedPath));

  if (!filePath.startsWith(distDir)) {
    notFound(res);
    return;
  }

  try {
    await access(filePath);
    const buffer = await readFile(filePath);
    const extension = path.extname(filePath);
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[extension] || "application/octet-stream",
    });
    res.end(buffer);
    return;
  } catch {
    try {
      const indexPath = path.join(distDir, "index.html");
      const buffer = await readFile(indexPath);
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(buffer);
    } catch {
      notFound(res, "Build output not found. Run `npm run build` first.");
    }
  }
}

const server = createServer(async (req, res) => {
  const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const { pathname, searchParams } = requestUrl;

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    });
    res.end();
    return;
  }

  try {
    if (pathname === "/api/health" && req.method === "GET") {
      json(res, 200, { ok: true });
      return;
    }

    if (pathname === "/api/bootstrap" && req.method === "GET") {
      const db = await readDb();
      const monthKey = searchParams.get("month") || monthKeyFromDate();
      json(res, 200, buildBootstrap(db, monthKey));
      return;
    }

    if (pathname === "/api/company" && req.method === "PUT") {
      const body = await readJsonBody(req);
      const db = await updateDb((current) => ({
        ...current,
        company: sanitizeCompany(body, current.company),
      }));
      json(res, 200, { company: db.company });
      return;
    }

    if (pathname === "/api/sites" && req.method === "POST") {
      const body = await readJsonBody(req);
      const site = sanitizeSite(body, {});

      if (!site.name) {
        json(res, 400, { error: "Site name is required." });
        return;
      }

      const db = await updateDb((current) => ({
        ...current,
        sites: [...current.sites, site],
      }));
      json(res, 201, { site, sites: db.sites });
      return;
    }

    if (pathname.startsWith("/api/sites/") && req.method === "PUT") {
      const siteId = parseIdFromPath(pathname, "sites");
      const body = await readJsonBody(req);
      const db = await updateDb((current) => {
        const existing = current.sites.find((site) => site.id === siteId);
        if (!existing) {
          throw new Error("Site not found.");
        }

        const updated = sanitizeSite(body, existing);
        return {
          ...current,
          sites: current.sites.map((site) => (site.id === siteId ? updated : site)),
        };
      });

      json(res, 200, { sites: db.sites });
      return;
    }

    if (pathname.startsWith("/api/sites/") && req.method === "DELETE") {
      const siteId = parseIdFromPath(pathname, "sites");
      const db = await readDb();
      const workersUsingSite = db.workers.filter((worker) => worker.siteId === siteId);
      if (workersUsingSite.length) {
        json(res, 409, { error: "Delete or move workers assigned to this site first." });
        return;
      }

      const nextDb = await updateDb((current) => ({
        ...current,
        sites: current.sites.filter((site) => site.id !== siteId),
      }));
      json(res, 200, { sites: nextDb.sites });
      return;
    }

    if (pathname === "/api/workers" && req.method === "POST") {
      const body = await readJsonBody(req);
      const worker = sanitizeWorker(body, {});

      if (!worker.name) {
        json(res, 400, { error: "Worker name is required." });
        return;
      }

      const db = await updateDb((current) => ({
        ...current,
        workers: [...current.workers, worker],
      }));
      json(res, 201, { worker, workers: db.workers });
      return;
    }

    if (pathname.startsWith("/api/workers/") && req.method === "PUT") {
      const workerId = parseIdFromPath(pathname, "workers");
      const body = await readJsonBody(req);
      const db = await updateDb((current) => {
        const existing = current.workers.find((worker) => worker.id === workerId);
        if (!existing) {
          throw new Error("Worker not found.");
        }

        const updated = sanitizeWorker(body, existing);
        return {
          ...current,
          workers: current.workers.map((worker) => (worker.id === workerId ? updated : worker)),
        };
      });

      json(res, 200, { workers: db.workers });
      return;
    }

    if (pathname.startsWith("/api/workers/") && req.method === "DELETE") {
      const workerId = parseIdFromPath(pathname, "workers");
      const db = await updateDb((current) => ({
        ...current,
        workers: current.workers.filter((worker) => worker.id !== workerId),
        attendance: Object.fromEntries(
          Object.entries(current.attendance || {}).map(([monthKey, attendance]) => [
            monthKey,
            Object.fromEntries(
              Object.entries(attendance || {}).filter(([storedWorkerId]) => storedWorkerId !== workerId),
            ),
          ]),
        ),
      }));
      json(res, 200, { workers: db.workers });
      return;
    }

    if (pathname === "/api/attendance" && req.method === "PUT") {
      const body = await readJsonBody(req);
      const monthKey = sanitizeText(body.month) || monthKeyFromDate();
      const workerId = sanitizeText(body.workerId);
      const day = String(Number(body.day));
      const status = sanitizeText(body.status).toUpperCase();

      if (!workerId || !ATTENDANCE_STATUSES.includes(status) || !day || day === "NaN") {
        json(res, 400, { error: "Valid month, workerId, day, and status are required." });
        return;
      }

      const db = await updateDb((current) => {
        const monthAttendance = current.attendance?.[monthKey] || {};
        const workerAttendance = createDefaultAttendanceMap(monthKey, monthAttendance[workerId] || {});
        workerAttendance[day] = status;

        return {
          ...current,
          attendance: {
            ...(current.attendance || {}),
            [monthKey]: {
              ...monthAttendance,
              [workerId]: workerAttendance,
            },
          },
        };
      });

      json(res, 200, { attendance: buildBootstrap(db, monthKey).attendance });
      return;
    }

    if (pathname === "/api/chat" && req.method === "POST") {
      const body = await readJsonBody(req);
      const monthKey = sanitizeText(body.month) || monthKeyFromDate();
      const siteId = sanitizeText(body.siteId) || "all";
      const db = await readDb();
      const attendance = ensureMonthAttendance(monthKey, db.workers, db.attendance?.[monthKey] || {});
      const reply = await createGrokReply({
        messages: body.messages,
        company: db.company,
        sites: db.sites,
        workers: db.workers,
        attendanceByWorker: attendance,
        monthKey,
        siteId,
      });

      json(res, 200, reply);
      return;
    }

    if (!pathname.startsWith("/api/")) {
      await serveStatic(req, res, pathname);
      return;
    }

    notFound(res);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    const statusCode = message.toLowerCase().includes("not found") ? 404 : 500;
    json(res, statusCode, { error: message });
  }
});

server.listen(PORT, () => {
  console.log(`Thekedar AI server running on http://localhost:${PORT}`);
});
