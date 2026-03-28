# CLAUDE.md — Thekedar AI: Make It Real for 2 Contractors

## What This Repo Is

Thekedar AI (`github.com/RishieRich/Thekadar_AI`) is a labour contractor management tool. It has a React + Vite frontend (`src/App.jsx`), a Node.js HTTP server (`server.mjs`) with full CRUD REST API, Groq LLM-powered chat (`grok.mjs`), JSON file persistence (`server/store.mjs`), and shared payroll logic (`shared/payroll.js`).

The app currently works as a desktop demo. We are converting it into a real product that 2 contractors will use daily on their phones to run their business.

## The Contractor's Real Workflow (This Is The Product)

A labour contractor follows this exact monthly cycle. Every screen and feature must map to one of these steps:

```
Step 1: Mark Daily Attendance (every day)
    → Haziri tab — the contractor's daily touchpoint

Step 2: Month-End Attendance Closure (last day of month)
    → Attendance summary, Xerox/PDF of attendance card to send to factory

Step 3: Prepare Excel Payroll Sheet (1st-3rd of next month)
    → Tankhwah tab — auto-calculated wages with DT, OT, rates, PF/ESI

Step 4: Verify Attendance vs Payroll (cross-check)
    → Dashboard shows mismatches, Chat can answer "kitne din aaye Ramesh?"

Step 5: Prepare Final Bill/Invoice (after verification)
    → Invoice tab — GST-compliant invoice with all attachments listed

Step 6: Attach Supporting Documents
    → Last month salary sheet, PF challan, ESIC challan, WC policy, wages detail
    → The app generates these as downloadable Excel/PDF files

Step 7: Submit Bill to Company
    → Invoice PDF + all attachments ready for email/WhatsApp to factory

Step 8: Payment Processing → Step 9: Payment Received → Step 10: Done
    → Payment tracking (future feature — out of scope for now)
```

The app must feel like it guides the contractor through steps 1-7 naturally, not like a software tool with tabs.

---

## Existing Codebase Summary

| File | What It Does | Lines |
|------|-------------|-------|
| `src/App.jsx` | Full React UI — 7 screens (dashboard, chat, attendance, wages, invoice, workers, compliance) | ~600 |
| `server.mjs` | Node.js HTTP server — REST API for CRUD (workers, sites, attendance, company), serves static build from `dist/`, CORS, input sanitization | 374 |
| `grok.mjs` | Groq LLM integration — builds system prompt with full business context JSON, calls Groq API with `llama-3.3-70b-versatile` | 119 |
| `server/store.mjs` | JSON file persistence — `readDb()` and `updateDb()` with file locking | ~60 |
| `shared/payroll.js` | Shared payroll logic — attendance statuses, month key helpers, `calculateMonthModel()` for wage computation | ~200 |
| `index.html` | Vite entry — loads DM Sans + DM Mono fonts | 15 |
| `package.json` | Scripts: `dev` (vite), `server` (node server.mjs), `start` (node server.mjs), `build` (vite build) | 21 |

The server already has these API endpoints:
- `GET /api/health`
- `GET /api/bootstrap?month=YYYY-MM` — returns company, sites, workers, attendance for a month
- `PUT /api/company` — update company settings
- `POST /api/sites` / `PUT /api/sites/:id` / `DELETE /api/sites/:id`
- `POST /api/workers` / `PUT /api/workers/:id` / `DELETE /api/workers/:id`
- `PUT /api/attendance` — update single attendance cell (month, workerId, day, status)
- `POST /api/chat` — sends messages + full context to Groq, returns AI response

The Groq integration in `grok.mjs` already:
- Builds complete business context (company, sites, workers with attendance, payroll calculations, totals)
- Passes context as a system message JSON to the LLM
- Uses `shared/payroll.js` `calculateMonthModel()` for accurate wage computation
- Environment variable: `GROQ_API_KEY`, `GROQ_MODEL` (defaults to `llama-3.3-70b-versatile`)

---

## What Must Change — In Priority Order

Execute these in exact order. Each task builds on the previous.

---

### TASK 1: Multi-Tenant PIN Login

The app must support 2 contractors, each seeing only their own data.

**Data structure change.** The current JSON store has a flat structure (one company, one set of workers). Change it to:

```json
{
  "tenants": {
    "t1": {
      "pin": "1234",
      "label": "Rajesh Contractors",
      "company": { ... },
      "sites": [ ... ],
      "workers": [ ... ],
      "attendance": { "2026-03": { ... } }
    },
    "t2": {
      "pin": "5678",
      "label": "Sunil Labour Supply",
      "company": { ... },
      "sites": [ ... ],
      "workers": [ ... ],
      "attendance": { "2026-03": { ... } }
    }
  }
}
```

**Server changes:**
- Add `POST /api/login` — accepts `{ "pin": "1234" }`, returns `{ "tenantId": "t1", "label": "Rajesh Contractors" }` or `401`
- All existing endpoints must require an `x-tenant-id` header. Read it, look up the tenant, scope all reads/writes to that tenant's data. Return `401` if missing or invalid.
- Update `readDb` and `updateDb` in `store.mjs` to handle the nested tenant structure.

**Frontend changes:**
- Add a login screen before the main app. Show it when there is no tenant ID in `sessionStorage`.
- Login screen design: dark background matching app theme. Centered card with the Thekedar AI logo (the ⚡ branding). A 4-digit PIN input — four separate square input boxes, auto-advance on digit entry, auto-submit on 4th digit. Subtitle: "Apna PIN daalo". Error state: "Galat PIN — dobara try karo" in red, with a shake animation on the boxes.
- On successful login, store `tenantId` in `sessionStorage`. All subsequent API calls include `x-tenant-id` header.
- Add a logout button — in the sidebar footer on desktop, and accessible from a profile/settings icon on mobile. Logout clears `sessionStorage` and shows the login screen.
- Refresh should NOT log out (sessionStorage persists within the tab). Closing the tab DOES log out.

**Seed data.** Create `data/seed.json` with two tenants:

Tenant 1 ("Rajesh Contractors", PIN 1234):
- Company: businessName "Rajesh Contractors", ownerName "Rajesh Mehta", phone "9876543210", address "Vapi, Gujarat", gstin "24AAAAA0000A1Z5", clraLicense "GJ/VLS/2024/001", pfRegistration "GJVLS0012345000", esiRegistration "31-00-123456-000-0001"
- Sites: "Tema India - Achhad" (clientName "Tema India Ltd", location "Achhad, Talasari"), "Sudhir Brothers - Rabale" (clientName "Sudhir Brothers", location "Rabale, Navi Mumbai")
- Workers (8): Ramesh Patel (Fitter, ₹650, Tema), Suresh Yadav (Welder, ₹750, Tema), Mahesh Sharma (Helper, ₹450, Tema), Rajesh Tiwari (Fitter, ₹650, Sudhir), Dinesh Kumar (Electrician, ₹700, Tema), Ganesh Rathod (Helper, ₹450, Sudhir), Prakash Solanki (Crane Op, ₹800, Tema), Nilesh Joshi (Welder, ₹750, Sudhir)

Tenant 2 ("Sunil Labour Supply", PIN 5678):
- Company: businessName "Sunil Labour Supply", ownerName "Sunil Patel", phone "9876543211", address "Valsad, Gujarat"
- Sites: "Godrej Process Equipment - Dahej", "L&T Heavy Engineering - Hazira"
- Workers (6): different names, similar roles and wages

The server should auto-copy `data/seed.json` to `data/db.json` on first boot if `db.json` does not exist. Add `data/db.json` to `.gitignore`.

---

### TASK 2: Mobile-First Responsive Layout

The contractor uses this on their phone. It MUST work perfectly on a 375px-wide screen. This is the single most important UX change.

**Bottom navigation bar (mobile only, ≤768px):**
- Replace the sidebar with a fixed bottom tab bar, 60px tall
- Show 5 primary tabs with icons: Dashboard (📊), Chat (💬), Haziri (📋), Tankhwah (💰), More (⋯)
- The "More" tab opens a slide-up sheet with: Invoice, Workers, Compliance, and Logout
- Active tab gets the accent color highlight. Inactive tabs are gray.
- The tab bar must have a solid background (not transparent) so content doesn't show through when scrolling
- Add `padding-bottom: 68px` to the main content area on mobile so nothing hides behind the tab bar

**Sidebar (desktop only, ≥769px):**
- Keep the current sidebar exactly as-is for desktop screens
- Hide it completely on mobile via CSS media query — do NOT use JavaScript to toggle

**Header bar:**
- On mobile, replace the site filter bar with a compact header: app name on the left, a site dropdown selector on the right (instead of button group)
- The month display and worker count can go into the dashboard stats, not the header

**Scrolling and tables:**
- The attendance grid: wrap in a container with `overflow-x: auto`. The first column (worker name + role) must be `position: sticky; left: 0; z-index: 2` with a solid background so it stays visible while scrolling horizontally.
- The wages table: same treatment — horizontally scrollable, worker column sticky.
- All screens must be vertically scrollable on mobile. No fixed-height containers that trap scroll. The only fixed elements are the bottom tab bar and the header.
- The invoice screen should be a single scrollable card, not centered in a max-width container on mobile — let it fill the width.

**Chat screen on mobile:**
- The chat must fill the available height between the header and the bottom tab bar
- The input field must stay visible above the mobile keyboard. Use `position: sticky; bottom: 68px` (above tab bar) or equivalent. Test this carefully — the keyboard pushing the input out of view is the #1 mobile chat bug.
- Messages area gets `flex: 1; overflow-y: auto`

**Touch targets:**
- All clickable elements must be at least 44×44px touch target
- Attendance grid cells on mobile: increase the badge size from 30px to 38px minimum
- Add some padding around tap targets so fat fingers don't mis-tap

**Dashboard on mobile:**
- The stat cards should be 2 columns, not 4. Use `grid-template-columns: 1fr 1fr` on mobile.
- The two-column grid (compliance + attendance overview) should stack to single column on mobile.

**Worker cards on mobile:**
- Single column grid, each card full width

---

### TASK 3: Smooth UX Polish

The app must feel like a real product, not a developer demo.

**Page transitions:**
- Add a subtle fade transition when switching tabs. CSS-only: the content area gets `opacity` and `transform` transitions. When the tab changes, briefly fade out → swap content → fade in. Keep it under 200ms total.

**Loading states:**
- When the app loads data from the API (bootstrap call), show a centered loading spinner with "Loading..." text. Don't flash the empty app and then fill it.
- When the chat is waiting for Groq response, show the "typing..." indicator already present, but make it more visible — add three animated dots.
- When attendance is being saved (PUT call), briefly show a green ✅ flash on the cell to confirm the save succeeded. If it fails, show a red flash and revert the cell.

**Empty states:**
- If a contractor has no workers yet, show: "Koi worker nahi hai. Pehle workers add karo." with a button to go to the Workers tab.
- If no attendance is recorded for the selected month, show: "Is mahine ki attendance abhi blank hai. Haziri bharna shuru karo."

**Error handling:**
- If the server is unreachable, show a banner at the top: "Server se connection nahi ho raha. Internet check karo." with a retry button.
- If Groq API fails (no API key, quota exceeded), the chat should show: "AI assistant abhi available nahi hai. Baaki sab features kaam kar rahe hain."
- Never show raw error messages, stack traces, or JSON to the user.

**Date/month navigation:**
- Add month selector — left/right arrows around the month label (← March 2026 →) in the header or dashboard
- Changing the month calls `/api/bootstrap?month=YYYY-MM` and reloads all data
- Default to the current actual month, not hard-coded March 2026

**Attendance grid improvements:**
- Add a "Today" indicator — highlight today's column with a different background color
- Add row totals showing P/A/HD/OT counts per worker (already exists, verify it works with API data)
- Add column totals at the bottom showing total present/absent/HD/OT per day (helps catch data entry errors)
- On mobile, make the attendance grid touch-friendly: tapping a cell cycles P→A→HD→OT→P. Long-press could show a tooltip with the full status name. But keep it simple — just the tap cycle for now.

**Invoice improvements:**
- Let the contractor edit the "Bill To" company name and address directly on the invoice screen (it should default to the selected site's client name)
- Add an invoice number auto-generator: `INV/{contractor-initials}/{month}/{year}/{sequence}` e.g. `INV/RC/MAR/2026/001`
- The "Download PDF" and "Send via WhatsApp" buttons must actually work (see Task 5)

---

### TASK 4: Groq Chat — Make It Actually Useful

The current `grok.mjs` already passes full business context to the LLM. The system prompt needs to be more directive so the AI behaves like a knowledgeable assistant, not a generic chatbot.

**Update the system prompt in `grok.mjs`:**

Replace the current one-line system message with this (keep the context JSON as the second system message — that part is good):

```
You are Thekedar AI — a smart assistant for labour contractor {company.businessName} run by {company.ownerName}.

RULES:
1. ALWAYS respond in simple Hindi/Hinglish (Roman script). Never English paragraphs.
2. ALWAYS use ₹ with Indian formatting (1,42,500 not 142500).
3. Keep responses under 12 lines. The contractor reads on phone.
4. When asked about wages/PF/ESI/attendance — use ONLY the data provided in context. NEVER make up numbers.
5. When the data says something, state it confidently. Don't hedge with "approximately" or "around".
6. If data is missing or you can't answer, say "Ye data abhi available nahi hai" — don't guess.

PERSONALITY:
- Talk like a helpful munshi (clerk) who knows the contractor's business
- Use familiar terms: haziri (attendance), tankhwah (wages/salary), chutti (leave), OT (overtime), hisaab (calculation)
- Be direct and practical. No motivational fluff. No "main aapki madad karne ke liye tayyar hoon" type lines.
- When showing numbers, always show the breakdown, not just the total

WHAT YOU CAN DO:
- Answer questions about attendance (who came, who didn't, how many days)
- Answer questions about wages (gross, PF, ESI, net for any worker or total)
- Answer questions about PF/ESI amounts and due dates
- Answer questions about invoice amounts
- Answer compliance questions (PF filing date: 15th of next month, ESI: 15th, CLRA Form XXIV: Jan 30 and Jul 30)
- Help contractor understand deductions ("PF kaise calculate hota hai?")

WHAT YOU CANNOT DO:
- Update attendance (tell them to use the Haziri tab)
- Add/remove workers (tell them to use the Workers tab)
- Generate files (tell them to use the Invoice tab download button)
- Anything outside labour contractor operations
```

**Chat action buttons:**
After the AI responds, show 2-3 quick-reply suggestion chips below the message based on context. Examples:
- After an attendance answer: "Tankhwah dikhao" | "Invoice banao"
- After a wage answer: "PF kitna hai?" | "ESI kaun eligible?"
- After PF/ESI answer: "Invoice total batao"
These are just buttons that pre-fill the chat input when tapped.

---

### TASK 5: File Export (Excel Wages + PDF Invoice)

This is what the contractor actually needs to submit to the factory every month.

**Install dependencies:**
```bash
npm install exceljs pdfkit
```

**Excel wage sheet endpoint: `GET /api/export/wages?month=2026-03`**

Generate an Excel file with:
- Sheet 1 "Wage Sheet": Worker Name, Role, Site, Days Present, Days Absent, Half Days, OT Hours, Daily Wage, Basic, OT Pay, Gross, PF Employee, ESI Employee, Net Pay, UAN, ESI Number
- A totals row at the bottom
- Sheet 2 "PF Summary": Worker Name, UAN, PF Wages (capped at ₹15K), Employee 12%, Employer 12%, EPS 8.33%, EPF 3.67%, Total PF
- Sheet 3 "ESI Summary": Worker Name, ESI Number, Gross Wages, Eligible (Yes/No), Employee 0.75%, Employer 3.25%, Total ESI
- Header row styling: bold, background color
- Auto-column-widths
- File name: `Wages_{CompanyName}_{Month}_{Year}.xlsx`

Use the existing `calculateMonthModel()` from `shared/payroll.js` — all the math is already there.

**PDF invoice endpoint: `GET /api/export/invoice?month=2026-03&siteId=all`**

Generate a PDF invoice with:
- Contractor company details (from tenant's company settings) at top
- "Bill To" client details (from selected site or all sites)
- Invoice number, date, period
- Line items: Gross Wages, PF Employer Contribution, ESI Employer Contribution, Service Charge (X%), Sub-total, CGST (9%), SGST (9%), Grand Total
- Attachment list at bottom: "Attached: Muster Roll, PF ECR Copy, ESI Challan, Salary Sheet"
- File name: `Invoice_{CompanyName}_{Month}_{Year}.pdf`

**Frontend wiring:**
- The "Download Excel" button on the wages tab should call `/api/export/wages?month=...` and trigger a file download
- The "Download PDF" button on the invoice tab should call `/api/export/invoice?month=...&siteId=...`
- Add a "Share via WhatsApp" button that generates the PDF and opens `https://wa.me/?text=...` with a pre-filled message (the contractor then picks the recipient in WhatsApp). Don't try to use WhatsApp API — just the share URL.

---

### TASK 6: Worker and Site Management (CRUD UI)

The contractor needs to add/edit/remove their own workers and sites. The API already supports this (`POST/PUT/DELETE /api/workers`, `/api/sites`). Wire the frontend.

**Workers tab:**
- Change from read-only cards to an editable list
- Each worker card gets an "Edit" icon (pencil) and "Delete" icon (trash)
- Add a floating "+" button (bottom-right on mobile) to add a new worker
- Add/Edit form (slide-up modal on mobile, side panel on desktop): Name, Role (dropdown: Fitter, Welder, Helper, Electrician, Crane Operator, Painter, Mason, Other), Daily Wage, Site (dropdown from sites list), UAN, ESI Number, Active toggle
- Delete confirmation: "Kya aap {name} ko delete karna chahte hain? Iska attendance data bhi delete ho jayega."
- After any CRUD operation, refresh the data from the API

**Sites tab (inside settings or compliance):**
- Add site management to the compliance/settings area
- Add/Edit form: Site Name, Client Company Name, Location
- Delete only allowed if no workers are assigned to the site (the API already enforces this — show the error message in Hindi)

**Company settings:**
- Add a "Settings" icon in the sidebar (desktop) or in the "More" sheet (mobile)
- Settings screen: Business Name, Owner Name, Phone, Email, Address, GSTIN, CLRA License No, PF Registration No, ESI Registration No, Service Charge % (default 10), GST Rate % (default 18)
- These are stored in the tenant's company object via `PUT /api/company`

---

### TASK 7: PWA — Install on Home Screen

The contractor adds this to their phone home screen and it feels like an app.

**manifest.json** in `public/`:
```json
{
  "name": "Thekedar AI",
  "short_name": "Thekedar",
  "description": "Labour contractor attendance, wages & invoicing",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0a0e14",
  "theme_color": "#10b981",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

Generate icons: create simple PNG icons programmatically (a green ⚡ on dark background) or use a placeholder. Put them in `public/`.

**Service worker** (`public/sw.js`): basic cache-first strategy for the app shell (HTML, JS, CSS, fonts). This makes the app load instantly on repeat visits even with bad network.

**index.html changes:** Add `<link rel="manifest" href="/manifest.json">`, `<meta name="theme-color" content="#10b981">`, register the service worker.

---

### TASK 8: Deployment — One Server on Render.com (Free)

The app needs ONE deployment that serves both frontend and API. `server.mjs` already does this — it serves `dist/` as static files and handles API routes.

**Build process for production:**
1. `npm run build` — Vite builds React to `dist/`
2. `node server.mjs` — serves `dist/` + API on port 8787

**render.yaml:**
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
      - key: PORT
        value: "8787"
```

**Note about Render free tier:** The service sleeps after 15 minutes of inactivity and takes ~30 seconds to wake up. This is acceptable for 2 contractors. Add a loading screen that shows while the server wakes up — the frontend HTML loads from cache (PWA), the loading screen shows until the first API call succeeds.

**Update `.env.example`:**
```env
PORT=8787
GROQ_API_KEY=gsk_your_key_here
GROQ_MODEL=llama-3.3-70b-versatile
DATA_FILE_PATH=./data/db.json
```

Add `data/` to `.gitignore` (keep `data/seed.json` tracked).

---

## Execution Order

1. TASK 1 — Multi-tenant PIN auth (changes data structure, everything depends on this)
2. TASK 2 — Mobile responsive (biggest UX impact)
3. TASK 3 — UX polish (loading, errors, month nav, empty states)
4. TASK 6 — Worker/site CRUD UI (contractor needs to set up their own data)
5. TASK 4 — Groq chat improvements (make AI actually useful)
6. TASK 5 — Excel/PDF export (the month-end deliverable)
7. TASK 7 — PWA (installability, offline support)
8. TASK 8 — Deployment config

---

## Testing Checklist

After all tasks, verify every item:

- [ ] Login: PIN 1234 → Tenant 1 data. PIN 5678 → Tenant 2 data. Wrong PIN → Hindi error with shake.
- [ ] Refresh keeps you logged in. Close tab and reopen → login screen.
- [ ] Mobile (375px): bottom tab bar visible, sidebar hidden, all content scrollable
- [ ] Mobile: attendance grid scrolls horizontally, worker names stay visible
- [ ] Mobile: chat input stays visible when keyboard opens
- [ ] Mobile: all tap targets ≥ 44px
- [ ] Desktop (1200px+): sidebar visible, no bottom tab bar
- [ ] Month navigation: arrows switch months, data reloads from API
- [ ] Attendance: click/tap cell → status changes → green flash confirms save → persists after refresh
- [ ] Attendance: column totals and row totals correct
- [ ] Wages: all calculations match manual check (PF on ₹15K cap, ESI on ₹21K threshold, OT at 2x)
- [ ] Invoice: CGST + SGST each 9%, service charge from company settings, total correct
- [ ] Chat: responds in Hindi to "kitne log aaye aaj", "ramesh ki tankhwah", "PF kitna hai"
- [ ] Chat: suggestion chips appear after responses
- [ ] Workers: can add, edit, delete workers. Changes persist.
- [ ] Sites: can add, edit sites. Can't delete site with workers assigned.
- [ ] Excel download: file opens in Excel/Google Sheets with correct data, 3 sheets
- [ ] PDF download: invoice PDF has correct numbers, proper formatting
- [ ] WhatsApp share: opens WhatsApp with pre-filled message
- [ ] PWA: "Add to Home Screen" works on Android Chrome, app opens standalone
- [ ] Server restart: all data preserved (JSON file persistence)
- [ ] No raw errors shown to user — all errors in Hindi

---

## What NOT To Do

- Do NOT add WhatsApp Business API integration — that's Phase 2
- Do NOT add a database (PostgreSQL, SQLite) — JSON file is correct for 2 contractors
- Do NOT add user registration/signup — PINs are admin-managed
- Do NOT add payment tracking — out of scope
- Do NOT split App.jsx into multiple component files — get it working first, refactor later
- Do NOT add TypeScript — speed of iteration matters more
- Do NOT add testing frameworks — manual testing is fine for 2 users
- Do NOT change the Groq model — `llama-3.3-70b-versatile` on free tier is sufficient
- Do NOT add OpenClaw, WhatsApp web.js, or any messaging platform integration
- Do NOT over-engineer the auth — a 4-digit PIN is appropriate for this stage
- Do NOT add i18n/localization framework — just write Hindi strings inline
