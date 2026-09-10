# Handoff — the completion-date fix

doc_status: live

Written 2026-09-10, at the end of a session that had compacted five times. The
brief is trustworthy; this session's memory of anything older was not.

## Where the work stopped

Protocol steps 1 and 2 are DONE. Step 3 (builder) has not started and needs
Trevor's go-ahead.

- **Brief:** `.claude/pending-brief.md`, 50 lines, `doc_status: live`. It is the
  scope lock. Read it and build from it. Do not open this handoff to start work.
- **Council:** two `ggnz-council` reviewers ran. Both returned "not yet", both
  were right, and both findings are already patched into the brief.
  1. The finished date would linger after the invoice drawer closed and land on
     the next job invoiced. Brief step 3 now names every place to clear it.
  2. The brief originally resolved the finished day via `ruleOff`, which is
     gated on the close mark and reads a pre-write `marks` snapshot — it would
     have returned null on the exact button press this fix exists for, and it
     returns a column index, not a date. Brief step 2 now scans `weekKeys`
     backwards with `cellMark` BEFORE the `setMark` write and converts the index
     via `weekKeys[i]`.

No third council round is needed. Next action is the `ggnz-builder` run on a
staging branch, then `ggnz-verifier`, then a browser test on the Vercel preview.

## What the fix is, in plain English

Trevor closes a job on the Week page with a ×. That × already knows which day
the work finished. The invoice prompt that follows does not — it stamps the
revenue with today's date and the week currently on screen. So job 1632, closed
Friday 4 Sept, filed $569.89 into the week of 7 Sept.

The build carries the day from the × through to the revenue row. Nothing else.

## Deliberately NOT being built

Trevor's decision, 2026-09-10, in his words: "I honestly think it's probably
better to leave it to you changing the mistakes rather than adding more code to
something that already has a fix via you."

- Re-ticking a job does not overwrite a wrong AMOUNT. A wrong amount is a rare
  typo and stays a by-hand database fix by Claude. A wrong DATE is systematic,
  which is why only the date is being fixed in code.
- Removing an × does not un-invoice a job.

## Still open, separate jobs

1. **The importer bug that stranded job 1740.** `src/data/pdfImportPlan.js` only
   clears the `done` flag on the "returning" path, which needs a non-null
   `departed_at`. A job still on the Multitrack printout can stay flagged done
   and vanish from the board. 1740 was unstuck by hand. Needs its own brief.
2. **Two mis-dated revenue rows** in `completed_jobs`, both stamped 2026-09-07.
   `cj-1632` should read Friday 4 Sept. `cj-1711` is correct as-is. One-off
   manual fix, to be done AFTER the build ships, not before.

## Known risk, accepted, not being fixed

Nothing checks that a day × is in the future. A mis-tapped × on a future day
would stamp revenue with that day and say nothing. This is pre-existing and the
build does not make it worse.
