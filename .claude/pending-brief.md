---
doc_status: live
---

# Scope lock — Daily Log: booked jobs appear on their day

Approved by Trevor 2026-08-19. Supersedes the Build 2 lock that sat here — that
build shipped at `7779ee5`.

Code references and reasoning: [docs/briefs/dl-booked-jobs-appear.md](../docs/briefs/dl-booked-jobs-appear.md)
— **background; don't open it just to start the build.**

## Build

A job booked on a day in the Weekly Log appears on that day in the Daily Log by
itself, with its bench splits listed to pick from.

1. **Auto-appear.** For the day being shown, list every split whose booked date
   falls on that day, read from each part's `calendarSlot` — the same field the
   Weekly Log already reads. No new table, no new field.
2. **The parts list.** Each booked job shows its bench splits, exactly as the
   existing "+ Put a job on this day…" dropdown already lists them. Same text,
   same split-by-split granularity.
3. **A removed job stays removed.** An auto-appearing job must not come back on
   the next render or reload, or Remove is a button that does nothing.

## Out of scope — do not build

- **No editing of benches, splits or hours here.** That lives in the day view's
  job drawer and is deliberately not duplicated. Trevor: "it's already there in
  day view and we don't need duplication".
- **No time or schedule picker.** The DL has no times and is not getting any.
- **No writes to `jobs[]`, `scheduledSlots` or `calendarSlot`.** Read only.
- **Not the interactive status symbols** — separate, undecided, needs its own
  brief.

## Rules that bind this build

- **Read-only against job state.** If a change here would write to a
  blast-radius file, stop — it is out of scope.
- **Splits are shared, not per-day.** Nothing may make a split look day-local.
- **Check facts against the code, not this file.**

## Protocol step

Brief approved (step 1). **Not blast-radius** — read-only display — so it runs as
a supervised direct build, the same call Trevor made for the split-note fix.
Verify with the test suite plus a Vercel preview click-through.
