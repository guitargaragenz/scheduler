# Record — a crossed-off row stops being offered (SHIPPED, not pending)

doc_status: closed

**Nothing is pending. This is a record, not a task list.** Shipped 2026-08-26 at
`dd64990` (PR #49). Do not build from this file.

The full record — the diagnosis, the line numbers and the checklist — is in
`docs/briefs/2026-08-26-a-crossed-row-stays-crossed.md`, `doc_status: closed`.

## What shipped

`dayJobOptions()` also reads the Daily Log's own marks and drops any part whose
latest mark is a cross. `latestDayMarks()` already built that map. Kept
alongside `pieceDone`, not instead of it. 758 tests green.

Same session, also shipped: the `Task ▾` picker on the job line
(`3126b7c`, PR #47).

## Worth carrying forward

- `pieceDone` is only ever written for a SPLIT. Anything that treats it as "this
  work is finished" for a job in general is wrong — an unsplit job has no
  parent, so nothing writes it.
- The bug predated the `Task ▾` picker by months; the search box had always done
  it. Putting the same stale list on the job's own line is what made it visible.
- A day's typed notes are stored on the day, not read from the job card. Editing
  a job's splits does not rewrite a note already typed under a placed row.
  Trevor hit this on 1621 and it looked like stale split data.
