import crypto from "node:crypto";
import { kvGet, kvSet } from "./kv.mjs";
import { createDefaultAttendanceMap, monthKeyFromDate } from "../shared/payroll.js";

// Per-contractor in-memory cache (keyed by contractorId)
const cacheMap = new Map();

function storeKey(contractorId) {
  return `store:${contractorId}`;
}

function createSeedAttendance(monthKey, workerId, offset) {
  const attendance = createDefaultAttendanceMap(monthKey, {});

  for (const [day, current] of Object.entries(attendance)) {
    if (current === "WO") continue;
    const n = Number(day);
    if ((n + offset) % 11 === 0) attendance[day] = "A";
    else if ((n + offset) % 7 === 0) attendance[day] = "OT";
    else if ((n + offset) % 5 === 0) attendance[day] = "HD";
    else attendance[day] = "P";
  }

  return attendance;
}

function createSeedData() {
  const monthKey = monthKeyFromDate();
  const siteOneId = crypto.randomUUID();
  const siteTwoId = crypto.randomUUID();

  const workers = [
    { id: crypto.randomUUID(), name: "Ramesh Patel", role: "Fitter", dailyWage: 650, uan: "100123456789", esiNumber: "3112345678", siteId: siteOneId, active: true },
    { id: crypto.randomUUID(), name: "Suresh Yadav", role: "Welder", dailyWage: 750, uan: "100123456790", esiNumber: "3112345679", siteId: siteOneId, active: true },
    { id: crypto.randomUUID(), name: "Mahesh Sharma", role: "Helper", dailyWage: 450, uan: "100123456791", esiNumber: "3112345680", siteId: siteOneId, active: true },
    { id: crypto.randomUUID(), name: "Rajesh Tiwari", role: "Fitter", dailyWage: 650, uan: "100123456792", esiNumber: "3112345681", siteId: siteOneId, active: true },
    { id: crypto.randomUUID(), name: "Dinesh Kumar", role: "Electrician", dailyWage: 700, uan: "100123456793", esiNumber: "3112345682", siteId: siteTwoId, active: true },
    { id: crypto.randomUUID(), name: "Ganesh Rathod", role: "Helper", dailyWage: 450, uan: "100123456794", esiNumber: "3112345683", siteId: siteTwoId, active: true },
  ];

  const attendance = {
    [monthKey]: Object.fromEntries(
      workers.map((w, i) => [w.id, createSeedAttendance(monthKey, w.id, i + 1)]),
    ),
  };

  return {
    company: {
      businessName: "My Labour Contracting",
      ownerName: "",
      phone: "",
      email: "",
      address: "",
      gstin: "",
      clraLicense: "",
      pfRegistration: "",
      esiRegistration: "",
      serviceChargeRate: 10,
      gstRate: 18,
      pfEmployeeRate: 12,
      pfEmployerRate: 12,
      pfCap: 15000,
      esiEmployeeRate: 0.75,
      esiEmployerRate: 3.25,
      esiThreshold: 21000,
      overtimeMultiplier: 2,
    },
    sites: [
      { id: siteOneId, name: "Site One", clientName: "Client One", location: "" },
      { id: siteTwoId, name: "Site Two", clientName: "Client Two", location: "" },
    ],
    workers,
    attendance,
  };
}

async function ensureDb(contractorId) {
  const data = await kvGet(storeKey(contractorId));
  if (data) return data;
  const seed = createSeedData();
  await kvSet(storeKey(contractorId), seed);
  return seed;
}

export async function readDb(contractorId) {
  if (!cacheMap.has(contractorId)) {
    cacheMap.set(contractorId, ensureDb(contractorId));
  }
  const db = await cacheMap.get(contractorId);
  return structuredClone(db);
}

export async function writeDb(contractorId, nextDb) {
  cacheMap.set(contractorId, Promise.resolve(structuredClone(nextDb)));
  await kvSet(storeKey(contractorId), nextDb);
  return structuredClone(nextDb);
}

export async function updateDb(contractorId, mutator) {
  const current = await readDb(contractorId);
  const next = await mutator(current);
  return writeDb(contractorId, next);
}
