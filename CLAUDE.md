# CLAUDE.md — Thekedar AI Phase 1: Production-Ready for 2 Contractors

## Context

This is the Thekedar AI repo — a labour contractor management tool built with React + Vite frontend and a Node.js HTTP server backend. The current state has:

- `src/App.jsx` — Full 7-screen React UI (dashboard, chat, attendance, wages, invoice, workers, compliance)
- `server.mjs` — Node.js HTTP server with REST API (CRUD for workers, sites, attendance, company settings)
- `groq.mjs` — Groq/LLM integration for the chat feature
- `server/store.mjs` — JSON file-based persistence
- `shared/payroll.js` — Shared payroll logic (attendance statuses, month helpers)

The app currently works as a desktop simulation. We need to make it usable by real contractors on their phones with zero infra cost.

---

## Goal

Make the app ready for 2 real contractors to use daily on their mobile phones. The contractor opens a URL, logs in with a PIN, records daily attendance, asks questions in Hindi/English via chat, and gets wage calculations + invoices at month-end.

---

## Task 1: Mobile-Responsive Layout

The current layout has a fixed 220px sidebar that breaks on mobile. Fix this.

### Requirements

- On screens <=768px wide, hide the sidebar completely
- Add a fixed bottom tab bar (like a mobile app) with icons for: Dashboard, Chat, Haziri, Tankhwah, Invoice, Workers, Compliance
- The bottom tab bar should show the icon + short label, highlight the active tab
- Keep the sidebar as-is for desktop (>=769px)
- The top filter bar (All / Tema India / Sudhir Brothers) should become horizontally scrollable on mobile
- All tables (attendance grid, wages table) must be horizontally scrollable on mobile with the worker name column sticky on the left
- Chat input should not get hidden behind the mobile keyboard — use proper viewport handling
- Test at 375px width (iPhone SE) and 390px width (iPhone 14)

### Implementation Notes

- Use CSS media queries, not a separate mobile component
- The bottom tab bar should be 56px tall, fixed to bottom, with a subtle top border
- Adjust main content padding-bottom to account for the tab bar on mobile (add 56px)
- The attendance grid already has overflowX: auto and sticky positioning — verify it works on mobile widths

---

## Task 2: Simple PIN Authentication

Each contractor gets their own PIN and sees only their own data. This is NOT production-grade auth — it's a simple gatekeeper for 2 contractors.

### Requirements

- Add a login screen that shows before the main app
- Login screen: company logo area ("THEKEDAR AI" branding), a 4-digit PIN input, and a "Login" button
- PINs are stored in the server's JSON data file alongside contractor data
- Each contractor is a "tenant" with their own workers, sites, attendance, and company settings
- The PIN maps to a tenant ID — after login, all API calls include the tenant ID
- Store the tenant ID in sessionStorage so refresh doesn't log out (but closing the tab does)
- Add a "Logout" button in the sidebar (desktop) and in a settings/profile area (mobile)

### Data Structure Change

Update the JSON store structure from:

```json
{
  "company": {},
  "sites": [],
  "workers": [],
  "attendance": {}
}
```

To:

```json
{
  "tenants": {
    "t1": {
      "pin": "1234",
      "company": {
        "businessName": "Rajesh Contractors",
        "ownerName": "Rajesh Mehta",
        "phone": "9876543210"
      },
      "sites": [],
      "workers": [],
      "attendance": {}
    },
    "t2": {
      "pin": "5678",
      "company": {
        "businessName": "Sunil Labour Supply",
        "ownerName": "Sunil Patel",
        "phone": "9876543211"
      },
      "sites": [],
      "workers": [],
      "attendance": {}
    }
  }
}
```

### API Changes

- Add `POST /api/login` — accepts `{ pin: "1234" }`, returns `{ tenantId: "t1", company: {...} }` or 401
- All existing API endpoints (`/api/bootstrap`, `/api/workers`, `/api/sites`, `/api/attendance`, `/api/company`, `/api/chat`) must now require a `x-tenant-id` header
- If the header is missing or doesn't match a valid tenant, return 401
- The frontend sends this header with every API call after login
- Seed the initial data file with 2 sample tenants, each with their own workers and sites

### Login Screen Design

- Full-screen, centered, dark theme matching the app
- The THEKEDAR AI logo/branding at top
- A large 4-digit PIN input (each digit in a separate box, auto-advance to next box)
- "Enter your PIN to continue" subtitle
- Error message area for wrong PIN ("Galat PIN. Dobara try karo.")
- No signup flow — PINs are created by the admin (you) directly in the JSON file

---

## Task 3: Improve Groq Chat for Real Hindi/Hinglish Input

The chat needs to handle actual contractor speech patterns, not just keyword matching.

### Requirements

- Update the system prompt in `groq.mjs` to be much more robust for Hinglish input
- The LLM should understand variations like:
  - "aaj 12 log aaye tema mein" → attendance for today at Tema India
  - "ramesh ki tankhwah batao" → show Ramesh's wage details
  - "march ka bill banao" → generate invoice
  - "kitne log aaye aaj" → today's attendance count
  - "suresh nahi aaya aaj" → mark Suresh absent
  - "PF ka paisa kitna jaata hai" → PF summary
  - "ESI mein kaun kaun eligible hai" → ESI eligible workers
- The system prompt must include:
  - The full worker list with names, roles, daily wages, and site assignments
  - Current month's attendance summary
  - PF/ESI rates and rules
  - The contractor's company name
- The LLM response should always be in simple Hindi/Hinglish (Roman script, not Devanagari)
- Format numbers with the rupee symbol and Indian comma formatting (e.g., 1,42,500)
- Keep responses concise — max 15 lines. Contractors are reading on phone screens

### System Prompt Template

Update the `createGroqReply` function to build a system prompt like this:

```
You are Thekedar AI, a WhatsApp-style assistant for labour contractor {companyName}, owned by {ownerName}.

Current month: {monthKey} (e.g., "2026-03")

## Workers ({count} total):
{workerList — name, role, daily wage, site}

## This Month's Attendance Summary:
{per-worker: present days, absent days, half days, OT hours}

## Calculation Rules (NEVER deviate from these):
- PF Employee: {pfEmployeeRate}% of min(gross, {pfCap})
- PF Employer: {pfEmployerRate}% of min(gross, {pfCap})
- ESI Employee: {esiEmployeeRate}% of gross (only if gross <= {esiThreshold})
- ESI Employer: {esiEmployerRate}% of gross (only if gross <= {esiThreshold})
- OT Rate: {overtimeMultiplier}x of (daily wage / 8) per OT hour
- Service Charge: {serviceChargeRate}% on gross wages
- GST: {gstRate}%

## Instructions:
- ALWAYS respond in simple Hindi/Hinglish (Roman script)
- ALWAYS use the rupee symbol with Indian number formatting (1,42,500 not 142500)
- Keep responses under 15 lines
- When asked about attendance, calculate from the data above — don't make up numbers
- When asked about wages, use the exact formulas above — don't approximate
- When asked to mark attendance, confirm what you understood and ask for confirmation
- If you don't understand, ask a clarifying question in Hindi
```

### Chat Integration with Attendance Actions

When the contractor says something like "Ramesh aaj nahi aaya", the chat should:

1. Recognize this as an attendance update intent
2. Respond: "Samajh gaya — Ramesh Patel ko aaj absent mark kar raha hoon. Theek hai?"
3. If the user confirms (haan, yes, theek, ok), call the attendance API to actually log it
4. Respond: "Done — Ramesh Patel absent marked for 15 Mar 2026"

To implement this:

- The LLM response should include a structured JSON block when an action is needed
- Parse the response for action blocks and execute them
- Show the text portion to the user, execute the action portion silently
- Use this format in the system prompt instructions:

```
When the user wants to update attendance, respond with your confirmation message AND include a JSON action block at the end of your response, wrapped in ```action tags:

```action
{"type": "attendance", "workerId": "...", "date": "2026-03-15", "status": "A"}
```

The system will execute this action after your response is shown.
Only include the action block AFTER the user confirms. On first mention, just ask for confirmation.
```

---

## Task 4: PWA Support (Progressive Web App)

Make the app installable on the contractor's phone home screen so it feels like a native app.

### Requirements

- Add a `manifest.json` in the `public/` directory with:
  - name: "Thekedar AI"
  - short_name: "Thekedar"
  - start_url: "/"
  - display: "standalone"
  - background_color: "#0a0e14"
  - theme_color: "#10b981"
  - Icons: generate simple 192x192 and 512x512 PNG icons
- Add the manifest link to `index.html`
- Add a meta tag for theme-color
- Add a basic service worker (`public/sw.js`) that caches the app shell for offline access:
  - Cache the HTML, JS, CSS, and font files on install
  - Serve from cache first, fall back to network
  - This means the contractor can open the app even with spotty network, and it loads instantly
- Show an "Add to Home Screen" banner on first visit (use the `beforeinstallprompt` event)

---

## Task 5: Seed Data for 2 Real-ish Contractors

Replace the current hard-coded WORKERS array in App.jsx with data loaded from the server API. The frontend should call `/api/bootstrap` on mount and use that data.

### Requirements

- Remove all hard-coded WORKERS, SITES, and attendance data from `src/App.jsx`
- On app load (after login), call `GET /api/bootstrap?month=2026-03` with the tenant ID header
- Use the returned data to populate the entire UI
- The seed data in the JSON store should have 2 tenants:

**Tenant 1 — "Rajesh Contractors" (PIN: 1234)**
- Sites: Tema India (Achhad), Sudhir Brothers (Rabale)
- 8 workers across both sites with realistic Gujarati/Hindi names, roles (Fitter, Welder, Helper, Crane Operator, Electrician), daily wages (450-800)

**Tenant 2 — "Sunil Labour Supply" (PIN: 5678)**
- Sites: Godrej Process Equipment (Dahej), L&T Heavy Engineering (Hazira)
- 6 workers with different names, similar role/wage distribution
- Seed March 2026 attendance for both tenants using the existing random seeding logic, but do it server-side on first boot if no attendance exists for the month

---

## Task 6: Excel and PDF Generation (Server-Side)

The "Download PDF" and "Send via WhatsApp" buttons currently show alerts. Make them actually generate files.

### Requirements

- Add `GET /api/export/wages?month=2026-03&format=xlsx` endpoint that:
  - Calculates wages for all workers for the given month
  - Generates an Excel file using `exceljs` — install it: `npm install exceljs`
  - Returns the file as a download
  - The Excel should have: worker name, role, site, days present/absent/HD/OT, basic, OT pay, gross, PF deduction, ESI deduction, net pay, UAN
  - Include a totals row at the bottom
  - Include a second sheet "PF Summary" with worker-wise PF breakdowns
  - Include a third sheet "ESI Summary" with eligible workers and contributions
- Add `GET /api/export/invoice?month=2026-03&format=pdf` endpoint that:
  - Generates a PDF invoice using `pdfkit` — install it: `npm install pdfkit`
  - The invoice should match the layout shown in the Invoice tab: company details, client details, line items (gross, PF employer, ESI employer, service charge, sub-total, CGST, SGST, total)
  - Returns the file as a download
- Wire the frontend buttons to trigger downloads from these endpoints

---

## Task 7: Environment Variables

Move all configuration to environment variables so deployment is clean.

### Requirements

Update `.env.example` with all required variables:

```env
# Server
PORT=8787

# Groq API (free tier)
GROQ_API_KEY=gsk_your_key_here
GROQ_MODEL=llama-3.3-70b-versatile

# Data storage path
DATA_FILE_PATH=./data/db.json

# App URL (for CORS)
APP_URL=http://localhost:5173
```

- Update `server.mjs` to read from `process.env` with sensible defaults
- Update `groq.mjs` to use `process.env.GROQ_API_KEY` and `process.env.GROQ_MODEL`
- Add `data/` to `.gitignore` so contractor data is never committed
- Create `data/seed.json` with the seed data from Task 5 — the server should copy this to `db.json` on first boot if `db.json` doesn't exist

---

## Task 8: Deployment Configuration

### Render.com (free tier, recommended for Phase 1)

Add a `render.yaml` file:

```yaml
services:
  - type: web
    name: thekedar-ai
    runtime: node
    plan: free
    buildCommand: npm install && npm run build
    startCommand: node server.mjs
    envVars:
      - key: GROQ_API_KEY
        sync: false
      - key: NODE_ENV
        value: production
```

The `server.mjs` already serves static files from `dist/` — so one service handles both frontend and API.

### Update vercel.json

Vercel can't run a persistent Node server on free tier (serverless only). Either:
- Option A: Convert API routes to Vercel serverless functions in `api/` directory
- Option B: Use Vercel for frontend only, point API calls to Render backend

Recommend Option B for simplicity — keep one Node server on Render that serves everything.

Update the README with deployment instructions for Render.

---

## Execution Order

1. Task 7 first — Environment variables (foundation for everything else)
2. Task 2 — Multi-tenant auth (changes data structure, affects all other tasks)
3. Task 5 — Seed data + load from API (removes hard-coded data)
4. Task 1 — Mobile responsive (biggest UX impact)
5. Task 3 — Chat improvements (makes it actually useful)
6. Task 4 — PWA support (installability)
7. Task 6 — Excel/PDF export (month-end feature)
8. Task 8 — Deployment config (go live)

---

## Testing Checklist

After all tasks, verify:

- [ ] App loads on mobile (375px width) with bottom tab bar
- [ ] Login with PIN 1234 shows Tenant 1 data, PIN 5678 shows Tenant 2 data
- [ ] Wrong PIN shows error in Hindi
- [ ] Attendance grid is scrollable on mobile, worker names stay visible
- [ ] Clicking attendance cells updates via API and persists after refresh
- [ ] Chat responds in Hindi to "aaj 12 log aaye tema mein"
- [ ] Chat responds correctly to "ramesh ki tankhwah batao" with real numbers
- [ ] Chat can mark attendance when user confirms
- [ ] Wage calculations match: PF on 15K cap, ESI on 21K threshold, OT at 2x
- [ ] Invoice shows correct CGST/SGST split
- [ ] Excel download works with correct data
- [ ] PDF invoice download works
- [ ] App is installable as PWA on Android Chrome
- [ ] App works after restart (data persists in JSON file)
- [ ] Logout clears session and returns to PIN screen
- [ ] Two browser tabs with different PINs show different contractor data

---

## What NOT To Do

- Do NOT add WhatsApp integration yet — that's Phase 2
- Do NOT add OpenClaw — we're building a web app, not a personal assistant
- Do NOT switch to a database — JSON file is fine for 2 contractors
- Do NOT add user registration/signup — PINs are admin-managed
- Do NOT add payment/billing — that's Phase 3
- Do NOT refactor App.jsx into multiple files yet — get it working first, refactor later
- Do NOT add TypeScript — keep it JS for speed of iteration
