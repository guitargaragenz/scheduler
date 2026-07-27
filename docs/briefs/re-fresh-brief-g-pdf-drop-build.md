# Re-fresh — Brief G (PDF-drop import) is approved, start the build

**Written:** 2026-07-28. **Status of the work:** brief approved and scope-locked, no app code
written yet. Trevor said "hold off" mid-way through the first pre-build check, so nothing is
half-finished.

---

## Plain English — what this session is picking up

Trevor wants to drop the Multitrack PDF straight into the Scheduler in his browser and have new
jobs appear. No DropBox folder, no watcher script, no CSV, no Google Sheet. He also wants the
Google Sheet rebuilt **as a page inside the app** — all jobs in a grid, he edits Tag / Hours /
Action / VB / BL, presses a commit button, done.

The brief for that is **written, argued over, corrected, and approved**. It lives at
[`.claude/pending-brief.md`](../../.claude/pending-brief.md) as **Brief G**. Read it — it is the
instruction set for this session, and it is more current than this file.

**This session's job is to build it**, following the Agent-Team Protocol in CLAUDE.md. The brief
is done; do not re-open it.

---

## Where exactly things stopped

Brief G's scope list starts at **step 0, a gate**: prove the job numbers coming out of a PDF match
the job numbers already in the `jobs` table character-for-character, *before* writing any import
code. If they don't match, every job the PDF brings in looks "new" and you get 46 duplicates.

That check was started and then stopped on Trevor's word. Partial result, read-only, nothing
written anywhere:

- Sample PDF used: `/Users/admin/Downloads/GGNZ Jobs 18 Jul.pdf` (a real Multitrack export, 227 KB).
  ⚠️ **This file is stale — dated 18 July, and it is now the 28th** (Trevor flagged it). It is
  adequate for the *format* half of step 0, because job numbers don't change shape over ten days.
  It is **not** adequate for anything counting jobs: any job booked in since the 18th is missing
  from it, so new-vs-known counts and the count sanity-check would both be measuring the wrong
  thing. **Ask Trevor for a fresh export before the browser test**, and before treating any count
  as real.
- **50 job numbers found, all 50 distinct.** x-positions clustered at 526.3–533.0, which matches
  the ported parser's `x >= 500` rule for the job-number column — a good sign the parser's column
  geometry survives on Trevor's real export.
- **The comparison against the database was never run.** That is the actual proof and it is still
  outstanding.
- Throwaway script: `step0_pdf_refs.py` in the previous session's scratchpad — gone now, and only
  ~25 lines. Rewrite it rather than hunting for it.

**Start here.** Finish step 0, report the result to Trevor in plain English, then proceed down the
scope list.

---

## Things that are easy to get wrong (all learned the hard way this session)

- **Tag ≠ Action.** Tag is *effort* — EZ / M / T / H. Action is the *workflow code* —
  INC / CI / RS / RS-C / DG / GTS. They are different columns. A council run and an earlier draft
  of the brief conflated them and Trevor had to correct it twice.
- **Medium and Tricky are swapped in the code**, in two places (`inferTag()` at
  `src/data/jobs.js:172` and `infer_tag()` at `scripts/sheet_to_csv.command:295-300`). Correct
  order is EZ ≤1.5h → **M ≤3h → T ≤5.5h** → H. Both copies must be fixed together.
- **The exported status string is `Waiting`, not `Waiting Parts`.** Multitrack's dropdown *label*
  reads "Waiting parts" but the export is master, and `src/data/jobs.js` is correct as-is. Do not
  "fix" it.
- **`JobDrawer.jsx` is the manual split editor and is out of scope.** It is not the sheet page and
  is not touched. Saying "drawer editors are out" to Trevor alarmed him — be precise.
- **`upsertJobsBatch()` in `src/utils/supabase.js` is the loaded gun.** It hardcodes ~20 columns on
  every row. Calling it from the PDF path would blank Tag / Action / VB / BL / age across all
  existing jobs in one click. Use the `toJobRow` + column-signature-grouping pattern from
  `batchWriteJobsState()` instead. The brief spells this out.

---

## Protocol state

| Step | Status |
|------|--------|
| 1. Brief | ✅ Approved by Trevor, 2026-07-28 ("yp"). Scope locked. |
| 2. Council | ✅ Run 2026-07-28 (llm-council). Findings folded into the brief; several were overturned by Trevor afterwards — **the brief wins, not the council transcript**. |
| 3. Builder | ⬜ Not started. Staging branch, supervised from the main conversation. |
| 4. Independent verifier | ⬜ Separate agent, never the builder. |
| 5. Browser test | ⬜ Vercel preview: drop a real PDF, confirm preview counts, confirm existing jobs' markup survives. |
| 6. Merge | ⬜ Needs a second "yp" from Trevor. |

Repo state at handoff: on `main`, clean, in sync with origin. Last commit `71de9b8`.

---

## Scope changes go back to the brief

Brief G is scope-locked. Anything that turns up mid-build which isn't in its Scope list gets
written back into the brief for a fresh "yp" — not absorbed quietly. Per CLAUDE.md, a fix that
keeps growing new problems each review pass is a stop signal, not a cue for another guard layer.
