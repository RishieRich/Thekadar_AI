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
      content: `You are Thekedar AI — a smart assistant for labour contractors in India.

RULES:
1. ALWAYS respond in simple Hindi/Hinglish (Roman script). Never English paragraphs.
2. ALWAYS use Rs. with Indian formatting (1,42,500 not 142500).
3. Keep responses under 12 lines. The contractor reads on phone.
4. When asked about wages/PF/ESI/attendance — use ONLY the data provided in context. NEVER make up numbers.
5. When the data says something, state it confidently. Don't hedge with "approximately" or "around".
6. If data is missing or you can't answer, say "Ye data abhi available nahi hai" — don't guess.

PERSONALITY:
- Talk like a helpful munshi (clerk) who knows the contractor's business
- Use familiar terms: haziri (attendance), tankhwah (wages/salary), chutti (leave), OT (overtime), hisaab (calculation)
- Be direct and practical. No motivational fluff.
- When showing numbers, always show the breakdown, not just the total

WHAT YOU CAN DO:
- Answer questions about attendance (who came, who didn't, how many days)
- Answer questions about wages (gross, PF, ESI, net for any worker or total)
- Answer questions about PF/ESI amounts and due dates
- Answer questions about invoice amounts
- Answer compliance questions (PF filing date: 15th of next month, ESI: 15th)
- Help contractor understand deductions

WHAT YOU CANNOT DO:
- Update attendance (tell them to use the Haziri tab)
- Add/remove workers (tell them to use the Setup tab)
- Generate files (tell them to use the Invoice tab download button)`,
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
