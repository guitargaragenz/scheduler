# Session brief — Job blocking: council, then build

**Date:** 2026-07-27
**Repo state:** `main` @ `d0e3a2c`, clean except untracked handoff notes
**Device:** Micky (needs a local dev server and the `.env` keys — don't run this from the phone)

---

## Where this is up to

The design is agreed and the implementation plan is written against the real files. Nothing
has been built. Trevor has not yet said "yp" to the brief — **check that first.**

Read these two, in this order, and nothing else to start:

1. **[../../.claude/pending-brief.md](../../.claude/pending-brief.md)** — Brief E. Two pages:
   plain-English summary, five spec corrections, four decisions, risks.
2. **[../superpowers/plans/2026-07-27-job-blocking-implementation.md](../superpowers/plans/2026-07-27-job-blocking-implementation.md)**
   — the ten tasks in full, with file and line references checked against the working tree.

The spec ([../superpowers/specs/2026-07-26-job-blocking-design.md](../superpowers/specs/2026-07-26-job-blocking-design.md))
is background. **Five of its assumptions are wrong** — the plan's "Corrections to the spec"
section is authoritative wherever the two disagree.

## What this session does

Pick up at whichever step is next:

- **If Trevor hasn't approved Brief E** — walk him through it in plain English and get the
  "yp". Don't start council work before that.
- **Council** — two independent agents, on the four decisions in the brief. They are the
  whole point of the council pass; don't let the agents free-range over the plan.
- **Builder** — staging branch, supervised from the main conversation, working the ten tasks
  in order. Tasks 1–3 are data-layer and verifiable without touching the UI.
- **Independent verifier** — a different agent from the builder. Non-negotiable.
- **Browser test** on the Vercel preview, then merge on Trevor's "yp".

## The four decisions council must settle

| # | Decision | Plan's recommendation |
|---|---|---|
| 1 | The two parts features — cut, or build a parts-to-order list first? | Cut |
| 2 | `inferBench` backlog handling — positional parameter, or handle at the caller? | Caller |
| 3 | Who runs the `days` column migration, and when? | Trevor, Supabase SQL editor, before merge |
| 4 | Planning pile — `INC` alone, or `Waiting + INC`? | `INC` alone, or it ships empty |

## Do not

- **Do not drop a Multitrack PDF, and do not restart the watcher.** The parser is still
  unfixed; a bad PDF re-truncates `jobs.csv`. See
  [handoff-pdf-import-truncation-incident.md](handoff-pdf-import-truncation-incident.md).
- **Do not trust `sheet_to_csv.command`'s name.** It is CSV-authoritative — any Sheet row
  missing from `jobs.csv` gets deleted, with no sanity floor. This caused the truncation.
- **Do not touch `DEFAULT_BENCH_KEYWORDS` or the manufacturer lists** in `src/data/jobs.js`,
  and do not rewrite `inferBench`. Months of hand-tuning; a previous agent binned them.
- **Do not re-open** where manual fields get edited (answered: in the app), a spreadsheet-style
  bulk-edit grid, or ClickUp as a bridge. All settled.
- **Do not commit before Brief E is approved.** No brief entry, no commit.
- **Trevor never runs git.** Claude runs every git command, from whatever session.

## The one thing most likely to go wrong

`useJobStatusSince`'s ready-gate (plan Task 3). A failed read plus an eager write stamps
today's date on every job in the shop and destroys every real stuck age at once,
irreversibly. Same class of bug as the focus-list wipe in Brief D item 7 — which was only
caught because it was tested at runtime, not by reading the code. Test this one the same way.

## Useful context, already established

- **`days` has never been saved to the database.** Brief D flagged it on 25 July, the builder
  skipped it, so job ages have been wrong on every page load since. Plan Task 1 pays it back.
- **Jobs 1708 and 1710** have blank `Days` in the CSV — they must render blank, never "0d".
- **Job numbers are not an age proxy.** Rebooking means a late number can carry an early date
  (job 592 = 2502 days, job 1582 = 274 days, both legitimate). `Days` is the honest field.
- Brief D's full record is archived at
  [brief-d-board-meeting-full-record.md](brief-d-board-meeting-full-record.md) — history only.
