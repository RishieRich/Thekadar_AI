# Thekedar AI — Contractor Operations Platform

A real-data labour contractor management platform built on React + Vite (frontend) and a plain Node.js HTTP server (backend). Each contractor logs in with their own credentials and manages their own isolated data — workers, sites, attendance, payroll, and invoices — completely separately from other contractors.

---

## What's In This Version

| Feature | Status |
|---|---|
| Multi-contractor login (credential-based, JWT session) | Done |
| Per-contractor isolated data store | Done |
| Dashboard — wages, net payable, invoice total, site summary | Done |
| Setup — company profile, compliance rates, sites, workers (add/edit/delete) | Done |
| Bulk CSV import for sites and workers (one-time setup) | Done |
| Attendance register — click to cycle P / A / HD / OT / WO | Done |
| Payroll breakdown with PF and ESI calculation | Done |
| Invoice with GST and service charge | Done |
| AI Chat via Grok (xAI API) | Done |
| Local file-based storage (no external DB needed for dev) | Done |
| Vercel deployment with Upstash KV storage | Done |

---

## Local Development Setup

### Prerequisites

- Node.js 18 or later
- npm

### Steps

```bash
# 1. Install dependencies
npm install

# 2. Copy the example env file and edit it
cp .env.example .env
# Edit .env — set contractor credentials and JWT_SECRET at minimum

# 3. Build the frontend
npm run build

# 4. Start the server
npm start
# Server runs at http://localhost:8787
```

For frontend hot-reload during development:

```bash
# Terminal 1 — backend
npm start

# Terminal 2 — Vite dev server (proxies /api to port 8787)
npm run dev
# Open http://localhost:5173
```

---

## Environment Variables

All variables live in `.env` (copy from `.env.example`). Never commit `.env` to git.

### Required for the app to work

| Variable | Description |
|---|---|
| `C1_USERNAME` | Login username for contractor 1 |
| `C1_PASSWORD` | Login password for contractor 1 (plain text, hashed internally) |
| `C1_ID` | Unique ID for contractor 1's data namespace (e.g. `c1`) |
| `C2_USERNAME` | Login username for contractor 2 |
| `C2_PASSWORD` | Login password for contractor 2 |
| `C2_ID` | Unique ID for contractor 2's data namespace (e.g. `c2`) |
| `JWT_SECRET` | Random secret for signing session tokens — **set a strong value in production** |

Generate a secure `JWT_SECRET`:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Required for AI Chat

| Variable | Description |
|---|---|
| `XAI_API_KEY` | Your xAI API key from console.x.ai |
| `XAI_MODEL` | Model to use (default: `grok-3-mini`). Verify available models in your xAI dashboard. |

AI Chat will show an error in the chat window if `XAI_API_KEY` is missing. All other features work without it.

### Required for Vercel production deployment

| Variable | Description |
|---|---|
| `KV_REST_API_URL` | Auto-set by Vercel when you connect a KV store |
| `KV_REST_API_TOKEN` | Auto-set by Vercel when you connect a KV store |

If these are not set, the app falls back to local file-based storage. On Vercel, the filesystem is read-only (ephemeral), so KV must be configured.

---

## Contractor Credentials Setup

Each contractor slot uses three env vars:

```
C1_USERNAME=ramesh_contractors
C1_PASSWORD=MySecretPass@2025
C1_ID=c1

C2_USERNAME=suresh_builders
C2_PASSWORD=AnotherPass@2025
C2_ID=c2
```

The password is stored only as a SHA-256 hash at runtime — the plain text never persists. The `C1_ID` / `C2_ID` value is used as the data namespace key; once set, do not change it or data will become unreachable.

---

## CSV Import (One-Time Setup)

Go to **Setup > Bulk Import from CSV**. Download the templates, fill them in, and upload.

### Sites CSV format

```
Site Name,Client Name,Location
Tema India,Tema India Pvt Ltd,"Achhad, Talasari"
Sudhir Brothers,Sudhir Brothers Ltd,Vasai
```

### Workers CSV format

```
Name,Role,Daily Wage,UAN,ESI Number,Site Name
Ramesh Patel,Fitter,650,100123456789,3112345678,Tema India
Suresh Yadav,Welder,750,100123456790,3112345679,Tema India
Dinesh Kumar,Electrician,700,100123456793,3112345682,Sudhir Brothers
```

**Notes:**
- `Site Name` in the workers CSV must match a site name exactly (case-insensitive).
- Workers with an identical name + site combination are skipped to prevent duplicates.
- Sites that already exist by name are skipped.
- After import, you can edit or delete any entry from the Setup tab.

---

## Deploying to Vercel

### Step 1 — Push to GitHub

```bash
git add .
git commit -m "production ready"
git push
```

### Step 2 — Import project in Vercel

1. Go to vercel.com and import your GitHub repository.
2. Vercel auto-detects Vite. No build settings need to change — `vercel.json` handles everything.

### Step 3 — Add Vercel KV (free storage)

1. In Vercel dashboard: **Storage > Create Database > KV**.
2. Create a store (free Hobby tier is sufficient for 2 contractors).
3. Click **Connect to Project** — this auto-adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` to your project env vars.

### Step 4 — Set environment variables

In Vercel dashboard under **Settings > Environment Variables**, add:

```
C1_USERNAME        your_contractor_1_username
C1_PASSWORD        your_contractor_1_password
C1_ID              c1
C2_USERNAME        your_contractor_2_username
C2_PASSWORD        your_contractor_2_password
C2_ID              c2
JWT_SECRET         (generate with the command above)
XAI_API_KEY        (from console.x.ai — optional, needed only for AI Chat)
XAI_MODEL          grok-3-mini
```

Do **not** manually set `KV_REST_API_URL` or `KV_REST_API_TOKEN` — Vercel sets those automatically from the KV store connection.

### Step 5 — Deploy

Click **Deploy** (or push a new commit). The app will be live at your `.vercel.app` URL.

---

## Data Storage Architecture

```
Local development          Vercel production
─────────────────          ─────────────────
data/
  c1/store.json    <-->    Upstash Redis key: store:c1
  c2/store.json    <-->    Upstash Redis key: store:c2
```

Each contractor's data is completely isolated. Data includes company profile, sites, workers, and all attendance records across all months.

**Important:** On first login for a new contractor ID, seed data (2 demo sites, 6 demo workers) is created automatically. Replace or delete it via the Setup tab.

---

## What Each Contractor Does Daily

1. Open the app URL and sign in.
2. Go to **Attendance** — tap cells to mark P / A / HD / OT / WO for each worker for the day.
3. Check **Dashboard** for live wage totals and site summaries.
4. At month end, go to **Payroll** for the full breakdown and **Invoice** for the client invoice.
5. Use **AI Chat** to ask operational questions in plain language.

---

## Important Things Before Going Live

### Passwords
- Passwords are SHA-256 hashed at runtime. Acceptable for a small internal tool.
- **JWT_SECRET must be a strong random value in production.** A weak secret allows session tokens to be forged.
- To change a password: update the env var in Vercel dashboard and redeploy.

### xAI Model Name
The default is `grok-3-mini`. Verify the exact model IDs available on your xAI plan at console.x.ai and update `XAI_MODEL`. If the model name is wrong, AI Chat will return an API error.

### Vercel KV Free Tier Limits
- 10,000 requests per day
- 256 MB storage
- For 2 contractors with daily use this is more than sufficient. Monitor usage in the Upstash dashboard if needed.

### No Automatic Session Expiry
JWT tokens are stored in browser localStorage and expire only when the user clicks Sign Out. If a device is lost, change the `JWT_SECRET` and redeploy — this invalidates all existing sessions.

### Data Backup
On Vercel, data lives in Upstash Redis. Export it periodically from the Upstash console (Data Browser > Export). For local dev, data is in `data/{id}/store.json` — back up that folder.

### Contractor ID Must Not Change
The `C1_ID` / `C2_ID` values map directly to the storage key. If you change `C1_ID` from `c1` to something else, contractor 1 will get a fresh (seed) dataset and the old data will be orphaned in the store under the old key.

---

## Project Structure

```
api/
  handler.js          Vercel serverless entry point
server/
  auth.mjs            JWT + credential authentication
  kv.mjs              Storage abstraction (file or Upstash)
  router.mjs          All API route handlers with auth middleware
  store.mjs           Multi-tenant data read/write
shared/
  payroll.js          Payroll calculation logic (shared frontend/backend)
src/
  App.jsx             Main React app (login, tabs, CSV import)
  api.js              Frontend API client (auth-aware)
  app.css             Styles
grok.mjs              xAI Grok chat integration
server.mjs            Local Node.js HTTP server
vercel.json           Vercel deployment config
.env.example          All required environment variables documented
```
