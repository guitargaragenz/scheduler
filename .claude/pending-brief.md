---
doc_status: live
---

# Scope lock — bench week Build 1c: admin rows that aren't jobs

Build 1b shipped (`5c6b6ec`, merged `e498496`): a bench dropdown adds a job to the week as a
blank row. But real admin work — buying strings, researching a job, doing the books — has no
job number, so there is nothing to pick. Trevor's framing, 2026-08-13: **if it's added by
hand, it isn't a job.** The week page already stores rows by an id and a label; it does not
care that the id belongs to a job.

## In scope

**A typed row.** Under a bench, alongside the job dropdown, Trevor types a name and gets a
blank row. From then on it behaves exactly like a job row: tap days to mark, Remove to clear.

- Available under **every** bench, not only Admin. Buying strings is Admin; researching a job
  is Setup. Trevor puts it where the work happens.
- **No schema change.** `bench_week_marks` is `job_id TEXT`, `date_key TEXT`, `mark TEXT` —
  all free text. The row gets a generated id that cannot collide with a job number. The
  `mark` value on the existing week-scoped key (`week:<monday>`) must carry **both the typed
  name and the bench** — a typed row has no `jobs[]` entry, so `rowBenchOf()` has no
  `job.bench` to read. Pick the encoding and write it down.
  If the builder finds this genuinely won't hold both, stop and say so — don't invent a table.
- **`weekRows()` must be extended** (`BenchWeekPage.jsx:109-147`). It builds every row by
  looping `jobs[]`; a typed row is not in `jobs[]`, so nothing would ever draw it. It needs a
  second pass that builds a row from a marks-only id. **This is the real work of this build** —
  both council reviewers named it. `row.job` is read nowhere, so a stub there is safe.
- The row still draws and exports **blank** until Trevor marks days. Build 1b's guarantee is
  not weakened.
- The exported week file shows the typed name where a job row shows its job number and
  make/model. Decide and write down what that line looks like.
- A typed row belongs to **one week only**. It does not repeat, and it does not appear in
  the jobs list, the board, the sheet, or revenue.

## Out of scope

Recurring or template tasks · editing a typed row's name after it's made (Remove and retype) ·
the day page · any change to marker symbols or the tap-cycle · anything in `jobs[]`,
`scheduledSlots` or `calendarSlot` · Google Calendar, which stays a read · Workshop Projects,
which is a different thing and stays where it is.

## Rules that bind

- Marks only. Nothing is written to the job tables.
- A typed id must never be mistaken for a job id anywhere that looks jobs up by id.
- Answer in writing: **how does a typed row get created, changed and removed?**
- Steps: council → staging branch → `ggnz-builder` → `ggnz-verifier` → browser test → Trevor merges.
