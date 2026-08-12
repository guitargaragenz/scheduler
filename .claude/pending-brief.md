---
doc_status: closed
---

# Scope lock — bench view Build 1: the week page

**Shipped at `a83c334` (2026-08-13). Finished history — not a task list.**

First of two builds. Build 2 (the day page) is a separate scope lock in a later session — its
scope is parked in [docs/briefs/bench-view.md](../docs/briefs/bench-view.md), along with the
background and the council record. **Background only, do not open it to start this build.**

Trevor picks the jobs. The app never decides a schedule.

## In scope

This week's jobs grouped by bench, showing **just the job name** (eg `1714 Fender Strat`).
**One row per job, never per split.** Columns M T W T F S S, then a trailing `>` column.

Markers: `·` booked, `/` worked that day, `>` not worked so move on, `×` done.

A row shows `/` on every day any part of the job was worked. `×` goes in only on the day the
**final** part of the job is finished. That `×` automatically fills the trailing column and
draws a line joining the two, striking the row through from that day to the end — never
marked by hand. The trailing column otherwise takes `>` to carry the job to next week.

A week can be **exported as one plain readable file**. No Drive writing, no second copy of
the data.

Mobile: full-screen single page, matching the existing mobile pages.

## Out of scope

The day page, appointments, tasks and split-picking (all Build 2) · automatic scheduling or
slot-filling · deleting the existing scheduling code (parked, not removed) · writing to
Google Calendar · new revenue logic · invoice capture · any change to how splits are defined.

## Rules that bind

- **Turn off the calendar's automatic job-moving.** `useGoogleCalendar.js` polls every 30s
  and rewrites job slots today. Parking the scheduler means disabling that poll, not just
  avoiding it.
- Week marks live in **their own table**, keyed by job and date. Nothing is written to
  `jobs[]`, `scheduledSlots` or `calendarSlot`.
- Nothing is deleted. The scheduling side is parked and reversible.
- A job number reappearing is live work by definition.
- **Glue timing is Trevor's call, not the app's** — the data cannot flag glue steps, so the
  app must not pretend to enforce the 12-hour gap.
- Full protocol: council → staging branch → `ggnz-verifier` → browser test → Trevor merges.
