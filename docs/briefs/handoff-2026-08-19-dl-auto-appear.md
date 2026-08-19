---
doc_status: live
---

# Handoff — start the DL auto-appear build (2026-08-19)

Written because the previous session ran long and misfired several times. Nothing
below is held in chat history; it is all in files.

## Start here

1. Read the scope lock: `.claude/pending-brief.md`. It is approved and current.
2. **Audit the brief before building it — Trevor asked for this explicitly.**
   The last session got the same feature wrong three times, so do not treat the
   lock as trustworthy just because it is approved. Check each factual claim
   against the live code:
   - does `weekRows()` still read `calendarSlot` via `slotDateKey` to decide
     booked days? (`BenchWeekPage.jsx`, around lines 254-259)
   - does `dayJobOptions()` in `DailyLogPanel.jsx` still build the per-split
     option list?
   - does `removeItem()` in `useDayMarks.js` still delete the row rather than
     write an empty one?
   If any of these has moved, **fix the lock first**, then build.
3. Background, if the lock leaves a question open:
   `docs/briefs/dl-booked-jobs-appear.md`. Do not open it just to start.

## What the build is, in one line

A job booked on a day in the Weekly Log turns up on that day in the Daily Log by
itself, with its bench splits listed to pick from. Read-only against job state.

Editing benches/splits/hours is **out** — that already exists in the day view's
job drawer and Trevor does not want it duplicated. No time picker.

## Why the last session kept missing

The feature was described as "a status column like the WL". Each round guessed a
different size — read-only mirror, dot-only, clickable — because nobody pinned
down *where a click gets saved*. Lesson for this build: before writing code, be
sure whether a thing is **displayed** or **stored**. They are different builds.

## State of the repo

- Branch: `claude/next-steps-ypfyjy`, pushed.
- **PR #25 is open and draft — do not merge it.** It carries the doc updates plus
  a read-only status dot that Trevor has NOT accepted. Its fate depends on an
  undecided question (below).
- The split-note fix is already merged to main (`e99e9fe`, PR #24). Done.
- The live app URL is now recorded in `CLAUDE.md`: https://ggnz-scheduler.vercel.app

## Still undecided — do not build, do not guess

Trevor wants the DL status symbols **clickable and cycling like the Weekly Log**.
The open question he is sleeping on: must the marks **persist across reload and
devices**?

- Yes → needs a mark field on `bench_day_marks`, whose write lives in
  `utils/supabase.js` → **blast-radius → full agent-team protocol**.
- No → pure UI, one edit, marks lost on refresh.

Ask him before touching it. Do not fold it into the auto-appear build.
