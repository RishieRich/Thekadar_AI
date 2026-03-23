# Thekedar AI

## Current Status

This repository is no longer the original hard-coded frontend demo.

It is now a small full-stack MVP for labour-contractor operations with:

- a React + Vite frontend
- a local Node HTTP API server
- JSON-file persistence on disk
- shared payroll and attendance logic used by both frontend and backend
- an optional Grok-backed chat endpoint that keeps the API key on the server

The current setup is suitable as a local or single-instance MVP. It is not yet a multi-tenant production system.

## What The App Currently Does

The UI currently provides these sections:

- `Dashboard`
- `Setup`
- `Attendance`
- `Payroll`
- `Invoice`
- `AI Chat`

Implemented behavior:

- Edit contractor/company details
- Edit payroll and invoice rules such as PF, ESI, GST, service charge, and OT multiplier
- Add, edit, and delete sites
- Add, edit, and delete workers
- Store month-wise attendance per worker
- Calculate payroll from attendance and configured rules
- Generate invoice totals from payroll outputs
- Filter views by month and site
- Ask Grok questions about the currently loaded contractor data

## Architecture

### Frontend

- `src/App.jsx`
  Main React app and current UI shell.
- `src/api.js`
  Thin fetch wrapper for the backend API.
- `src/app.css`
  Application styling.
- `src/main.jsx`
  React entry point.

The frontend calls `/api/*` routes and does not contain any hard-coded business data anymore.

### Backend

- `server.mjs`
  Local Node HTTP server. Exposes the REST API and can also serve the built frontend from `dist/`.
- `server/store.mjs`
  File-backed storage layer. Creates `data/store.json` on first run and seeds it with sample company, sites, workers, and attendance.
- `grok.mjs`
  Server-side Grok integration. Sends current company/site/worker/month context to the xAI API.

### Shared Business Logic

- `shared/payroll.js`
  Shared attendance helpers, payroll rules, totals, and invoice calculations. This is the main source of truth for business math in the repo.

## Persistence Model

The app stores data in a local JSON file:

- `data/store.json`

This file is created automatically by the server on first run and is ignored by git.

Stored entities:

- `company`
- `sites`
- `workers`
- `attendance`

Attendance is stored by month key in `YYYY-MM` format.

If a month or worker has no stored attendance yet, default attendance is generated in memory with:

- Sundays defaulting to `WO`
- other days defaulting to `A`

## Current API Surface

The backend currently exposes these routes:

- `GET /api/health`
- `GET /api/bootstrap?month=YYYY-MM`
- `PUT /api/company`
- `POST /api/sites`
- `PUT /api/sites/:id`
- `DELETE /api/sites/:id`
- `POST /api/workers`
- `PUT /api/workers/:id`
- `DELETE /api/workers/:id`
- `PUT /api/attendance`
- `POST /api/chat`

`/api/bootstrap` is the main frontend bootstrap call. It returns:

- company
- sites
- workers
- attendance for the selected month

## Grok Integration

The Grok integration is server-side only.

Required environment variable:

- `XAI_API_KEY`

Optional:

- `XAI_MODEL`
- `PORT`

See `.env.example`.

The chat flow currently works like this:

1. The frontend sends conversation messages plus the selected month and site filter.
2. The backend rebuilds current business context from local data.
3. `grok.mjs` sends that context to xAI.
4. The assistant reply is returned to the frontend.

The system prompt instructs Grok not to invent missing business facts.

## Frontend Behavior Notes

- Month selection is based on `YYYY-MM`.
- Attendance cells cycle through `P`, `A`, `HD`, `OT`, and `WO`.
- Payroll and invoice values are recalculated from current state on every render.
- Site filtering affects the currently displayed payroll, invoice, attendance, and dashboard values.
- The frontend expects the API server to be available at `/api`.

## Development Workflow

### Install dependencies

```bash
npm install
```

### Run the backend

```bash
npm run server
```

This starts the Node API on `http://localhost:8787` by default.

### Run the frontend

In another terminal:

```bash
npm run dev
```

Vite is configured to proxy `/api` to `http://localhost:8787` during development.

### Build the frontend

```bash
npm run build
```

### Serve built frontend plus API from one process

After building:

```bash
npm run start
```

`server.mjs` will serve API routes and static files from `dist/`.

## Current File Layout

```text
.
|-- .env.example
|-- .gitignore
|-- grok.mjs
|-- index.html
|-- package.json
|-- package-lock.json
|-- README.md
|-- server.mjs
|-- server/
|   `-- store.mjs
|-- shared/
|   `-- payroll.js
`-- src/
    |-- App.jsx
    |-- api.js
    |-- app.css
    `-- main.jsx
```

Generated and intentionally not kept in the repo:

- `node_modules/`
- `dist/`
- `data/`

## Important Cleanup Notes

This repo has been cleaned to remove stale or non-essential items from the working tree, including generated output and editor-specific files. The codebase should now reflect only the source files needed to understand and continue the app.

## Known Limitations

- No authentication or user isolation
- No real database yet; persistence is local JSON only
- No PDF generation or export pipeline
- No WhatsApp or external business integrations
- No automated tests
- No schema migration layer for persisted data
- No deployment configuration for a real hosted backend yet

## Best Next Steps For The Next LLM

If another model continues from here, the most natural next work items are:

1. Replace JSON-file persistence with a real database.
2. Add authentication and contractor/user separation.
3. Add validation and error-handling hardening around API writes.
4. Add invoice export and attendance/payroll export flows.
5. Add tests for `shared/payroll.js` and the API routes.
