---
doc_status: live
---

# Handoff — start here, 2026-09-11

Nothing is being built right now. `.claude/pending-brief.md` is `closed`. The last
thing that shipped was the "no bench" cleanup, merged at `f5b2315`.

## What this session did

- Checked `docs/supabase-schema.sql` against the live code. It is correct. All 18
  tables the app queries are declared in it, `daily_logs` included (line 115), and
  the drift test in `src/utils/supabaseSchemaDrift.test.js` passes.
- The briefs index carried a note saying that file had drifted. The note was stale —
  the drift was fixed when the test was added. Note deleted at `a80fcc7`.

Lesson, again: documents describe the past, the code describes the present.

## Recommended next work — the vanishing job

`src/data/pdfImportPlan.js` only clears a job's `done` flag on the "returning" path,
and that path needs a non-null `departed_at`. So a job still on the Multitrack
printout can stay flagged done and drop off the board. Job 1740 was put back by hand
once already.

That breaks a workshop rule outright: a job number reappearing on a Multitrack
printout is live work by definition.

This is blast-radius work — it touches the `jobs[]` shape. **It starts at protocol
step 1: a brief Trevor approves, then council, then builder.** Do not start building
off this handoff.

## The other candidate, if Trevor prefers it

Changing bench in the job drawer on a split job saves the cards but not the parent
row, so the board snaps back. Found 2026-09-03 on job 1727. It has a workaround
(collapse to one card, save, re-split), which is why it sits second. Write-up:
`docs/briefs/2026-09-03-drawer-bench-change-dropped-on-split-jobs.md`.

## Not to be started without asking Trevor first

Everything in the Parked table, the Projects-planner idea, and the four colliding
screen names. The old standing order (no UI work until the PDF drop landed) is
satisfied at `1e4186a` — but unblocked is not approved.
