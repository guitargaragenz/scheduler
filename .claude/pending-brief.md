---
doc_status: live
---

# Scope lock — A finished job keeps its × and its week

Previous occupant (session-hours lock) closed at `d2f770d`, shipped at `dc78164` — in git.

**Trevor:** "tapping × a second time on a job I've already closed and invoiced makes the job
vanish … a finished job must never drop off the week it was finished in, and a stray second tap
must not undo the close. Put 1726 back on this week."

Background for the verifier only — don't open it to start work:
[docs/briefs/week-close-sticks.md](../docs/briefs/week-close-sticks.md) (cause, council rulings, checklist).

## Build (branch `staging/week-close-sticks`)

1. **Second tap can't undo.** In `handleClose` (`BenchWeekPage.jsx`), right after the
   locked/ready guards: if `row.job?.done` and the row is closed, do nothing but toast
   ("already invoiced"). Nothing is written. A not-done job (invoice prompt cancelled) still
   clears the mark on a second tap — the mis-tap undo stays.
2. **Remove can't wipe it.** `handleRemove` on a `done` job: refuse with a toast, before the
   confirm, so it never reaches `clearJobKeys` with the close key. (Long-press Clear and Close
   are already inert on a closed row — leave them alone.)
3. **Restore 1726's ×, one-off script, not app code.** `scripts/fix_1726_close_mark.mjs`,
   dry run then `--apply`, same style as `fix_1726_typo.mjs`. Plain insert of ONE
   `bench_week_marks` row: `(job_id '1726', date_key 'close:2026-09-28', mark 'closed')`.
   Refuses (and prints the row found) if it already exists. Nothing else is touched.

## Not in scope

- Any other job's ×. Council (Opus) found the other 10 of the 11 are not lost marks: 8 finished
  before the close column existed; 1632 and 1740 already have one on an earlier week.
- Making jobs finished from Close Day / Catch-up / revenue review write a close mark — own brief.
- Revenue-week rule, `completedJobs` prop, blast-radius files, `useJobs.js`, revenue rows.

## Binding rules

- A completed job never comes back as live work; a `done` row is display-only.
- The script writes one new `close:` row to `bench_week_marks`. Nothing else.
