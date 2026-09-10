# A job completes on the day it was finished, not the day it was ticked

doc_status: live

## What to build

Carry the finished day from the Week page into the revenue record.

1. `handleMarkDone(job, amount, finishedOn)` in `src/hooks/useJobs.js` takes an
   optional third argument: a local `YYYY-MM-DD` date.
   - Supplied: `completedAt` is built from that date and `weekKey` is
     `localDateKey(getWeekDays(<that date>)[0])`.
   - Omitted or null: behaviour is exactly as today (now / current week).
2. `handleClose(row)` in `src/components/BenchWeekPage.jsx` finds the LAST day
   column marked × by scanning `weekKeys` backwards with `cellMark`, BEFORE the
   `setMark` write — do NOT call `ruleOff`, which is gated on the close mark and
   reads a stale `marks` snapshot, so it returns null on this very press. The
   scan gives an INDEX; the date is `weekKeys[i]`. No × found: pass null and
   today applies. Then `onCloseJob?.(row.job, dateKey)`.
3. `src/App.jsx:862` accepts that second argument and holds it in new state
   beside `pomoJob` (the drawer's job is re-resolved from `jobs`, so the date
   cannot ride on the job object). Set it to null EVERY other place the drawer
   opens or closes — `App.jsx:355`, `:958`, `:989`, and every `setPomoJob(null)`
   — or a stale date leaks onto the next job invoiced.
4. `src/App.jsx:1109` passes it through: `onMarkDone={(j, amt) =>
   jobOps.handleMarkDone(j, amt, <that state>)}`. A drawer opened any other way
   has null there, so a live pomodoro session still means today.
5. `localDateKey`, never `toISOString()`. NZ is UTC+12/+13 and UTC conversion
   rolls Monday-local-midnight back into the previous week.

## Why

Trevor closed job 1632 on Friday 4 Sept. The × saved the right day but writes no
revenue. The invoice tick writes revenue but stamps today and the viewed week, so
$569.89 landed on 7 Sept, the wrong week. Only the date is wrong.

## Out of scope

- Do NOT make removing an × un-invoice a job. Decided against 2026-09-10.
- Do NOT change `appendCompletedJob`. Its refusal of a second write is
  deliberate; a wrong AMOUNT stays a by-hand database fix.
- No date picker, no backdating past the day the × sits in, no schema change.
- Leave the `CloseDayModal`, `CatchUpInterview` and `useDailyLog` callers alone.
- Do not touch `pdfImportPlan.js` (job 1740) or rewrite the 2026-09-07 rows.

## Rules that bind this build

- Revenue writes stay wired to a toast. The two ×'s stay separate.
- Blast-radius: `jobs[]` shape, `utils/supabase.js`. Full protocol, no steps
  skipped: council → builder → verifier → browser test → merge.
