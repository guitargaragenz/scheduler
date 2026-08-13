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
  all free text. The row gets a generated id that cannot collide with a job number, and its
  label rides in the `mark` value on the existing week-scoped key (`week:<monday>`), which is
  already written and already ignored by `cellMark()` and `buildWeekExport()`'s day walk.
  If the builder finds this genuinely won't hold a label, stop and say so — don't invent a
  table.
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
