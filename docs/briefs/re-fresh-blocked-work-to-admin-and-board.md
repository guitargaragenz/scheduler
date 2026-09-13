---
doc_status: closed
---

# Session refresh — run the protocol on the pending brief

Continuing work in the GGNZ Scheduler project (`guitargaragenz/scheduler`). Goal of this
session: take the approved brief in `.claude/pending-brief.md` through the agent-team protocol,
starting at **step 2, council**.

The brief was written on 2026-08-04 at the end of a very long session. Everything a builder
needs is in the repo — nothing important lives only in that conversation.

## Where things stand

**Merged to main this session:**
- `5650d0b` — the board-meeting export was reporting 55 jobs against a Multitrack printout of 36.
  It never filtered soft-deleted (`departed_at`) rows, which the app itself hides. Every board
  meeting before this one ran on numbers the board never showed.
- Same merge — the Jobs Sheet `Desc` column now wraps, and carries a drag grip on its right edge.
- `b997380` — the 12-hour glue rule, added to CLAUDE.md's workshop rules.

**Open on PR #20** (branch `claude/sunday-meeting-tuesday-y902ja`, draft, CI green):
- A glossary of Trevor's job codes in `SCHEDULER-ARCHITECTURE.md`
- `sz` added to CLAUDE.md as a shortcut
- The brief itself

**Not started:** both builds in the brief. No council, no builder, no verifier.

## Next steps

1. Read `.claude/pending-brief.md` end to end. It is scope-locked and Trevor has approved it.
2. Merge PR #20 first if it is still open — the glossary and the brief should be on main before
   council reads them.
3. Run **two `ggnz-council` agents** (sonnet, pinned) over Build 1. Fold their amendments into the
   brief before building, and record what changed, the way the previous brief did.
4. `ggnz-builder` (opus, pinned) on a staging branch, Build 1 only. **Build 2 does not start until
   Build 1 has merged** — the board's bench cut reads wrong until blocked work carries Admin.
5. `ggnz-verifier` (sonnet, pinned) against the brief's 13-item checklist. Never the builder.
6. Browser-test on the Vercel preview, then Trevor's "yp", then merge.

## Before you act on any factual claim in the brief

Check it against live data. The brief's job numbers and counts were true on 2026-08-04 and will
have moved — Trevor imports a fresh Multitrack printout most days. In particular the list of
bench-less jobs to backfill (Build 1, rule 5) is explicitly flagged in the brief as needing
re-derivation at build time.

Pull live data with `node scripts/board_meeting_export.mjs` (needs `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY`; on a web session the environment must be "Supabase access", not
Default, and `npm install` first).

## Files to open (read these, don't re-derive)

- `.claude/pending-brief.md` — the brief. Both builds, scope, out-of-scope, checklist.
- `src/data/jobs.js` — `inferBench()` (line 19), `blockedPile()` (line 107),
  `deriveJobStatusFlags()` (line 209), `needsBench()` (line 171). Build 1 is almost entirely here.
- `src/components/JobDrawer.jsx` — `ALL_BENCHES` (line 5) and the bench `<select>` (line 223).
  This is the half that silently writes Luthier.
- `src/components/ProjectsPage.jsx` line 6 — groups `INC · RS · RS-C · DG` under "Needs Thinking",
  which is the evidence that `blockedPile()` is already inconsistent about `DG`.
- `scripts/board_meeting_export.mjs` — reports `readyToStart`, which Build 1 deletes.
- `SCHEDULER-ARCHITECTURE.md` — the new glossary of Trevor's codes. Read it before asking him what
  an abbreviation means; that already cost him once.

## Carried-over data

The board-view mock-up Trevor reviewed and approved the shape of, built from live data:
https://claude.ai/code/artifact/df22fbeb-ae04-45c4-af62-44eb0f9ef113

## Loose ends on the shop side (not part of either build)

- Job 1520 — parent says 8h, its bench cards total 7.5h. Half an hour unaccounted and unplaced.
- Job 1703 is booked on Saturday 8 Aug. Trevor may not have meant that.
- Job 182 still carries the legacy `SKP` tag. Trevor said he would clear it himself.
- Three items were added to the Supabase parking lot needing council: Sidebar search doesn't match
  customer name, Sidebar search doesn't match bench, and the day-view card doesn't show its
  scheduled days.

## Avoid repeating

- **Don't trust a stated hours figure without checking the job's bench cards.** A quick-wins list
  was built off parent hours that disagreed with the splits, and Trevor had to correct it.
- **Don't call the bench-less jobs "unclassified".** They classify fine; `inferBench()` throws the
  bench away on purpose because they are blocked. That misdiagnosis wasted a round.
- **Don't build a tag/hours mismatch warning.** It was proposed and rejected — 29 of 36 jobs
  legitimately differ from their tag default, because a tag fills the Hours box once and Trevor
  owns it after that. This is written into `SCHEDULER-ARCHITECTURE.md`.
- **Don't put a resize grip on the Desc column's left edge.** Tried, reverted — it can only work by
  shrinking Status, which is what made it feel restricted.

## Skills to run

- `/protocol` — runs the agent-team protocol end to end from the brief.
