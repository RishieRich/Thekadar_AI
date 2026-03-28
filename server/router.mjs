import crypto from "node:crypto";
import { authenticate, authenticateByPin, verifyRequest } from "./auth.mjs";
import { readDb, updateDb } from "./store.mjs";
import { createGrokReply } from "../grok.mjs";
import {
  ATTENDANCE_STATUSES,
  calculateMonthModel,
  createDefaultAttendanceMap,
  ensureMonthAttendance,
  monthKeyFromDate,
  monthLabel,
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
      let result;
      if (body.pin !== undefined) {
        result = authenticateByPin(sanitizeText(body.pin));
        if (!result) {
          json(res, 401, { error: "Galat PIN — dobara try karo" });
          return;
        }
      } else {
        result = authenticate(sanitizeText(body.username), sanitizeText(body.password));
        if (!result) {
          json(res, 401, { error: "Invalid username or password." });
          return;
        }
      }
      json(res, 200, { token: result.token, contractorId: result.id, label: result.label });
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

    // -----------------------------------------------------------------------
    // Excel wage export
    // -----------------------------------------------------------------------

    if (pathname === "/api/export/wages" && req.method === "GET") {
      const monthKey = searchParams.get("month") || monthKeyFromDate();
      const db = await readDb(contractorId);
      const attendance = ensureMonthAttendance(monthKey, db.workers, db.attendance?.[monthKey] || {});
      const model = calculateMonthModel({ company: db.company, sites: db.sites, workers: db.workers, attendanceByWorker: attendance, monthKey, siteId: "all" });

      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();

      // Sheet 1: Wage Sheet
      const ws1 = wb.addWorksheet("Wage Sheet");
      ws1.columns = [
        { header: "Worker Name", key: "name", width: 20 },
        { header: "Role", key: "role", width: 15 },
        { header: "Site", key: "site", width: 20 },
        { header: "Present", key: "present", width: 10 },
        { header: "Absent", key: "absent", width: 10 },
        { header: "HD", key: "hd", width: 8 },
        { header: "OT Days", key: "ot", width: 10 },
        { header: "Daily Wage", key: "dailyWage", width: 12 },
        { header: "Basic", key: "basic", width: 14 },
        { header: "OT Pay", key: "otPay", width: 14 },
        { header: "Gross", key: "gross", width: 14 },
        { header: "PF Employee", key: "pfEmp", width: 14 },
        { header: "ESI Employee", key: "esiEmp", width: 14 },
        { header: "Net Pay", key: "net", width: 14 },
        { header: "UAN", key: "uan", width: 18 },
        { header: "ESI Number", key: "esiNo", width: 18 },
      ];
      ws1.getRow(1).font = { bold: true };
      ws1.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF132537" } };

      for (const row of model.rows) {
        ws1.addRow({
          name: row.name, role: row.role, site: row.siteName,
          present: row.payroll.present, absent: row.payroll.absent,
          hd: row.payroll.halfDay, ot: row.payroll.overtimeDays,
          dailyWage: row.dailyWage,
          basic: row.payroll.basic, otPay: row.payroll.overtimePay,
          gross: row.payroll.gross, pfEmp: row.payroll.pfEmployee,
          esiEmp: row.payroll.esiEmployee, net: row.payroll.net,
          uan: row.uan || "", esiNo: row.esiNumber || "",
        });
      }
      ws1.addRow({
        name: "TOTAL", role: "", site: "",
        present: model.totals.present, absent: model.totals.absent, hd: "", ot: "",
        dailyWage: "", basic: model.totals.basic, otPay: "",
        gross: model.totals.gross, pfEmp: model.totals.pfEmployee,
        esiEmp: model.totals.esiEmployee, net: model.totals.net, uan: "", esiNo: "",
      });
      ws1.lastRow.font = { bold: true };

      // Sheet 2: PF Summary
      const ws2 = wb.addWorksheet("PF Summary");
      ws2.columns = [
        { header: "Worker Name", key: "name", width: 20 },
        { header: "UAN", key: "uan", width: 18 },
        { header: "PF Wages", key: "pfWages", width: 14 },
        { header: "Employee 12%", key: "empPf", width: 14 },
        { header: "Employer 12%", key: "emptrPf", width: 14 },
        { header: "Total PF", key: "total", width: 14 },
      ];
      ws2.getRow(1).font = { bold: true };
      for (const row of model.rows) {
        const pfWages = Math.min(row.payroll.gross, db.company.pfCap || 15000);
        ws2.addRow({ name: row.name, uan: row.uan || "", pfWages, empPf: row.payroll.pfEmployee, emptrPf: row.payroll.pfEmployer, total: row.payroll.pfEmployee + row.payroll.pfEmployer });
      }

      // Sheet 3: ESI Summary
      const ws3 = wb.addWorksheet("ESI Summary");
      ws3.columns = [
        { header: "Worker Name", key: "name", width: 20 },
        { header: "ESI Number", key: "esiNo", width: 18 },
        { header: "Gross Wages", key: "gross", width: 14 },
        { header: "Eligible", key: "eligible", width: 10 },
        { header: "Employee 0.75%", key: "empEsi", width: 15 },
        { header: "Employer 3.25%", key: "emptrEsi", width: 15 },
        { header: "Total ESI", key: "total", width: 14 },
      ];
      ws3.getRow(1).font = { bold: true };
      const esiThreshold = db.company.esiThreshold || 21000;
      for (const row of model.rows) {
        const eligible = row.payroll.gross <= esiThreshold;
        ws3.addRow({ name: row.name, esiNo: row.esiNumber || "", gross: row.payroll.gross, eligible: eligible ? "Yes" : "No", empEsi: row.payroll.esiEmployee, emptrEsi: row.payroll.esiEmployer, total: row.payroll.esiEmployee + row.payroll.esiEmployer });
      }

      const compName = (db.company.businessName || "Company").replace(/\s+/g, "_");
      const [yr, mo] = monthKey.split("-");
      const filename = `Wages_${compName}_${mo}_${yr}.xlsx`;

      res.writeHead(200, {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Access-Control-Allow-Origin": "*",
      });
      await wb.xlsx.write(res);
      res.end();
      return;
    }

    // -----------------------------------------------------------------------
    // PDF invoice export
    // -----------------------------------------------------------------------

    if (pathname === "/api/export/invoice" && req.method === "GET") {
      const monthKey = searchParams.get("month") || monthKeyFromDate();
      const siteId = searchParams.get("siteId") || "all";
      const db = await readDb(contractorId);
      const attendance = ensureMonthAttendance(monthKey, db.workers, db.attendance?.[monthKey] || {});
      const model = calculateMonthModel({ company: db.company, sites: db.sites, workers: db.workers, attendanceByWorker: attendance, monthKey, siteId });

      const PDFDocument = (await import("pdfkit")).default;
      const doc = new PDFDocument({ margin: 50, size: "A4" });

      const compName = (db.company.businessName || "Company").replace(/\s+/g, "_");
      const [yr, mo] = monthKey.split("-");
      const filename = `Invoice_${compName}_${mo}_${yr}.pdf`;

      res.writeHead(200, {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Access-Control-Allow-Origin": "*",
      });
      doc.pipe(res);

      // Header
      doc.fontSize(20).font("Helvetica-Bold").text(db.company.businessName || "Labour Contractor", { align: "center" });
      doc.fontSize(10).font("Helvetica").text(db.company.address || "", { align: "center" });
      doc.text(`GSTIN: ${db.company.gstin || "N/A"} | PF: ${db.company.pfRegistration || "N/A"} | ESI: ${db.company.esiRegistration || "N/A"}`, { align: "center" });
      doc.moveDown();
      doc.fontSize(14).font("Helvetica-Bold").text("TAX INVOICE", { align: "center" });
      doc.moveDown(0.5);

      // Invoice details
      const selectedSite = siteId !== "all" ? db.sites.find((s) => s.id === siteId) : null;
      const initials = (db.company.businessName || "CO").split(" ").map((w) => w[0]).join("");
      const invNum = `INV/${initials}/${mo}/${yr}/001`;
      doc.fontSize(10).font("Helvetica");
      doc.text(`Invoice No: ${invNum}`);
      doc.text(`Date: ${new Date().toLocaleDateString("en-IN")}`);
      doc.text(`Period: ${monthLabel(monthKey)}`);
      doc.moveDown();

      // Bill To
      doc.font("Helvetica-Bold").text("Bill To:");
      doc.font("Helvetica").text(selectedSite?.clientName || "All Clients");
      doc.text(selectedSite?.location || "");
      doc.moveDown();

      // Line items
      doc.font("Helvetica-Bold").text("Line Items:");
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.3);
      doc.font("Helvetica");

      function lineItem(label, amount) {
        const amtStr = `Rs. ${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
        const yPos = doc.y;
        doc.text(label, 50, yPos, { continued: false, width: 350 });
        doc.text(amtStr, 400, yPos, { align: "right", width: 145 });
      }

      lineItem("Gross Wages", model.totals.gross);
      lineItem(`PF Employer Contribution (${model.rules.pfEmployerRate}%)`, model.totals.pfEmployer);
      lineItem(`ESI Employer Contribution (${model.rules.esiEmployerRate}%)`, model.totals.esiEmployer);
      lineItem(`Service Charge (${model.rules.serviceChargeRate}%)`, model.totals.serviceCharge);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.3);
      lineItem("Sub-total", model.totals.subTotal);
      lineItem(`CGST (${model.rules.gstRate / 2}%)`, model.totals.gstAmount / 2);
      lineItem(`SGST (${model.rules.gstRate / 2}%)`, model.totals.gstAmount / 2);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.3);
      doc.font("Helvetica-Bold");
      lineItem("GRAND TOTAL", model.totals.invoiceTotal);
      doc.moveDown();

      doc.font("Helvetica").fontSize(9).fillColor("gray").text("Attached: Muster Roll, PF ECR Copy, ESI Challan, Salary Sheet");

      doc.end();
      return;
    }

    notFound(res);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    const statusCode = message.toLowerCase().includes("not found") ? 404 : 500;
    json(res, statusCode, { error: message });
  }
}
