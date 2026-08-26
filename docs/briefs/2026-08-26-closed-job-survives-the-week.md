---
doc_status: closed
---

# A job closed this week must survive the week

**Shipped 2026-08-26 at `5310f8e` (PR #46).** Record of what happened — not a task
list. The checklist below was run and passed 12/12; do not re-run it as work.

Found 2026-08-26, chasing job 1679: closed on Monday 24/8, then gone from the
Weekly Log by Wednesday, and showing on the Daily Log as a bare header with no
lines under it.

## What actually happens

1. Trevor closes 1679 in the Weekly Log. `handleClose()` writes a
   `close:2026-08-24` mark into `bench_week_marks` and marks the job `done`.
   That mark exists for exactly one reason: a job closed this week stays on the
   page, struck through, until the week rolls over.
2. A finished job drops off the next Multitrack printout.
3. The next PDF import sees 1679 is not in the printout, so it **departs** it —
   `departed_at` is stamped on the row (`writeDepartureBatch`).
4. `normalizeJobsFromDb()` filters every departed row out of `jobs[]`.
5. `weekRows()` builds its rows by walking `jobs[]`. No job, no row. The
   `close:` mark is still sitting in the table; nothing reads it, because the
   job it belongs to no longer exists as far as any screen is concerned.

Nothing is lost — the job row, the close mark and the revenue record are all
intact. The job just leaves the week early.

**The rule this breaks:** a completed job stays visible to the end of the WEEK,
not the end of the day. Confirmed by Trevor 2026-08-26; it has come up before.

## The fix

One change, in the plan builder, not in the writer:

`buildPdfImportPlan()` must not put a job in `departures[]` if that job carries
a close mark for the **current week**. It departs on a later import, once the
week has rolled over and the mark no longer refers to this week.

This means `buildPdfImportPlan()` needs the week marks and the current week's
Monday. It is a pure function and stays one — they come in as arguments, the
same way `knownJobIds` does.

Why here and not in `weekRows()`: making the Weekly Log draw rows for departed
jobs would mean reading jobs the whole app has agreed are invisible, on every
screen that shares that row builder. Holding the departure back for a few days
is smaller, reversible, and matches what the close mark already means.

## Out of scope

- Anything that changes what `departed_at` means, or un-departs existing rows.
  1679 stays departed; this fix stops the NEXT one going early.
- Making `bench_day_marks` store the day's automatic rows (the known gap from
  the 2026-08-26 Daily Log brief). Still separate, still not this.
- The Weekly Log 1000-row read cap. Still parked.
- Any change to `weekRows()`, `bookedOnDay()` or the Daily Log.

## Rules that bind this build

- **A completed job never comes back.** A job number reappearing on a printout
  is live work, and the existing returning-job path already handles that. This
  fix must not touch it.
- The import's count refusal, duplicate refusal and `canDepart` gate all stay
  exactly as they are. A failed `knownJobIds` read still departs nothing.
- Departures still only ever come from the Multitrack printout
  (`writeDepartureBatch` refuses any other source). Unchanged.
- No writes to `jobs`, `scheduled_slots` or `calendarSlot` beyond what the
  import already does.
- The preview screen must show the truth: a job held back is simply not in the
  "no longer in this drop" list Trevor approves.

## Verification checklist

1. A job on the board, not in the printout, with **no** close mark → departs,
   exactly as today.
2. A job not in the printout, with a close mark for the **current** week → is
   NOT in `departures[]`, and not in the preview's departing list.
3. The same job, once the week has rolled over (close mark is for a previous
   Monday) → departs normally.
4. A job not in the printout carrying a close mark for a **different** week
   → departs normally.
5. `canDepart` false (null `knownJobIds`) → still departs nothing, close marks
   or not.
6. A returning job number still clears `departed_at` and `done`, unchanged.
7. Count refusal and duplicate refusal unchanged.
8. Full suite green.

---

## Council round — 2026-08-26

Two independent `ggnz-council` reviewers. Both returned **build**, one with
amendments. Verified against the live code before folding in.

**Reviewer 2 (product call) — build as written.** Holding back the departure is
the root-cause fix, not a patch: the close mark and `departed_at` record two
different facts, so respecting one before acting on the other is correct. A
held-back job costs Trevor nothing — it is already `done` and every working
screen filters `!j.done` (`JobsPage.jsx:17`, `Sidebar.jsx:69`,
`JobShelf.jsx:104`, `BenchBoardPage.jsx:30`), so it stays visible only in the
Weekly Log, which is the point. Absent-from-the-list is the right UX; a
"held back until Monday" badge would be new UI for a case Trevor caused himself
by tapping close.

**Reviewer 1 (mechanics) — build with amendments.** The brief undersells the
plumbing: it reads as a one-file pure-function change, but the marks and the
Monday are not reachable inside `pdfImportPlan.js`. `useWeekMarks()` is held at
`App.jsx:313` and `useJobs()` is constructed at `App.jsx:358` without it, so
`App.jsx` and `useJobs.js` both need editing to thread two values through.
`useJobs.js` is a named blast-radius file — which is why this is running the
full protocol.

### Amendments folded into the scope lock

1. **Thread, don't re-read.** Reviewer 2 suggested calling `loadWeekMarks()`
   inside the import path; reviewer 1 suggested threading `weekMarks.marks`
   from `App.jsx`. **Ruled: thread it.** The marks are already live in memory
   with a realtime subscription behind them; a second read at import time is a
   redundant network call that can fail on its own, and it would stop
   `buildPdfImportPlan()` being pure. `App.jsx` → `useJobs()` →
   `buildPdfImportPlan()`.
2. **Inline the key format.** Do not import `weekCloseKey` from
   `BenchWeekPage.jsx:85` into the data layer — data importing from a page
   component is backwards. Inline `` `close:${monday}` `` in
   `pdfImportPlan.js`.
3. **Compute the Monday fresh.** `getWeekDays()` (`src/utils/calendar.js:24`)
   with **no argument**. Never reuse `weekDays` / `schedulerWeekDays`
   (`App.jsx:334`) — that is the Scheduler calendar's *navigated* week, so it
   silently yields the wrong Monday whenever Trevor has paged the calendar.
4. **A marks failure must not freeze the import.** Confirmed at
   `useWeekMarks.js:50-59`: on a failed read the hook leaves `marks` at `{}` and
   only drops `ready`, so callers never see `null` anyway. Treat `null`,
   `undefined` and `{}` identically — no close mark found, depart normally.
   Do **not** copy the `knownJobIds` pattern where `null` blocks every
   departure; blocking the whole board on a marks hiccup is a worse regression
   than the bug being fixed.
5. **Hold the job out of both lists.** Only `plan.departures` is read in
   production today (`useJobs.js:545,563`; `PdfImportPreviewModal.jsx:104,117`)
   — `plan.missing` is read only by tests. Remove the held-back job from
   `missing` too, so the day something starts rendering `missing` it does not
   reintroduce this exact bug.

### Checklist items added by the council

9. A close mark stored under a **different job id** does not hold back this job.
10. A job carrying a close mark that **is** still on the printout is unaffected
    — it never reaches the departing set at all.
11. `marks` of `null`, `undefined` and `{}` all behave identically: depart
    normally.
12. The Monday is computed from `getWeekDays()` with no argument, not from the
    Scheduler's navigated week.

---

## Shipped

Merged to main 2026-08-26 as `5310f8e` (PR #46, squashed from `1992a2c`).

**Tests:** 735 -> 745, all passing across 38 files. The ten new tests were checked
against a deliberately broken build — removing the hold-back line drops the suite
to 744 passed / 1 failed — so they are not passing vacuously.

**Verification:** independent `ggnz-verifier` pass, 12/12 checklist items and 5/5
council amendments PASS with file:line evidence, on a self-run suite.

### Decisions the scope lock did not cover

1. **Where the Monday is computed.** The lock required `getWeekDays()` with no
   argument but not where it is called. It lives in `useJobs.js`, recomputed
   inside the import handler on every import rather than held in state — a
   stored value would still hold jobs back against last week's Monday if the app
   were left open across Sunday midnight.
2. **What counts as "marked".** Any non-empty value under the `close:` key is
   treated as closed, rather than requiring the exact string `'closed'`. Verified
   safe: `handleClose()` (`BenchWeekPage.jsx:619`) writes `CLOSE_MARK` to close
   and `''` to undo, and no other code path writes under that key.
3. **No Monday supplied** behaves exactly as before the change — nothing held
   back.

### Checklist items that could not be met as written

None failed. Items 2 and 3's *visible* effect on the import preview screen were
reported CAN'T-VERIFY by the verifier (browser needed) and were then deliberately
NOT click-tested: the Vercel preview points at the live database, and tapping the
close × also fires the invoice prompt, so a browser test would have finished a
real job. Merged on the test evidence instead, with Trevor's agreement. The data
path from the filtered list to the preview modal was verified by code inspection
(`useJobs.js:545,563`; `PdfImportPreviewModal.jsx:104,117`).

### Noticed in passing, not fixed

The plan object does not report *which* jobs were held back, so nothing on the
preview screen shows that anything was held. That is what was agreed — but if a
job seems to be sticking around after invoicing, a current-week close mark is why.
