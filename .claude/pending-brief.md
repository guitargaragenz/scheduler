---
doc_status: live
---

# Scope lock — Key button on the Jobs Sheet

Status: approved by Trevor 2026-09-13 ("yes add the key button").
Display only, one file, no job data — council and builder skipped. Browser test
still runs; merge needs yp.

## Build
- `src/components/JobsSheetPage.jsx`: a "Key" button in the header, shown on
  phone and iMac. Tapping it shows or hides a panel listing what each Action code
  and each tick box (VB, BL, PJ) means. Wording taken from the Action and Flag
  tables in `SCHEDULER-ARCHITECTURE.md`.

## Out of scope
- Anything that edits or saves a job.
- The tick-off-WP-from-the-job-card idea (separate, not yet briefed).

## Rules
- Nothing in the key reads or writes job state.
