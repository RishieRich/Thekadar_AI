import { calculateMonthModel, daysInMonth, monthKeyFromDate, monthLabel } from "../shared/payroll.js";

const GROQ_BASE_URL = process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1";
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

function fmt(n) {
  return "Rs. " + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

/**
 * Build a rich context object for the AI.
 * Includes today's snapshot, per-worker attendance for every day logged so far,
 * monthly payroll totals, and all calculation rules.
 */
function buildContext({ company, sites, workers, attendanceByWorker, monthKey, siteId }) {
  const today = new Date();
  const currentMonthKey = monthKeyFromDate(today);
  const isCurrentMonth = monthKey === currentMonthKey;
  const todayDay = today.getDate();
  const todayDayKey = String(todayDay);
  const totalDaysInMonth = daysInMonth(monthKey);
  const daysSoFar = isCurrentMonth ? todayDay : totalDaysInMonth;

  const monthModel = calculateMonthModel({
    company,
    sites,
    workers,
    attendanceByWorker,
    monthKey,
    siteId,
  });

  // Today's snapshot: who is P/A/HD/OT/WO right now
  const todayAttendance = isCurrentMonth
    ? monthModel.rows.map((row) => ({
        name: row.name,
        site: row.siteName,
        today: (attendanceByWorker[row.id] || {})[todayDayKey] || "A",
      }))
    : null;

  const todayPresent = todayAttendance ? todayAttendance.filter((w) => w.today === "P").length : null;
  const todayAbsent  = todayAttendance ? todayAttendance.filter((w) => w.today === "A").length : null;
  const todayHD      = todayAttendance ? todayAttendance.filter((w) => w.today === "HD").length : null;
  const todayOT      = todayAttendance ? todayAttendance.filter((w) => w.today === "OT").length : null;

  return {
    // ── Date context ────────────────────────────────
    month: monthKey,
    monthLabel: monthLabel(monthKey),
    isCurrentMonth,
    todayDate: isCurrentMonth
      ? today.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
      : null,
    todayDayOfMonth: isCurrentMonth ? todayDay : null,
    daysSoFarThisMonth: daysSoFar,
    totalDaysInMonth,

    // ── Company ─────────────────────────────────────
    company: {
      name: company.businessName,
      owner: company.ownerName,
      gstin: company.gstin,
      pfReg: company.pfRegistration,
      esiReg: company.esiRegistration,
      serviceChargeRate: company.serviceChargeRate,
      gstRate: company.gstRate,
    },

    // ── Calculation rules ────────────────────────────
    rules: {
      pfEmployee: `${monthModel.rules.pfEmployeeRate}% of min(gross, ${fmt(monthModel.rules.pfCap)})`,
      pfEmployer: `${monthModel.rules.pfEmployerRate}% of min(gross, ${fmt(monthModel.rules.pfCap)})`,
      esiEmployee: `${monthModel.rules.esiEmployeeRate}% of gross (only if gross <= ${fmt(monthModel.rules.esiThreshold)})`,
      esiEmployer: `${monthModel.rules.esiEmployerRate}% of gross (only if gross <= ${fmt(monthModel.rules.esiThreshold)})`,
      otRate: `${monthModel.rules.overtimeMultiplier}x daily wage per OT day`,
      serviceCharge: `${monthModel.rules.serviceChargeRate}%`,
      gst: `${monthModel.rules.gstRate}% (CGST + SGST split equally)`,
    },

    // ── Today's attendance snapshot ──────────────────
    todaySnapshot: todayAttendance
      ? {
          date: today.toLocaleDateString("en-IN"),
          present: todayPresent,
          absent: todayAbsent,
          halfDay: todayHD,
          overtime: todayOT,
          weekOff: todayAttendance.filter((w) => w.today === "WO").length,
          total: todayAttendance.length,
          absentWorkers: todayAttendance.filter((w) => w.today === "A").map((w) => w.name),
          presentWorkers: todayAttendance.filter((w) => w.today === "P").map((w) => w.name),
          otWorkers: todayAttendance.filter((w) => w.today === "OT").map((w) => w.name),
          hdWorkers: todayAttendance.filter((w) => w.today === "HD").map((w) => w.name),
        }
      : null,

    // ── Month totals ─────────────────────────────────
    monthTotals: {
      grossWages: fmt(monthModel.totals.gross),
      pfEmployee: fmt(monthModel.totals.pfEmployee),
      pfEmployer: fmt(monthModel.totals.pfEmployer),
      esiEmployee: fmt(monthModel.totals.esiEmployee),
      esiEmployer: fmt(monthModel.totals.esiEmployer),
      serviceCharge: fmt(monthModel.totals.serviceCharge),
      subTotal: fmt(monthModel.totals.subTotal),
      gstAmount: fmt(monthModel.totals.gstAmount),
      invoiceTotal: fmt(monthModel.totals.invoiceTotal),
      netPayToWorkers: fmt(monthModel.totals.net),
    },

    // ── Per-site summaries ───────────────────────────
    sites: monthModel.siteSummaries.map((s) => ({
      name: s.name,
      client: s.clientName,
      workers: s.workerCount,
      grossWages: fmt(s.gross),
      invoiceTotal: fmt(s.invoiceTotal),
    })),

    // ── Per-worker detail ────────────────────────────
    workers: monthModel.rows.map((row) => ({
      name: row.name,
      role: row.role,
      site: row.siteName,
      dailyWage: fmt(row.dailyWage),
      active: row.active,
      monthAttendance: {
        present: row.payroll.present,
        absent: row.payroll.absent,
        halfDay: row.payroll.halfDay,
        overtimeDays: row.payroll.overtimeDays,
        weeklyOff: row.payroll.weeklyOff,
        todayStatus: isCurrentMonth
          ? ((attendanceByWorker[row.id] || {})[todayDayKey] || "A")
          : undefined,
      },
      payroll: {
        basic: fmt(row.payroll.basic),
        overtimePay: fmt(row.payroll.overtimePay),
        gross: fmt(row.payroll.gross),
        pfDeduction: fmt(row.payroll.pfEmployee),
        esiDeduction: fmt(row.payroll.esiEmployee),
        netPay: fmt(row.payroll.net),
      },
    })),
  };
}

export async function createGrokReply({
  messages,
  company,
  sites,
  workers,
  attendanceByWorker,
  monthKey,
  siteId = "all",
}) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("Missing GROQ_API_KEY. Add it to your .env file before using AI chat.");
  }

  const safeMessages = Array.isArray(messages)
    ? messages.filter((m) => typeof m?.content === "string" && m.content.trim())
    : [];

  if (!safeMessages.length) {
    throw new Error("At least one user message is required.");
  }

  const context = buildContext({ company, sites, workers, attendanceByWorker, monthKey, siteId });

  const systemPrompt = `You are Thekedar AI — a smart assistant for labour contractor ${context.company.name || "this business"}.

TODAY: ${context.todayDate || context.monthLabel}
MONTH IN VIEW: ${context.monthLabel}

STRICT RULES:
1. Respond ONLY in simple Hindi/Hinglish (Roman script). No English paragraphs.
2. Use Rs. with Indian number formatting (Rs. 1,42,500 — not 142500).
3. Max 12 lines per response. Contractor reads on phone.
4. Use ONLY the numbers from the context JSON below. NEVER make up or approximate numbers.
5. If exact data is not in context, say "Ye data available nahi hai" — do NOT guess.
6. "Aaj" / "today" always refers to: ${context.todayDate || "the current date"}.
7. "Is mahine" / "this month" refers to: ${context.monthLabel}.

TONE:
- Talk like a trusted munshi (clerk/accountant) who knows the business.
- Terms: haziri = attendance, tankhwah = wages, chutti = leave, OT = overtime, hisaab = calculation.
- Be direct. No fluff.

CAPABILITIES:
- Attendance: who came today, who was absent, monthly totals per worker.
- Wages: gross, PF, ESI, net for any worker or all workers total.
- Invoice: total bill to client including PF employer, ESI employer, service charge, GST.
- Compliance: PF challan due 15th next month, ESI challan due 15th next month.

CANNOT DO (redirect to app):
- Marking/changing attendance → tell them to use Haziri tab.
- Adding/removing workers → Setup tab.
- Downloading files → Invoice tab.`;

  const contextMessage = `Data for ${context.monthLabel}:\n${JSON.stringify(context, null, 0)}`;

  const chatMessages = [
    { role: "system", content: systemPrompt },
    { role: "system", content: contextMessage },
    ...safeMessages.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content),
    })),
  ];

  const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: chatMessages,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const msg = data?.error?.message || `Groq API error ${response.status}`;
    throw new Error(msg);
  }

  const text = String(data.choices?.[0]?.message?.content || "").trim();
  if (!text) throw new Error("Groq API returned an empty response.");

  return { model: GROQ_MODEL, text };
}
