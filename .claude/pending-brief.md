---
doc_status: live
---

# Scope lock — Job card shows the next bench still to do

Approved by Trevor ("yp", 2026-09-14). Previous occupant: send-to-next-week record, at `ed50e72`.

Trevor: "Once the luthier work is done I want the job card to change to next
primary bench... at the moment is default to main primary bench all the way through."

## Build
- For a **top-level job with parts**, the card shows the first main bench in the
  fixed order **Luthier → Fretwork → Setup** that still has an unticked part.
- Sub-benches count as their main bench: Finishing = Luthier, Wiring = Setup
  (reuse the `PRIMARY_OF` idea in `BenchWeekPage.jsx`). Two parts on one bench
  keep the card there until both are ticked. Do NOT use the parts' array order.
- Electronics jobs never split — unchanged. No parts / all ticked → job's own bench.
- Colour follows the bench shown. Worked out when drawing; nothing saved.
- Ticks come from Daily Log, Week page, Day view, Close Day, Pomo — all set
  `pieceDone`; the card must follow any of them.
- Follows next bench: JobCard for a parent (incl. sidebar top-level rows and the
  calendar/day chip for the parent), `DayViewPage` `LogJobCard`, `ProjectsPage`, `JobsPage` `JobRow` (parent rows).
- Child part cards keep their own bench.

## Rules that bind it
- Never writes to jobs[], `job.bench`, scheduledSlots or calendarSlot.
- Never shows an empty bench (unplaced work stays on Admin).
- Wiring/Finishing stay sub-benches — never a week-page heading.

## Out of scope
- Bench board, week page grouping, sidebar bench filter and counts.
- Changing how or where parts are marked done; reordering parts.
- Google Calendar event colours.

## Verifier checklist
1. Parent card shows first main bench (L→F→S) with an unticked part; colour matches.
2. Finishing counts as Luthier, Wiring as Setup; two parts on one bench hold it.
3. A tick from DL, Week page or Day view moves the card on.
4. No parts / all done / Electronics → job's own bench. Child cards unchanged.
5. No writes to jobs[], job.bench, scheduledSlots, calendarSlot; never empty bench.
6. Bench board, week grouping, sidebar filter unchanged.
7. Full test suite passes; new tests cover 1–4.

## Council changes
Parts' saved order is unstable after reload → fixed main-bench order instead
(Trevor confirmed). Places-to-follow list ruled; child cards excluded. Verifier added JobsPage JobRow (missed spot; filters stay on job.bench).
