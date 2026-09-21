---
name: navopath-schedule
description: Use when the user asks to add, arrange, inspect, or move a task or calendar entry in their NavoPath account through the configured NavoPath MCP server.
---

# NavoPath Schedule

Turn a scheduling request into a conflict-checked, auditable NavoPath change with as little clarification as correctness allows.

## Connection

Use the MCP server named `navopath`. If it is unavailable or unauthenticated, stop before changing data and ask the user to install the skill and configure the account-specific MCP connection from NavoPath **Settings → Calendar & Integrations → MCP**. Never request the user's NavoPath password.

Treat the MCP bearer token as a secret. Do not repeat it, log it, save it in a project, or commit it to version control.

## Add a schedule

1. Extract the title, date, start time, duration or end time, project, and notes from the request. NavoPath's scheduling timezone is `Asia/Shanghai`; convert times from another explicitly named timezone before writing.
2. Ask one concise question only when the title, date, or start time cannot be resolved. If duration is omitted, use 30 minutes and mention that default in the result.
3. Start times and durations must use 15-minute increments. If an explicit request is off-grid, offer the two nearest valid choices instead of silently rounding it.
4. Call `list_calendar` for the resolved date before writing. Treat the same title at the same start time as a likely duplicate; do not create it again without confirmation.
5. If the user names a project, call `list_projects` and use its exact ID. Ask only when multiple projects plausibly match. A schedule can remain unassigned when no project was requested.
6. Prefer `batch_update_tasks` for a new scheduled task. First preview with `dry_run: true` and `commit: false`; then commit the same operation with `dry_run: false`, `commit: true`, and the same unique `idempotency_key`. Use an operation shaped like:

```json
{
  "type": "create_task",
  "title": "Physics revision",
  "projectId": "project-id-if-requested",
  "dueDate": "2026-09-22",
  "startTime": "15:00",
  "durationMinutes": 60,
  "notes": "",
  "reason": "Added from the user's explicit scheduling request"
}
```

7. If preview reports `SCHEDULE_CONFLICT`, do not commit. Summarize the conflict and ask whether to use a nearby free time.
8. Report success only after the commit returns `applied: true`. Include the title, absolute date, start–end time, project when applicable, and whether the 30-minute default was used.

## Inspect or move a schedule

- Use `list_calendar` for calendar questions and `list_tasks` when task identity is ambiguous.
- Use `reschedule_task` for an existing task, with a fresh idempotency key and a short reason.
- If a locked schedule or hard deadline returns `confirmationRequired`, explain the protected change and wait for explicit confirmation before calling `confirm_change`.
- Never use `delete_task` unless the user explicitly asks to delete the task.

## Examples

- “把明天下午 3 点的物理复习加到 NavoPath，1 小时。”
- “Schedule a 30-minute UCAS review next Friday at 18:15.”
- “Move my chemistry lesson to Saturday at 10:00.”
