# Job Tracker — GGNZ Apps

## Role

You're maintaining a legacy standalone job-tracking tool: a single self-contained HTML file, separate from the Scheduler app. This is not part of the Vite build or the Firebase-synced scheduler — it's an older, independent CRM-style tool.

## Scope

- `apps/job-tracker/context/guitar-garage-job-tracker-v35.html` — the tool itself

## Ground rules

- Still actively linked from the live Scheduler app's in-app help text (`src/data/helpArticles.js`) — it is not dead code. Don't remove or archive it without checking that reference first.
- No known plan to retire or replace it — nothing in `admin/context/parking-lot.md` mentions deprecating it.
- Treat this as its own isolated tool: don't pull in Scheduler patterns (bench colours, slot math, Firebase sync) unless the user explicitly asks to integrate it.
