---
doc_status: live
---

# Scope lock — Send a job to next week from the > box

Approved by Trevor ("yp", 2026-09-14).

## Build
All in the week page's end box (`src/components/BenchWeekPage.jsx`) plus tests.

- **Tap** — unchanged: toggles × on/off (closes the job, asks invoice as now).
- **Long press** — opens a small menu on that box:
  - **> Send to next week** — puts the job on next week's page (writes next
    week's hand-added row key), and marks this week's box as a chosen >.
  - **× Close** — same as a tap.
  - **Clear** — removes a chosen >, and takes the job back off next week
    only if next week has no day marks on it yet.
- The box is BLANK by default — no more automatic >. Tap goes blank → × →
  blank. > only shows when chosen from the menu.
- Picking × on a job already sent to next week takes it back off next week
  (same "no day marks yet" guard).
- Works for hand-typed rows too (same row key carries their name; bench is
  always Admin).
- A blank box must not crash: the button render and the export line both do
  `MARKS[t.mark]` today — handle "no mark" in both (export shows nothing).
- Next week's day keys come from `getWeekDays` (`src/utils/calendar.js`) fed
  Monday + 7 days. The "no day marks yet" guard checks those 7 day keys only.
- Long press: hold timer on pointer down, cancel on move/up; when it fires,
  swallow the click that follows. Stop the iPhone callout/text select.
  Update existing `trailing()` tests that expect the automatic >.

## Rules that bind it
- Writes to `bench_week_marks` only. Not jobs[], scheduledSlots, calendarSlot.
- Chosen > is stored in its own non-day key, like the close key, so day
  cells and the export never see it.
- Never touches a job's booking. Next week's row lands blank, same as Add.
- Long press must not also fire the tap (no accidental close).

## Out of scope
- Carrying jobs forward automatically without a tap.
- Any change to the Daily Log.

## Council (2026-09-14)
R2 go. R1 not yet: blank box would crash render + export; no next-week helper;
long press built from scratch. All three folded into Build above.
