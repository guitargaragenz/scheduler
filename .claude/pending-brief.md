---
doc_status: live
---
# Brief — invoice entry incl-GST, revenue stays ex-GST

Previous occupant (review-prompt record) is in git at `fa5cd79`.

## Problem, in Trevor's words

"Change scheduler revenue entry to GST included and have revenue show GST excluded."
Option 1 agreed: convert on entry, store ex-GST. Weekly target is ex-GST, unchanged.

## Scope (one merge)

- **One conversion point**: `handleMarkDone` in `src/hooks/useJobs.js` (~line 425).
  Every entry path (PomoDrawer, CloseDayModal, CatchUpInterview, RevenueReviewBanner) goes
  through it. Store `invoiceAmount = round2(Number(amount) / 1.15)`, rounded to cents.
- Success toast (~line 468) shows the stored ex-GST figure, not the typed one. Fix the comment above it.
- Relabel every amount input from "ex-GST" to "incl-GST":
  `PomoDrawer.jsx:353`, `RevenueReviewBanner.jsx:41`, `CloseDayModal.jsx:207,419`,
  `CatchUpInterview.jsx:202,238`.
- Week revenue header, RevenueBreakdown, "Already invoiced $X" stay as-is (ex-GST, from the stored value).
- GST rate 15% as one named constant, not magic numbers scattered.

## Not in scope

- `src/utils/supabase.js`, `appendCompletedJob`, the `completed_jobs` table: no changes.
- Existing stored records: no migration (already ex-GST).
- Weekly target: no change.
- `scheduledSlots`, `calendarSlot`, `useGoogleCalendar.js`, `useSupabase.js`, `jobs[]` shape.

## Binding rules

- Conversion happens exactly once, in `handleMarkDone`. No component divides by 1.15.
- Duplicate-refusal path unchanged (it shows the stored figure already).

## Verifier checklist

1. `handleMarkDone` stores `Number(amount)/1.15` rounded to 2dp; `0`/blank still stores 0.
2. No other file divides by 1.15 or the GST constant.
3. All six input labels read incl-GST; no "ex-GST" text left on an entry input.
4. Success toast shows the ex-GST stored amount.
5. Week revenue total sums stored values unchanged (`App.jsx:650`).
6. Nothing in the not-in-scope list changed (`git diff --stat`).
7. Tests: one for conversion + rounding (e.g. 115 → 100, 100 → 86.96); full suite passes.
