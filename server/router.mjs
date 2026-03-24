import crypto from "node:crypto";
import { authenticate, verifyRequest } from "./auth.mjs";
import { readDb, updateDb } from "./store.mjs";
import { createGrokReply } from "../grok.mjs";
import {
  ATTENDANCE_STATUSES,
  createDefaultAttendanceMap,
  ensureMonthAttendance,
  monthKeyFromDate,
} from "../shared/payroll.js";

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function json(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  });
  res.end(JSON.stringify(payload));
}

function notFound(res, message = "Not found") {
  json(res, 404, { error: message });
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function parseIdFromPath(pathname, resource) {
  return pathname.replace(`/api/${resource}/`, "");
}

// ---------------------------------------------------------------------------
// Input sanitizers
// ---------------------------------------------------------------------------

function sanitizeText(value) {
  return String(value ?? "").trim();
}

function sanitizeBoolean(value, fallback = true) {
  return typeof value === "boolean" ? value : fallback;
}

function sanitizeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
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

// ---------------------------------------------------------------------------
// Main request handler (exported for both local server and Vercel)
// ---------------------------------------------------------------------------

export async function handleRequest(req, res) {
  const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const { pathname, searchParams } = requestUrl;

  // CORS pre-flight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    });
    res.end();
    return;
  }

  try {
    // -----------------------------------------------------------------------
    // Public routes (no auth required)
    // -----------------------------------------------------------------------

    if (pathname === "/api/health" && req.method === "GET") {
      json(res, 200, { ok: true });
      return;
    }

    if (pathname === "/api/login" && req.method === "POST") {
      const body = await readJsonBody(req);
      const result = authenticate(sanitizeText(body.username), sanitizeText(body.password));
      if (!result) {
        json(res, 401, { error: "Invalid username or password." });
        return;
      }
      json(res, 200, { token: result.token, contractorId: result.id });
      return;
    }

    if (pathname === "/api/logout" && req.method === "POST") {
      json(res, 200, { ok: true });
      return;
    }

    // -----------------------------------------------------------------------
    // Auth guard for all other /api/* routes
    // -----------------------------------------------------------------------

    const claims = verifyRequest(req);
    if (!claims) {
      json(res, 401, { error: "Unauthorized. Please log in." });
      return;
    }
    const contractorId = claims.id;

    // -----------------------------------------------------------------------
    // Protected routes
    // -----------------------------------------------------------------------

    if (pathname === "/api/bootstrap" && req.method === "GET") {
      const db = await readDb(contractorId);
      const monthKey = searchParams.get("month") || monthKeyFromDate();
      json(res, 200, buildBootstrap(db, monthKey));
      return;
    }

    if (pathname === "/api/company" && req.method === "PUT") {
      const body = await readJsonBody(req);
      const db = await updateDb(contractorId, (current) => ({
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
      const db = await updateDb(contractorId, (current) => ({
        ...current,
        sites: [...current.sites, site],
      }));
      json(res, 201, { site, sites: db.sites });
      return;
    }

    if (pathname.startsWith("/api/sites/") && req.method === "PUT") {
      const siteId = parseIdFromPath(pathname, "sites");
      const body = await readJsonBody(req);
      const db = await updateDb(contractorId, (current) => {
        const existing = current.sites.find((s) => s.id === siteId);
        if (!existing) throw new Error("Site not found.");
        return {
          ...current,
          sites: current.sites.map((s) => (s.id === siteId ? sanitizeSite(body, existing) : s)),
        };
      });
      json(res, 200, { sites: db.sites });
      return;
    }

    if (pathname.startsWith("/api/sites/") && req.method === "DELETE") {
      const siteId = parseIdFromPath(pathname, "sites");
      const db = await readDb(contractorId);
      if (db.workers.some((w) => w.siteId === siteId)) {
        json(res, 409, { error: "Delete or move workers assigned to this site first." });
        return;
      }
      const nextDb = await updateDb(contractorId, (current) => ({
        ...current,
        sites: current.sites.filter((s) => s.id !== siteId),
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
      const db = await updateDb(contractorId, (current) => ({
        ...current,
        workers: [...current.workers, worker],
      }));
      json(res, 201, { worker, workers: db.workers });
      return;
    }

    if (pathname.startsWith("/api/workers/") && req.method === "PUT") {
      const workerId = parseIdFromPath(pathname, "workers");
      const body = await readJsonBody(req);
      const db = await updateDb(contractorId, (current) => {
        const existing = current.workers.find((w) => w.id === workerId);
        if (!existing) throw new Error("Worker not found.");
        return {
          ...current,
          workers: current.workers.map((w) =>
            w.id === workerId ? sanitizeWorker(body, existing) : w,
          ),
        };
      });
      json(res, 200, { workers: db.workers });
      return;
    }

    if (pathname.startsWith("/api/workers/") && req.method === "DELETE") {
      const workerId = parseIdFromPath(pathname, "workers");
      const db = await updateDb(contractorId, (current) => ({
        ...current,
        workers: current.workers.filter((w) => w.id !== workerId),
        attendance: Object.fromEntries(
          Object.entries(current.attendance || {}).map(([mk, att]) => [
            mk,
            Object.fromEntries(
              Object.entries(att || {}).filter(([wid]) => wid !== workerId),
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

      const db = await updateDb(contractorId, (current) => {
        const monthAtt = current.attendance?.[monthKey] || {};
        const workerAtt = createDefaultAttendanceMap(monthKey, monthAtt[workerId] || {});
        workerAtt[day] = status;
        return {
          ...current,
          attendance: {
            ...(current.attendance || {}),
            [monthKey]: { ...monthAtt, [workerId]: workerAtt },
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
      const db = await readDb(contractorId);
      const attendance = ensureMonthAttendance(
        monthKey,
        db.workers,
        db.attendance?.[monthKey] || {},
      );
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

    // -----------------------------------------------------------------------
    // Batch import (sites + workers from CSV upload)
    // -----------------------------------------------------------------------

    if (pathname === "/api/import/batch" && req.method === "POST") {
      const body = await readJsonBody(req);
      const incomingSites = Array.isArray(body.sites) ? body.sites : [];
      const incomingWorkers = Array.isArray(body.workers) ? body.workers : [];

      const db = await updateDb(contractorId, (current) => {
        const sites = [...current.sites];
        const siteNameToId = new Map(sites.map((s) => [s.name.toLowerCase(), s.id]));

        // Add new sites (skip duplicates by name)
        for (const s of incomingSites) {
          const name = sanitizeText(s.name);
          if (!name || siteNameToId.has(name.toLowerCase())) continue;
          const site = sanitizeSite(s, {});
          sites.push(site);
          siteNameToId.set(name.toLowerCase(), site.id);
        }

        const workers = [...current.workers];

        // Add new workers (skip if same name already exists on same site)
        const existingKeys = new Set(
          current.workers.map((w) => `${w.name.toLowerCase()}:${w.siteId}`),
        );

        for (const w of incomingWorkers) {
          const name = sanitizeText(w.name);
          if (!name) continue;
          const siteName = sanitizeText(w.siteName || w["Site Name"] || "");
          const siteId = siteNameToId.get(siteName.toLowerCase()) || "";
          const key = `${name.toLowerCase()}:${siteId}`;
          if (existingKeys.has(key)) continue;
          workers.push(sanitizeWorker({ ...w, siteId }, {}));
          existingKeys.add(key);
        }

        return { ...current, sites, workers };
      });

      json(res, 200, {
        imported: {
          sites: db.sites.length,
          workers: db.workers.length,
        },
        sites: db.sites,
        workers: db.workers,
      });
      return;
    }

    notFound(res);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    const statusCode = message.toLowerCase().includes("not found") ? 404 : 500;
    json(res, statusCode, { error: message });
  }
}
