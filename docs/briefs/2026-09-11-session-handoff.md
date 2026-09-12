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

## The vanishing job — dead, do not restart

This handoff recommended it. It was wrong. The whole incident was Trevor deleting
job 1740 by hand; the app never hid it. The brief, the council round and the build
were all spent on a premise that was false, and the record was deleted at `5a3e918`.
The rule that came out of it is in CLAUDE.md: no brief from one incident without a cause.

## The split-job bench change — dead too, do not restart

This handoff recommended it. It was also wrong, and that is two dead
recommendations from one document in a day. The board never shows the parent of a
split job: it renders one card per child using the child's own bench
(`src/components/BenchBoardPage.jsx:49`). The parent's stale bench cannot reach
the screen, so the symptom the old write-up described can't happen. The write-up
was deleted 2026-09-13. Job 1727 is a single un-split row in Supabase today.

The save path really does skip the parent on a multi-card save
(`src/hooks/useJobs.js:327`), but nothing reads it, so there is nothing to fix.

What is real, and is a UI change rather than a bug: on mobile, Day view doesn't
show the split cards that Week view and the computer show. Logged in
`docs/briefs/BACKLOG.md`. Not approved.

## Nothing is recommended from this document

Both of its recommendations are spent. Pick the next work from the briefs index
and the backlog, not from here.

## Not to be started without asking Trevor first

Everything in the Parked table, the Projects-planner idea, and the four colliding
screen names. The old standing order (no UI work until the PDF drop landed) is
satisfied at `1e4186a` — but unblocked is not approved.
