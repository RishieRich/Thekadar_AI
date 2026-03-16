# Thekadar_AI

Thekadar_AI is a front-end simulation of a contractor personal agent system. The current codebase is a browser-based React demo focused on labour operations, attendance, payroll, invoicing, worker records, and compliance tracking.

## Current Status

This repository is no longer just a placeholder. It already contains a working Vite + React simulation with hard-coded demo data.

- Single-page React app
- Contractor workflow simulation for March 2026
- Rule-based chat assistant for common labour and payroll questions
- Vercel deployment config included

## What The Demo Currently Does

- Shows a dashboard with worker totals, gross wages, net payable, invoice totals, attendance, and compliance reminders
- Provides an AI chat style panel for attendance, wages, invoice, PF, ESI, compliance, and worker queries
- Lets you toggle attendance states in a muster-roll style table
- Calculates wages, overtime, PF, ESI, gross pay, and net pay for each worker
- Generates a simulated invoice summary with service charge and GST
- Displays worker cards with site, wage, identity details, attendance, and pay results
- Tracks statutory items like PF, ESI, CLRA returns, and wage payment deadlines

## Tech Stack

- React 18
- React DOM 18
- Vite 5
- Inline component styling inside `src/App.jsx`
- Vercel for deployment

## Project Structure

- `index.html` - Vite entry HTML
- `src/main.jsx` - React mount point
- `src/App.jsx` - main simulation UI, hard-coded worker data, calculations, and chat logic
- `package.json` - scripts and dependencies
- `vite.config.js` - Vite config
- `vercel.json` - deployment config

## Simulation Modules In The Current App

The current interface contains these main sections:

- `Dashboard`
- `AI Chat`
- `Attendance`
- `Wages`
- `Invoice`
- `Workers`
- `Compliance`

The app also includes:

- 10 sample workers
- 2 sample sites: `Tema India` and `Sudhir Brothers`
- seeded attendance for March 2026
- worker-wise wage and deduction calculations
- site-level filtering

## Business Rules In The Simulation

The current calculations in `src/App.jsx` use these rules:

- PF employee contribution: `12%`
- PF employer contribution: `12%`
- PF wage cap: `15000`
- ESI employee contribution: `0.75%`
- ESI employer contribution: `3.25%`
- ESI threshold: `21000`
- Overtime multiplier: `2`
- Sundays are auto-marked as `WO`

## Running The Project Locally

### Prerequisites

- Node.js 18 or newer
- `npm`

### Development

```bash
npm install
npm run dev
```

Open the local Vite URL shown in the terminal, usually `http://localhost:5173`.

### Production Build

```bash
npm run build
npm run preview
```

## Deployment

The repository includes a `vercel.json` configured for a Vite build:

- Build command: `npm run build`
- Output directory: `dist`

## Current Limitations

- All major UI and simulation logic are inside a single `src/App.jsx` file
- There is no backend, database, login, or API integration
- The chat assistant is keyword-based and not connected to a real AI model
- Data is hard-coded for demo use
- No automated tests are present
- Some UI text appears to have character encoding artifacts and should be cleaned up

## Recommended Next Steps

1. Split `src/App.jsx` into smaller feature components
2. Move data and payroll logic into separate modules
3. Replace keyword chat with an actual AI or API-backed assistant
4. Add persistence for attendance, wage sheets, and invoice state
5. Add tests for payroll and compliance calculations
6. Improve text encoding and clean up UI copy

## Contributing

Use focused branches and clear commits. If the simulation grows, add issue templates, contribution guidelines, and a pull request checklist.

## License

No license file is currently present in the repository. Add a `LICENSE` file when you are ready to define reuse and distribution terms.
