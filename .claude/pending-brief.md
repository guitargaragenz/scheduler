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
  "Already a row" is checked by **job id across the whole week**, not per bench group — a job
  split across two benches must not still be addable under the other one.
- **An added job's row is blank.** Trevor decides days later, by tapping cells as he does now.
  Adding must not write a dot, or any day symbol, anywhere. Settled 2026-08-13 — council found
  the design as first written had no legal way to do this.
- To hold a blank row, adding writes one row to the existing `bench_week_marks` table under a
  **week-scoped key that is not one of the seven day keys** (e.g. `week:<monday>`). `weekRows()`
  keeps the row on that key as well as on day marks; `cellMark()` and `buildWeekExport()` only
  ever walk the seven day keys, so it draws and exports as blank. No new marker symbol.
- Removing a job from the week is **one clearly labelled action on the row** that clears its day
  marks and that week key together. Not "tap every cell blank until it disappears."
- Jobs with no bench set get no dropdown and cannot be added this way. Accepted, not a bug.

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
