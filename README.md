# Thekedar AI

Thekedar AI is currently a browser-based React + Vite demo for labour-contractor operations. This repository implements a single-page frontend that simulates March 2026 attendance, wage calculations, invoice math, worker records, and compliance reminders. The app mounts from `src/main.jsx`, and almost all application logic and UI live in `src/App.jsx`.

## What This Repository Contains Today

- A Vite + React frontend application
- A demo with hard-coded workers, sites, dates, and statutory values
- In-memory state only, with no persistence layer
- A Vercel deployment config for building the frontend

## What The App Does

The current UI is organized into these sections:

- `Dashboard`
- `AI Chat`
- `Haziri (Attendance)`
- `Tankhwah (Wages)`
- `Invoice / Bill`
- `Workers / Majdoor`
- `Compliance`

The implemented behavior currently includes:

- Site filtering for `All`, `Tema India`, and `Sudhir Brothers`
- A dashboard with worker totals, wage totals, invoice totals, attendance summaries, and compliance reminders
- A chat-style helper that answers keyword-driven queries for attendance, wages, invoice, PF, ESI, compliance, help, and worker lookups
- A March 2026 attendance grid where editable cells cycle through `P`, `A`, `HD`, and `OT`, while Sundays are seeded as `WO`
- Worker-level calculations for effective days, basic wages, overtime, PF, ESI, gross pay, and net pay
- A simulated invoice view with employer PF, employer ESI, 10% service charge, and 18% GST
- Worker cards showing role, site, wage, attendance percentage, gross pay, net pay, UAN, and ESI number
- A compliance screen with registration status cards, a filing calendar, and CLRA register items

## How The Demo Works

### Data

All business data is defined directly in `src/App.jsx`.

- `10` workers are hard-coded in the `WORKERS` array
- `2` sites are hard-coded in the `SITES` array: `Tema India` and `Sudhir Brothers`
- Attendance is seeded for March 2026 when the app loads

### Calculation Rules

The current wage and deduction logic uses these fixed rules:

- PF employee contribution: `12%`
- PF employer contribution: `12%`
- PF wage cap: `15000`
- ESI employee contribution: `0.75%`
- ESI employer contribution: `3.25%`
- ESI threshold: `21000`
- Overtime multiplier: `2`

### Behavior Notes

- Attendance seeding uses `Math.random()`, so the initial demo data can change after a refresh
- The `"today"` / `"aaj"` chat response also uses random present/absent selection
- Attendance changes are stored only in React state, so they reset on refresh
- The `Download PDF` and `WhatsApp karo` buttons currently show alert messages only

## What This Project Is Not

This repository does not currently include:

- A backend
- A database
- Authentication
- External business APIs
- Real AI or LLM integration
- Persistent storage
- Automated tests

## Runtime Stack

- `react`
- `react-dom`
- `vite`
- `@vitejs/plugin-react`

Repo-level runtime details:

- The project uses ES modules (`"type": "module"` in `package.json`)
- `index.html` loads `DM Sans` and `DM Mono` from Google Fonts
- `vercel.json` builds with `npm run build` and outputs to `dist`

## Project Structure

```text
.
|-- index.html
|-- package.json
|-- vite.config.js
|-- vercel.json
`-- src/
    |-- main.jsx
    `-- App.jsx
```

File roles:

- `index.html`: Root HTML document and font loading
- `src/main.jsx`: React mount point
- `src/App.jsx`: Demo data, calculations, chat logic, and main UI
- `package.json`: Scripts and dependencies
- `vite.config.js`: Vite configuration
- `vercel.json`: Deployment configuration

## Local Development

### Prerequisites

- Node.js
- npm

### Install

```bash
npm install
```

### Start The Development Server

```bash
npm run dev
```

### Create A Production Build

```bash
npm run build
```

### Preview The Production Build

```bash
npm run preview
```

## Deployment

`vercel.json` is configured with:

- Framework: `vite`
- Build command: `npm run build`
- Output directory: `dist`

## Current Limitations

- Core logic and UI are concentrated in a single `src/App.jsx` file
- Worker data, compliance data, invoice metadata, and dates are hard-coded
- The chat assistant is rule-based string matching, not model-backed AI
- Some strings in the source show character-encoding artifacts
- No `LICENSE` file is present in the repository
