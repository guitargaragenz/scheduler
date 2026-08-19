---
doc_status: live
---

# Handoff — WL day columns stopped responding (2026-08-20)

Branch `dl-auto-appear`, head `7bcb21e`. Not merged. **The live app is unaffected** —
everything below is preview-only.

## The bug — this is the whole job of the next session

Trevor: *"WL columns are broken now. clicking column symbols does nothing."*
Seen on the preview after the DL auto-appear build. Not reproduced or diagnosed —
the session was called out of the smart zone before that happened.

Only one change this build touched the Weekly Log: `o` / event was added to the
shared `MARKS` map in `src/components/BenchWeekPage.jsx` (~line 33), deliberately
NOT to `CYCLE` (~line 45). Start there.

Read before assuming, in `BenchWeekPage.jsx`:
- `nextMark()` (~47) — cycles `dot → slash → arrow → cross → '' → dot`.
- `cellMark()` (~325) — a stored mark wins; otherwise a booked day shows a
  derived `dot` that is **not** stored.
- `handleCell()` (~569) — bails with a toast when `ready` is false.
- The day `<button>` (~783).

Things worth ruling out first, cheapest first:
1. Is it silent, or is a toast appearing? "Not saving yet" means `ready` is false,
   which is a load problem, not a mark problem.
2. Does the mark save but the cell redraw the same? A booked day already shows a
   dot, so a store that lands on `dot` would look like nothing happened.
3. Does it fail on every row, or only rows that are auto-booked?
4. Was it ever working on this preview, or does it also fail on `main`? That
   splits "this build broke it" from "it was already broken".

Tests pass 664/664 and `vite build` is clean, so whatever this is, no test covers
it. Add one once it's understood.

## What shipped and works on this branch

- Jobs booked on a day appear in the Daily Log by themselves, one line per bench
  split, each with its own session note.
- Removing an auto row writes a `hidden` row in `bench_day_marks` (deleting can't
  work — for an auto row, an absent row is what makes it appear).
- Per-row notes in the DL, stored as `note:<itemId>:<rand>` rows.
- The DL's mark is **its own**, stored as a `mark:<itemId>` row. It does NOT touch
  `week_marks`. Trevor's rule: nine times in ten a DL row is a split or a task,
  not the whole job, so ticking it must never tick the job off the Weekly Log.
  The WL keeps the one master mark. Do not re-wire these together.
- A job added to the week **by hand** has no `calendarSlot`, so it had no day for
  the DL to place it on. The week mark now counts as the booking, and it shows as
  one line for the whole job (a week mark sits on the job row — there is no
  split-level day to read).

No schema changes anywhere. `bench_day_marks.kind` is free text with no CHECK
constraint, which is why `hidden` / `note` / `mark` needed no migration.

## Preview

Always the latest commit on the branch:
https://ggnz-scheduler-git-dl-auto-appear-trevor-collings-projects.vercel.app

## Next

Fix the WL columns, browser-test the preview, then merge on Trevor's "yp".
The scope lock is `.claude/pending-brief.md` — read that, not this file, to know
what the build is allowed to touch.
