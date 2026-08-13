---
doc_status: live
---

# Scope lock — bench view Build 1b: add a job to the week

Build 1 (the week page) shipped at `a83c334`, but the page cannot be filled by hand — a job
only appears if it already had a calendar slot that week (`BenchWeekPage.jsx:93`) or already
carried a mark. This build closes that. Background is in
[docs/briefs/bench-view.md](../docs/briefs/bench-view.md) — **background only, do not open it
to start this build.**

Trevor plans the week on Sunday, as the week ahead. He picks from that week each night onto
the day page. So the week page must stand alone: on Sunday there are no day pages yet.

## In scope

**A per-bench dropdown on the week page.** Trevor opens a bench, sees the jobs sitting on it,
picks one, and it drops in as a row under that bench group. He then marks its days exactly as
he does now.

- The dropdown lists jobs on that bench that are not already a row this week and not `done`.
- Adding a job writes **only** a mark, into the existing `bench_week_marks` table. That mark is
  what makes `weekRows()` keep the row (`hasMarkThisWeek`).
- Removing a job from the week is clearing its marks — no separate delete path.

## Out of scope

A type-to-search box for job number or manufacturer — deliberately rejected, the bench list is
enough · any change to the marker symbols or the tap-cycle · the day page · the exported log ·
automatic scheduling or slot-filling · deleting the parked scheduling code · writing to Google
Calendar · any change to how splits are defined.

## Rules that bind

- One row per job, never one per split. That is settled and is not reopened here.
- Nothing is written to `jobs[]`, `scheduledSlots` or `calendarSlot`. Marks only.
- The Google Calendar read stays a read.
- Answer for this build, in writing: **how does a thing get created, changed and removed?**
- Full protocol: council → staging branch → `ggnz-verifier` → browser test → Trevor merges.
