---
doc_status: closed
---

# The vanishing job — built, verified, abandoned

**2026-09-11.** Record only. Nothing here is a next step.

## The defect, still unfixed

A job that is flagged done but still on the board stays hidden from the Jobs page
even after the next Multitrack printout names it. Job 1740 was put back by hand.
By the workshop rule, a number on a printout is live work, so nothing named by an
import should stay done.

Where it lives, verified against the code that day:

- `src/data/pdfImportPlan.js` — only the "returning" path clears `done`, and a row
  reaches it only if its id is in `departedIds`. A job still on the board takes the
  plain `updates` path, which writes `pdfFieldsOf(p)` and never touches `done`.
- `src/components/JobsPage.jsx:17` filters `!j.done`. The Jobs Sheet does not filter
  on done at all.

## What was built and thrown away

Two files. The plain update path cleared `done` only when the known job's `done` was
actually true, and `writePdfImportBatch` in `src/utils/supabase.js` gained a named
list allowing `done` on a plain update — without that the stray-field guard throws
and refuses the whole import batch. Four tests added. Suite green, 687 tests across
36 files, only the 3 pre-existing `jsdom` errors left.

Protocol ran steps 1 to 4. Both council reviewers approved; the second found the
writer's allow-list gap, which was real and was confirmed against live code. The
verifier passed all six items cold.

Step 5, the browser test, needs a real Multitrack printout naming a job marked done.
It never happened.

## Why it is gone

Branch `staging/vanishing-job` at `d92a798` was deleted local and remote on Trevor's
call, 2026-09-11, unmerged. `git log` no longer reaches it. Any future fix starts
from scratch.

One note the builder, council and verifier all raised independently: the widened
allow-list would let `done: true` through the plain-update path, safe only because
no caller ever sends it. Left out of scope.
