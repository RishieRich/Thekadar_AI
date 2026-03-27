import { calculateMonthModel, monthLabel } from "./shared/payroll.js";

const GROQ_BASE_URL = process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1";
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

function buildContext({ company, sites, workers, attendanceByWorker, monthKey, siteId }) {
  const monthModel = calculateMonthModel({
    company,
    sites,
    workers,
    attendanceByWorker,
    monthKey,
    siteId,
  });

  return {
    month: monthKey,
    monthLabel: monthLabel(monthKey),
    company: {
      businessName: company.businessName,
      ownerName: company.ownerName,
      phone: company.phone,
      email: company.email,
      address: company.address,
      gstin: company.gstin,
      clraLicense: company.clraLicense,
      pfRegistration: company.pfRegistration,
      esiRegistration: company.esiRegistration,
      serviceChargeRate: company.serviceChargeRate,
      gstRate: company.gstRate,
    },
    rules: monthModel.rules,
    totals: monthModel.totals,
    sites: monthModel.siteSummaries,
    workers: monthModel.rows.map((row) => ({
      name: row.name,
      role: row.role,
      siteName: row.siteName,
      dailyWage: row.dailyWage,
      active: row.active,
      attendance: {
        present: row.payroll.present,
        absent: row.payroll.absent,
        halfDay: row.payroll.halfDay,
        overtimeDays: row.payroll.overtimeDays,
        weeklyOff: row.payroll.weeklyOff,
      },
      payroll: {
        basic: row.payroll.basic,
        overtimePay: row.payroll.overtimePay,
        gross: row.payroll.gross,
        pfEmployee: row.payroll.pfEmployee,
        esiEmployee: row.payroll.esiEmployee,
        net: row.payroll.net,
      },
    })),
  };
}

export async function createGrokReply({ messages, company, sites, workers, attendanceByWorker, monthKey, siteId = "all" }) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("Missing GROQ_API_KEY. Add it to your .env file before using AI chat.");
  }

  const safeMessages = Array.isArray(messages)
    ? messages.filter((message) => typeof message?.content === "string" && message.content.trim())
    : [];

  if (!safeMessages.length) {
    throw new Error("At least one user message is required.");
  }

  const context = buildContext({ company, sites, workers, attendanceByWorker, monthKey, siteId });

  const chatMessages = [
    {
      role: "system",
      content: "You are Thekedar AI, an operations assistant for Indian labour contractors. Use only the supplied company, site, worker, attendance, payroll, and invoice context. Do not invent registrations, counts, or payment values. If data is missing, say so directly. Keep answers concise, operational, and businesslike. Respond in simple Hindi/Hinglish (Roman script) when appropriate.",
    },
    {
      role: "system",
      content: `Current business context JSON:\n${JSON.stringify(context)}`,
    },
    ...safeMessages.map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: String(message.content),
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
    const message = data?.error?.message || `Groq API request failed with status ${response.status}`;
    throw new Error(message);
  }

  const text = String(data.choices?.[0]?.message?.content || "").trim();

  if (!text) {
    throw new Error("Groq API returned an empty response.");
  }

  return {
    model: GROQ_MODEL,
    text,
  };
}
