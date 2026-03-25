# README_Prep.md — Thekedar AI: Local Testing, Changes Plan & Hosting

> Working guide for testing locally, getting the Groq API key set up, planning today's work, and going live on Render for 2 real contractors.

---

## Part 1 — Run It Locally Right Now

### Prerequisites

- Node.js 18+ — check with `node -v`
- npm (comes with Node)
- A terminal (PowerShell or Git Bash on Windows)

### Step-by-Step

**Step 1 — Install dependencies**

```bash
npm install
```

**Step 2 — Create your `.env` file**

```bash
cp .env.example .env
```

On Windows cmd (if `cp` doesn't work):

```cmd
copy .env.example .env
```

**Step 3 — Fill in your `.env` file**

Open `.env` in VS Code or Notepad and set:

```env
PORT=8787

# Groq API key — see Part 2 below for how to get this
GROQ_API_KEY=gsk_your_key_here
GROQ_MODEL=llama-3.3-70b-versatile

# Data file location (leave as-is for local)
DATA_FILE_PATH=./data/db.json
```

**Step 4 — Build the frontend**

```bash
npm run build
```

**Step 5 — Start the server**

```bash
npm start
```

**Step 6 — Open in browser**

```
http://localhost:8787
```

You should see the Thekedar AI app. Currently it runs without a login screen (PIN auth is Task 2 — not yet built). Data is saved in `data/` as JSON files.

---

## Part 2 — Groq API Key Setup

### What is Groq and why Groq?

Groq (groq.com) is a fast AI inference platform with a **free tier** — no credit card required. The plan is to run `llama-3.3-70b-versatile` on Groq for the Hindi/Hinglish chat feature.

> NOTE: The current code in `grok.mjs` still uses xAI's API (XAI_API_KEY). Task 7 switches it to Groq. Once Task 7 is done, only GROQ_API_KEY will be needed.

### How to get a free Groq API key

1. Go to `https://console.groq.com`
2. Sign up with Google or email (free, no card needed)
3. Go to "API Keys" in the left sidebar
4. Click "Create API Key"
5. Copy the key — it starts with `gsk_`

### Where to put it

**For local testing:** In your `.env` file at the root of the project:

```env
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GROQ_MODEL=llama-3.3-70b-versatile
```

The `.env` file is already in `.gitignore` — it will never be committed to git.

**For production (Render):** In the Render dashboard as an environment variable — see Part 4.

### Current vs planned state

| State | API Provider | Env Var | File |
|---|---|---|---|
| Current code | xAI (api.x.ai) | XAI_API_KEY | grok.mjs |
| After Task 7 | Groq (groq.com) | GROQ_API_KEY | groq.mjs |

Until Task 7 is done, if you want to test AI Chat locally, you need an `XAI_API_KEY` from `console.x.ai`. After Task 7, only the Groq key is needed.

---

## Part 3 — Today's Action Plan

Follow the execution order from CLAUDE.md. Each task builds on the previous.

### Phase A — Foundation (do these first, in order)

#### Task 7 — Environment Variables (~30 min)

Goal: Clean up all config into `.env` so the app is deployment-ready.

- [ ] Update `.env.example` with `GROQ_API_KEY`, `GROQ_MODEL`, `DATA_FILE_PATH`, `APP_URL`
- [ ] Update `groq.mjs` to use `process.env.GROQ_API_KEY` instead of `XAI_API_KEY`
- [ ] Update `server.mjs` to read `PORT` and `DATA_FILE_PATH` from env
- [ ] Confirm `data/` is in `.gitignore` (already is)
- [ ] Create `data/seed.json` with initial 2-tenant structure (done as part of Task 5)

Test: `npm start` still works, chat still calls Groq correctly.

---

#### Task 2 — PIN Authentication (~2 hours)

Goal: Each contractor logs in with a 4-digit PIN and sees only their data.

- [ ] Change data store structure from flat to `{ tenants: { t1: {...}, t2: {...} } }`
- [ ] Add `POST /api/login` endpoint — validates PIN, returns tenant ID
- [ ] All API routes now require `x-tenant-id` header, return 401 if missing
- [ ] Build the PIN login screen in React (4 boxes, auto-advance, Hindi error message)
- [ ] Store tenant ID in `sessionStorage` after login
- [ ] Add Logout button

Test: PIN 1234 logs in as Contractor 1, PIN 5678 logs in as Contractor 2. Wrong PIN shows "Galat PIN. Dobara try karo."

---

#### Task 5 — Seed Data + Load from API (~1 hour)

Goal: Remove all hard-coded data from App.jsx, load everything from server.

- [ ] Remove hard-coded WORKERS, SITES arrays from `src/App.jsx`
- [ ] Call `GET /api/bootstrap?month=YYYY-MM` on login, populate UI from response
- [ ] Create seed data for Tenant 1: Rajesh Contractors (8 workers, 2 sites)
- [ ] Create seed data for Tenant 2: Sunil Labour Supply (6 workers, 2 sites)
- [ ] Server auto-seeds `db.json` on first boot from `data/seed.json`

Test: Fresh start (delete `data/db.json`), restart server, log in — both tenants show their own workers and sites.

---

### Phase B — UX (makes it actually usable on phone)

#### Task 1 — Mobile Layout (~1.5 hours)

Goal: App works on a 375px phone screen.

- [ ] Hide sidebar on mobile (`@media (max-width: 768px)`)
- [ ] Add fixed 56px bottom tab bar with 7 tabs
- [ ] Make top filter bar horizontally scrollable
- [ ] Ensure attendance grid scrolls horizontally with sticky first column
- [ ] Fix chat input for mobile keyboard (use `env(safe-area-inset-bottom)`)
- [ ] Add `padding-bottom: 56px` to main content on mobile

Test at 375px in Chrome DevTools — all tabs reachable, attendance grid scrollable, chat input visible when keyboard opens.

---

#### Task 3 — Chat Improvements (~1 hour)

Goal: Chat understands real Hindi/Hinglish contractor language.

- [ ] Rewrite system prompt in `groq.mjs` with full worker list, attendance data, and PF/ESI rules
- [ ] Instruct LLM to respond in Hinglish Roman script, not Devanagari
- [ ] Add action block parsing — when LLM returns an attendance update, execute it via API
- [ ] Test: "ramesh aaj nahi aaya" → confirmation → mark absent

---

### Phase C — Polish (do these last)

#### Task 4 — PWA (~45 min)

- [ ] Add `public/manifest.json`
- [ ] Add service worker at `public/sw.js`
- [ ] Add manifest and theme-color to `index.html`

#### Task 6 — Excel/PDF Export (~2 hours)

- [ ] Install: `npm install exceljs pdfkit`
- [ ] Add `/api/export/wages` endpoint → returns `.xlsx`
- [ ] Add `/api/export/invoice` endpoint → returns `.pdf`
- [ ] Wire frontend download buttons to these endpoints

#### Task 8 — Deployment (~30 min)

- [ ] Add `render.yaml` to repo root
- [ ] Push to GitHub
- [ ] Deploy on Render (see Part 4)

---

## Part 4 — Hosting on Render.com (Free)

Render is the recommended host for this project. It runs a persistent Node.js server (unlike Vercel free tier which is serverless-only), which means JSON file storage works and both the API and frontend are served from one place.

### Step-by-Step Render Deployment

**Step 1 — Push to GitHub**

Make sure your code is on GitHub (it already has a git remote set up):

```bash
git add .
git commit -m "ready for deploy"
git push origin main
```

**Step 2 — Create a Render account**

Go to `https://render.com` and sign up with GitHub (free).

**Step 3 — Create a new Web Service**

- Click "New" > "Web Service"
- Connect your GitHub repo
- Render will detect `render.yaml` automatically (after Task 8 adds it)

Or configure manually:
- Build Command: `npm install && npm run build`
- Start Command: `node server.mjs`
- Environment: Node
- Plan: Free

**Step 4 — Add environment variables in Render dashboard**

Under your service > "Environment":

| Key | Value |
|---|---|
| `GROQ_API_KEY` | your gsk_... key from groq.com |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` |
| `DATA_FILE_PATH` | `./data/db.json` |
| `NODE_ENV` | `production` |

**Step 5 — Deploy**

Click "Deploy". Render runs `npm install && npm run build && node server.mjs`.

**Step 6 — Get your URL**

Render gives you a URL like `https://thekedar-ai.onrender.com`. This is what you share with contractors.

Every future `git push origin main` triggers a re-deploy automatically.

### Important: Data persistence on Render free tier

The free tier has ephemeral disk — data resets if the service restarts. For 2 contractors in early testing this may be acceptable, but plan to upgrade to Render's $7/month paid tier (persistent disk) before going production, or switch to a small Upstash Redis (free tier, persistent).

---

## Part 5 — Sharing with Contractors

Once deployed, send each contractor:

```
App: https://thekedar-ai.onrender.com

Your PIN: 1234   (Contractor 1)
        or
Your PIN: 5678   (Contractor 2)

Steps:
1. Open the link on your phone
2. Enter your 4-digit PIN
3. Go to Setup — fill in your company details, add sites and workers
4. Go to Haziri — mark attendance daily
5. Go to Tankhwah — see wages calculated automatically
6. Go to Invoice — generate month-end bill
7. Chat tab — ask anything in Hindi or English

Tip: On Android Chrome, tap the menu (3 dots) > "Add to Home Screen"
to install it like an app on your phone.
```

---

## Quick Reference

### Local commands

```bash
npm install          # first time only
npm run build        # after any frontend changes
npm start            # start server at http://localhost:8787
```

### Restart after .env changes

```bash
# Ctrl+C to stop, then:
npm start
```

### Restart after frontend code changes

```bash
npm run build && npm start
```

### Files you will touch most today

| File | Purpose |
|---|---|
| `.env` | Local credentials and API keys |
| `groq.mjs` | AI chat — switch to Groq, improve prompt |
| `server/router.mjs` | Add /api/login, add x-tenant-id auth |
| `server/store.mjs` | Update for multi-tenant data structure |
| `src/App.jsx` | Login screen, mobile layout, remove hard-coded data |
| `data/seed.json` | Seed data for 2 tenants |
| `render.yaml` | Deployment config |
