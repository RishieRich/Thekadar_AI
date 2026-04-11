# Agents

This folder is reserved for agentic AI logic — Python or Node.js agents that perform
multi-step tasks autonomously.

## Planned agents

- `attendance_agent/` — watches for chat commands and marks attendance via API
- `payroll_agent/` — generates month-end payroll summaries automatically
- `compliance_agent/` — checks PF/ESI filing deadlines and sends reminders
- `report_agent/` — schedules and emails Excel/PDF reports at month-end

## Integration pattern

Agents call the backend REST API (`/api/*`) using the contractor's auth token.
They do not import backend modules directly — they are separate processes.

## Python setup (when ready)

```
agents/
  requirements.txt
  attendance_agent/
    __init__.py
    agent.py
  payroll_agent/
    __init__.py
    agent.py
```
