import { calculateMonthModel, monthLabel } from "./shared/payroll.js";

const XAI_BASE_URL = process.env.XAI_BASE_URL || "https://api.x.ai/v1";
const XAI_MODEL = process.env.XAI_MODEL || "grok-4.20-reasoning";

function fallbackOutput(response) {
  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) {
        return content.text;
      }
    }
  }

  return "";
}

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
  if (!process.env.XAI_API_KEY) {
    throw new Error("Missing XAI_API_KEY. Add it to your environment before using AI chat.");
  }

  const safeMessages = Array.isArray(messages)
    ? messages.filter((message) => typeof message?.content === "string" && message.content.trim())
    : [];

  if (!safeMessages.length) {
    throw new Error("At least one user message is required.");
  }

  const context = buildContext({ company, sites, workers, attendanceByWorker, monthKey, siteId });
  const input = [
    {
      role: "system",
      content: [
        {
          type: "input_text",
          text: "You are Thekedar AI, an operations assistant for Indian labour contractors. Use only the supplied company, site, worker, attendance, payroll, and invoice context. Do not invent registrations, counts, or payment values. If data is missing, say so directly. Keep answers concise, operational, and businesslike.",
        },
      ],
    },
    {
      role: "system",
      content: [
        {
          type: "input_text",
          text: `Current business context JSON:\n${JSON.stringify(context)}`,
        },
      ],
    },
    ...safeMessages.map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: [
        {
          type: "input_text",
          text: String(message.content),
        },
      ],
    })),
  ];

  const response = await fetch(`${XAI_BASE_URL}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.XAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: XAI_MODEL,
      input,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data?.error?.message || `xAI API request failed with status ${response.status}`;
    throw new Error(message);
  }

  const text = String(data.output_text || fallbackOutput(data) || "").trim();

  if (!text) {
    throw new Error("xAI API returned an empty response.");
  }

  return {
    model: XAI_MODEL,
    text,
  };
}
