export const DEFAULT_RULES = {
  pfEmployeeRate: 12,
  pfEmployerRate: 12,
  pfCap: 15000,
  esiEmployeeRate: 0.75,
  esiEmployerRate: 3.25,
  esiThreshold: 21000,
  overtimeMultiplier: 2,
  serviceChargeRate: 10,
  gstRate: 18,
};

export const ATTENDANCE_STATUSES = ["P", "A", "HD", "OT", "WO"];

export function parseMonthKey(monthKey) {
  const [yearText, monthText] = String(monthKey || "").split("-");
  const year = Number(yearText);
  const month = Number(monthText);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(`Invalid month key: ${monthKey}`);
  }

  return { year, month };
}

export function monthKeyFromDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function daysInMonth(monthKey) {
  const { year, month } = parseMonthKey(monthKey);
  return new Date(year, month, 0).getDate();
}

export function monthLabel(monthKey, locale = "en-IN") {
  const { year, month } = parseMonthKey(monthKey);
  return new Date(year, month - 1, 1).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });
}

function normalizeStatus(status, fallback) {
  return ATTENDANCE_STATUSES.includes(status) ? status : fallback;
}

export function createDefaultAttendanceMap(monthKey, current = {}) {
  const { year, month } = parseMonthKey(monthKey);
  const totalDays = new Date(year, month, 0).getDate();
  const next = {};

  for (let day = 1; day <= totalDays; day += 1) {
    const dayKey = String(day);
    const existingStatus = current[dayKey] ?? current[day];
    const isSunday = new Date(year, month - 1, day).getDay() === 0;
    next[dayKey] = normalizeStatus(existingStatus, isSunday ? "WO" : "A");
  }

  return next;
}

export function ensureMonthAttendance(monthKey, workers, attendanceByWorker = {}) {
  const next = {};

  for (const worker of workers) {
    next[worker.id] = createDefaultAttendanceMap(monthKey, attendanceByWorker[worker.id] || {});
  }

  return next;
}

function round(value) {
  return Math.round(Number(value) || 0);
}

function normalizeNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function buildRules(company = {}) {
  return {
    pfEmployeeRate: normalizeNumber(company.pfEmployeeRate, DEFAULT_RULES.pfEmployeeRate),
    pfEmployerRate: normalizeNumber(company.pfEmployerRate, DEFAULT_RULES.pfEmployerRate),
    pfCap: normalizeNumber(company.pfCap, DEFAULT_RULES.pfCap),
    esiEmployeeRate: normalizeNumber(company.esiEmployeeRate, DEFAULT_RULES.esiEmployeeRate),
    esiEmployerRate: normalizeNumber(company.esiEmployerRate, DEFAULT_RULES.esiEmployerRate),
    esiThreshold: normalizeNumber(company.esiThreshold, DEFAULT_RULES.esiThreshold),
    overtimeMultiplier: normalizeNumber(company.overtimeMultiplier, DEFAULT_RULES.overtimeMultiplier),
    serviceChargeRate: normalizeNumber(company.serviceChargeRate, DEFAULT_RULES.serviceChargeRate),
    gstRate: normalizeNumber(company.gstRate, DEFAULT_RULES.gstRate),
  };
}

export function calculatePayroll(worker, attendance = {}, monthKey, company = {}) {
  const totalDays = daysInMonth(monthKey);
  const today = new Date();
  const trackedDays = monthKey === monthKeyFromDate(today) ? today.getDate() : totalDays;
  const rules = buildRules(company);
  const wagePerDay = normalizeNumber(worker.dailyWage ?? worker.wage, 0);

  let present = 0;
  let absent = 0;
  let halfDay = 0;
  let overtimeDays = 0;
  let weeklyOff = 0;

  for (let day = 1; day <= trackedDays; day += 1) {
    const status = attendance[String(day)] ?? attendance[day] ?? "A";

    if (status === "P") present += 1;
    else if (status === "A") absent += 1;
    else if (status === "HD") halfDay += 1;
    else if (status === "OT") {
      present += 1;
      overtimeDays += 1;
    } else if (status === "WO") {
      weeklyOff += 1;
    }
  }

  const effectiveDays = present + (halfDay * 0.5);
  const basic = round(effectiveDays * wagePerDay);
  const overtimePay = round(overtimeDays * (wagePerDay / 8) * rules.overtimeMultiplier);
  const gross = basic + overtimePay;
  const pfWage = Math.min(gross, rules.pfCap);
  const pfEmployee = round(pfWage * (rules.pfEmployeeRate / 100));
  const pfEmployer = round(pfWage * (rules.pfEmployerRate / 100));
  const esiEligible = gross <= rules.esiThreshold;
  const esiEmployee = esiEligible ? round(gross * (rules.esiEmployeeRate / 100)) : 0;
  const esiEmployer = esiEligible ? round(gross * (rules.esiEmployerRate / 100)) : 0;
  const net = gross - pfEmployee - esiEmployee;
  const attendanceBase = Math.max(trackedDays - weeklyOff, 1);
  const attendancePercent = round((present / attendanceBase) * 100);

  return {
    present,
    absent,
    halfDay,
    overtimeDays,
    weeklyOff,
    effectiveDays,
    basic,
    overtimePay,
    gross,
    pfWage,
    pfEmployee,
    pfEmployer,
    esiEmployee,
    esiEmployer,
    net,
    attendancePercent,
  };
}

export function calculateMonthModel({ company, sites, workers, attendanceByWorker, monthKey, siteId = "all" }) {
  const rules = buildRules(company);
  const siteMap = new Map(sites.map((site) => [site.id, site]));
  const filteredWorkers = siteId === "all" ? workers : workers.filter((worker) => worker.siteId === siteId);
  const attendance = ensureMonthAttendance(monthKey, filteredWorkers, attendanceByWorker);

  const rows = filteredWorkers.map((worker) => {
    const payroll = calculatePayroll(worker, attendance[worker.id], monthKey, company);
    const site = siteMap.get(worker.siteId);

    return {
      ...worker,
      siteName: site?.name || "Unassigned",
      siteClientName: site?.clientName || "",
      attendance: attendance[worker.id],
      payroll,
    };
  });

  const totals = rows.reduce(
    (acc, row) => {
      acc.gross += row.payroll.gross;
      acc.net += row.payroll.net;
      acc.pfEmployee += row.payroll.pfEmployee;
      acc.pfEmployer += row.payroll.pfEmployer;
      acc.esiEmployee += row.payroll.esiEmployee;
      acc.esiEmployer += row.payroll.esiEmployer;
      acc.present += row.payroll.present;
      acc.absent += row.payroll.absent;
      return acc;
    },
    {
      gross: 0,
      net: 0,
      pfEmployee: 0,
      pfEmployer: 0,
      esiEmployee: 0,
      esiEmployer: 0,
      present: 0,
      absent: 0,
    },
  );

  const serviceCharge = round(totals.gross * (rules.serviceChargeRate / 100));
  const subTotal = totals.gross + totals.pfEmployer + totals.esiEmployer + serviceCharge;
  const gstAmount = round(subTotal * (rules.gstRate / 100));
  const invoiceTotal = subTotal + gstAmount;

  const siteSummaries = sites.map((site) => {
    const siteRows = rows.filter((row) => row.siteId === site.id);
    const siteGross = siteRows.reduce((sum, row) => sum + row.payroll.gross, 0);
    const siteNet = siteRows.reduce((sum, row) => sum + row.payroll.net, 0);

    return {
      ...site,
      workerCount: siteRows.length,
      gross: siteGross,
      net: siteNet,
    };
  });

  return {
    rules,
    rows,
    totals: {
      ...totals,
      serviceCharge,
      subTotal,
      gstAmount,
      invoiceTotal,
    },
    siteSummaries,
  };
}

export function formatCurrency(amount, locale = "en-IN", currency = "INR") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0);
}



