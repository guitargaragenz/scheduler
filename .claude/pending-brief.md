# Record — a job closed this week survives the week (SHIPPED, not pending)

doc_status: closed

**Nothing is pending. This is a record, not a task list.** Shipped 2026-08-26 at
`5310f8e` (PR #46). Do not build from this file.

The full record — diagnosis, council rulings, the 12-item checklist and its
results, and the decisions the lock did not cover — is in
`docs/briefs/2026-08-26-closed-job-survives-the-week.md`, `doc_status: closed`.

## What shipped

`buildPdfImportPlan()` no longer departs a job carrying a `close:<this week's
Monday>` mark. It departs on a later import, once the week has rolled over.
The week marks and the Monday are threaded `App.jsx` -> `useJobs()` ->
`buildPdfImportPlan()`, which stays pure. Tests 735 -> 745, all green.
Verifier: 12/12 checklist items, 5/5 council amendments.

## Worth carrying forward

- The council caught that the approved brief described a one-file, pure-function
  change when the build actually had to touch `useJobs.js` — a blast-radius file.
  Check what a change reaches before calling it small.
- The browser test was skipped deliberately: the Vercel preview points at the
  LIVE database, and tapping the close x fires the invoice prompt, so clicking
  through would have finished a real job. Merged on test evidence instead, with
  Trevor's agreement. There is no safe way to click-test anything that writes
  job state.
- Still open, out of scope then and now: the import plan does not report WHICH
  jobs it held back, so nothing on the preview screen shows that anything was
  held.

## Next build

None yet. The next brief replaces this file entirely; this record is safe in git
history (`git log -- .claude/pending-brief.md`).
