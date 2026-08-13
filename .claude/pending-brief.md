---
doc_status: live
---

# Scope lock — Build 2: the Daily Log

Checklist and history: [docs/briefs/bench-view.md](../docs/briefs/bench-view.md) —
**background; don't open it just to start the build.**

## Build

One new page — tomorrow — holding three things:

1. **Appointments** — read-only from Google Calendar via `listEvents()`. No writes, ever.
2. **Tasks** — free text. No status, no job links.
3. **Jobs** — pick a job's existing splits onto the day. 3–5 typical, no cap.

It is the **Daily Log**, a full peer of the Weekly Log — a record of what was done. Trevor
marks here as well as on the week page, and adds free-text tasks like the Admin typed rows
(Build 1c). Not a read-only view of the week.

## Rules that bind the build

- **Name the two pages "Weekly Log" and "Daily Log"** in headings and page titles. On the
  nav pills they read **"W Log"** and **"D Log"** — the pills are too small for the full
  words. Filenames can stay as they are.
- **The Daily Log can only offer jobs already on the current Weekly Log.** No job-number
  search. Not on the week, can't go on a day.
- **Closing a job is the `×` in the final `>` column, and nothing else.** That is the only
  place the invoice amount is asked — existing `PomoDrawer` prompt → `handleMarkDone(job,
  amount)` (`src/hooks/useJobs.js:326`). Never a silent `done: true`, no second invoicing UI.
  No Cancel button: closing is a deliberate manual cross, not automatic.
- **The final column becomes a real tap target with its own stored value**, decoupled from the
  day cells (it is derived from them today). Strikethrough follows it, not the day marks.
- **A day-column `×` is a plain mark** — worked and finished that day. No money question, no
  `done`, no strikethrough.
- **A marked job stays on the week until it is closed** — never dropped by a source-list or
  filter change.
- **A done split stays done.** Store the split's own text at tick time, never a live pointer.
- Day picks and tasks live in **their own table keyed by date** (same pattern as
  `bench_week_marks`). No second write path into `jobs[]`, `scheduledSlots` or
  `calendarSlot` — the existing done/revenue call is the one allowed write.
- Mobile: one page at a time, never side by side.
- The 12-hour glue rule is **not enforceable** — Trevor maintains it. Don't invent a check.

## Not in scope

- Restarting the parked scheduler. `AUTO_BUMP_ENABLED = false`
  (`src/hooks/useGoogleCalendar.js:26`) stays false; the 30s poll stays read-only.
- `DailyLogPage.jsx` — the old scheduler day view, a different page.
- The exported week log (readable document). Separate build.
- Any change to existing Supabase tables, `calendarSlot`, or the `jobs[]` shape beyond the one
  existing `handleMarkDone` write.
