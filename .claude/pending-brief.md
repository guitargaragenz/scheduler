---
doc_status: closed
---
# Record (shipped) — invoice entry incl-GST, revenue stays ex-GST

Shipped at `25eeba6` (PR #113). Tests 992/993; the one failure (`BenchWeekPage.sendNext` "a plain tap still closes") fails on main too. Builder's own call: toast reads "$X ex-GST invoiced". Checklist all met.

## Problem, in Trevor's words

"Change scheduler revenue entry to GST included and have revenue show GST excluded."
Option 1 agreed: convert on entry, store ex-GST. Weekly target is ex-GST, unchanged.

## Scope (one merge)

- **One conversion point**: `handleMarkDone` in `src/hooks/useJobs.js` (~line 425).
  Every entry path (PomoDrawer, CloseDayModal, CatchUpInterview, RevenueReviewBanner) goes
  through it. Store `invoiceAmount = exGstFromIncl(Number(amount) || 0)`. Compute once, reuse for the toast.
- **New** pure helper `exGstFromIncl` + `GST_RATE = 0.15` in `src/utils/money.js`:
  `Math.round(x / (1 + GST_RATE) * 100) / 100`. Tested directly (handleMarkDone has no harness).
- Success toast (~line 468) shows the stored figure as "$X ex-GST". Fix the comment at :467.
- Relabel every amount input from "ex-GST" to "incl-GST":
  `PomoDrawer.jsx:353`, `RevenueReviewBanner.jsx:41`, `CloseDayModal.jsx:207,419`,
  `CatchUpInterview.jsx:202,238`.
- Week revenue header, RevenueBreakdown, "Already invoiced $X" stay as-is (ex-GST, from the stored value).

## Not in scope

- `src/utils/supabase.js`, `appendCompletedJob`, the `completed_jobs` table: no changes.
- Existing stored records: no migration (already ex-GST).
- Weekly target: no change.
- `scheduledSlots`, `calendarSlot`, `useGoogleCalendar.js`, `useSupabase.js`, `jobs[]` shape.

## Binding rules

- Conversion happens exactly once, in `handleMarkDone`, via the helper. No component converts.

## Verifier checklist

1. `handleMarkDone` stores `Number(amount)/1.15` rounded to 2dp; `0`/blank still stores 0.
2. Only `handleMarkDone` calls `exGstFromIncl`; no `1.15` literal anywhere in src.
3. All six input labels read incl-GST; no "ex-GST" text left on an entry input.
4. Success toast shows the stored amount with "ex-GST".
5. Week revenue total sums stored values unchanged (`App.jsx:650`).
6. Nothing in the not-in-scope list changed (`git diff --stat`).
7. Tests on `exGstFromIncl`: 115 → 100, 100 → 86.96, 0 → 0; full suite passes.

## Council changes (2 reviewers, both "not yet" → settled)

- Rounding helper didn't exist; now a named new function in money.js so it's testable.
- Trevor: no exempt jobs; Multitrack is master, this is target-only — typed figure loss and cent drift fine.
