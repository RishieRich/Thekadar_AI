import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { createDefaultAttendanceMap, monthKeyFromDate } from "../shared/payroll.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, "..", "data");
const dbPath = path.join(dataDir, "store.json");

function createSeedAttendance(monthKey, workerId, offset) {
  const attendance = createDefaultAttendanceMap(monthKey, {});

  for (const [day, current] of Object.entries(attendance)) {
    if (current === "WO") {
      continue;
    }

    const numericDay = Number(day);
    if ((numericDay + offset) % 11 === 0) attendance[day] = "A";
    else if ((numericDay + offset) % 7 === 0) attendance[day] = "OT";
    else if ((numericDay + offset) % 5 === 0) attendance[day] = "HD";
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
      workers.map((worker, index) => [worker.id, createSeedAttendance(monthKey, worker.id, index + 1)]),
    ),
  };

  return {
    company: {
      businessName: "Thekedar AI Contractors",
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
      { id: siteOneId, name: "Tema India", clientName: "Tema India", location: "Achhad, Talasari" },
      { id: siteTwoId, name: "Sudhir Brothers", clientName: "Sudhir Brothers", location: "Achhad, Talasari" },
    ],
    workers,
    attendance,
  };
}

async function ensureDb() {
  await mkdir(dataDir, { recursive: true });

  try {
    const raw = await readFile(dbPath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }

    const seed = createSeedData();
    await writeFile(dbPath, JSON.stringify(seed, null, 2));
    return seed;
  }
}

let cachePromise = null;

export async function readDb() {
  if (!cachePromise) {
    cachePromise = ensureDb();
  }

  const db = await cachePromise;
  return structuredClone(db);
}

export async function writeDb(nextDb) {
  cachePromise = Promise.resolve(structuredClone(nextDb));
  await mkdir(dataDir, { recursive: true });
  await writeFile(dbPath, JSON.stringify(nextDb, null, 2));
  return structuredClone(nextDb);
}

export async function updateDb(mutator) {
  const current = await readDb();
  const next = await mutator(current);
  return writeDb(next);
}
