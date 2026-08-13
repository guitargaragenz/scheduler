---
doc_status: live
---

# Scope lock — Build 2: the day page

Replaces the empty lock left after Build 1c (merged `366af58`). The verifier checklist and the
design history live in [docs/briefs/bench-view.md](../docs/briefs/bench-view.md) — **background;
don't open it just to start the build.**

## Build

One new page — tomorrow's day — holding three things:

1. **Appointments** — read-only from Google Calendar via `listEvents()`. No writes, ever.
2. **Tasks** — free text. No status, no job links.
3. **Jobs** — pick a job's existing splits onto the day. 3–5 typical, no cap.

## Rules that bind the build

- **The day page can only offer jobs already loaded on the current bench week page.** No
  job-number search, no picking from the full jobs list, no way to add a job that isn't on the
  week. If it's not on the week, it can't go on a day.
- **Closing a job is the `×` in the final `>` column, and nothing else.** That is the only
  place the invoice amount is asked — existing `PomoDrawer` prompt → `handleMarkDone(job,
  amount)` (`src/hooks/useJobs.js:326`). Never a silent `done: true` with no figure, no second
  invoicing UI. No day page and no split-ticking is needed to close a job.
- **A day-column `×` is a plain mark** — work done that day, no money question. It stays
  tappable; the cycle keeps `×` (`CYCLE`, `src/components/BenchWeekPage.jsx:42`). This replaces
  the earlier rule that made the week page's `×` read-only.
- **A marked job stays on the week until it is closed.** It never drops off because its source
  list changed or it stopped matching a filter. Closing is the only thing that removes it.
- **A done split stays done.** Store the split's own text at tick time, never a live pointer.
  (Why: auto-split ids rot on reimport — see background doc.)
- Day picks and tasks live in **their own table keyed by date**, same pattern as
  `bench_week_marks` (`src/utils/supabase.js:1849`). No second write path into `jobs[]`,
  `scheduledSlots` or `calendarSlot` — the existing done/revenue call is the one allowed write.
- Mobile: one page at a time, week and day switched between, never side by side.
- The 12-hour glue rule is **not enforceable** — nothing in the splits data flags a glue step.
  Trevor maintains it himself. Don't invent a check.

## Not in scope

- Restarting the parked scheduler. `AUTO_BUMP_ENABLED = false`
  (`src/hooks/useGoogleCalendar.js:26`) stays false; the 30s poll stays read-only.
- `DailyLogPage.jsx` — that's the old scheduler day view, a different page.
- The exported week log (readable document). Separate build.
- Any change to existing Supabase tables, `calendarSlot`, or the `jobs[]` shape beyond the one
  existing `handleMarkDone` write.
