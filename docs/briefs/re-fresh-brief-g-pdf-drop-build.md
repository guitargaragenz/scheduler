---
doc_status: live
---

# Re-fresh — Brief G (PDF-drop import): step 0 passed, build starts at item 1

**Written:** 2026-07-28, updated late 2026-07-28. **Status of the work:** brief approved and
scope-locked, **step 0 gate passed**, no app code written yet. Trevor called it a night — pick this
up later the same day. Nothing is half-finished and nothing is broken.

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

### ✅ Step 0 PASSED — 2026-07-28

Run read-only against a **fresh export Trevor dropped that morning**, `~/Downloads/GGNZ Jobs 28 Jul.pdf`.
Nothing was written anywhere.

- **46 job numbers in the PDF, all 46 distinct.** The PDF's own footer says "46 Jobs found" — parse
  count and claimed count agree, which is what scope item 6's short-parse refusal should check against.
- **45 match `jobs.id` character-for-character. Zero near-misses** (nothing that only matches after
  trimming spaces or stripping leading zeros). `id == job` on every numeric-id row.
- **1 genuinely new job: `1711`** — Dean Cronin, Gibson Les Paul Standard, Booked In.
- **6 in the database but not in the PDF:** `1619`, `1620`, `1626`, `1671`, `1698`, `1702`. These get
  *reported*, never deleted, never auto-completed (brief lines 227 and 295).
- **6 rows in `jobs` have non-numeric ids** (`1620_Electronics_0`, `1689_Luthier_1`, `1621_Fretwork_0/1`
  …). These are app-side splits. The PDF path must never match, write, or count them.
- **Fault-text bleed ruled out.** Four job descriptions spill past x=500 into the job-number column,
  but all sit on `Fault:` lines, which `isFaultLine` catches before column assignment.

**On sample PDFs:** always use a fresh Multitrack export into `~/Downloads`, asked for on the day.
Do **not** reach for `SCHEDULER_old/DropBox/processed/` — that whole pipeline is being deleted.

**Start at scope item 1** (port the parser), then item 2 (the six-column sparse writer).

---

## Answered by Trevor since step 0 — don't re-ask these

- **Job `1620` is completed.** It has split subtasks in the app but is off Multitrack's list because
  the work is finished and it was never closed off in the app. This is *not* a bug in the match, and
  it does **not** change scope: the import still only reports missing jobs. The row is untouched in
  the database — nobody has changed its status. Do not write to it as part of the build.
- **The CSV pipeline is limping and Trevor has stopped uploading CSVs.** Two consequences:
  1. Don't try to fix, patch or work around the CSV path. Brief G *is* its replacement. Any effort
     spent there is thrown away on merge.
  2. The database is therefore sitting at whatever the last CSV upload left. Step 0 proves that is
     still essentially current — **one** job behind, not fifty — so the first real PDF import will be
     a small run, not a mass catch-up.

---

## Things that are easy to get wrong (all learned the hard way)

- **Tag ≠ Action.** Tag is *effort* — EZ / M / T / H. Action is the *workflow code* —
  INC / CI / RS / RS-C / DG / GTS. They are different columns. A council run and an earlier draft
  of the brief conflated them and Trevor had to correct it twice.
- **Medium and Tricky are swapped in the code**, in two places (`inferTag()` at
  `src/data/jobs.js:172` and `infer_tag()` at `scripts/sheet_to_csv.command:295-300`). Correct
  order is EZ ≤1.5h → **M ≤3h → T ≤5.5h** → H. Both copies must be fixed together (scope item 4b).
- **The exported status string is `Waiting`, not `Waiting Parts`.** Multitrack's dropdown *label*
  reads "Waiting parts" but the export is master, and `src/data/jobs.js` is correct as-is. Do not
  "fix" it.
- **`JobDrawer.jsx` is the manual split editor and is out of scope.** It is not the sheet page and
  is not touched. Saying "drawer editors are out" to Trevor alarmed him — be precise.
- **`upsertJobsBatch()` in `src/utils/supabase.js` is the loaded gun.** It hardcodes ~20 columns on
  every row, and a Supabase array upsert sends the union of all rows' keys, NULL-filling across the
  batch. Calling it from the PDF path would blank Tag / Action / VB / BL / age across all existing
  jobs in one click. Use the `toJobRow` + column-signature-grouping pattern from
  `batchWriteJobsState()` instead. The brief spells this out.
- **`docs/briefs/handoff-pdf-import-truncation-incident.md` is closed history.** Everything
  load-bearing in it is now false. It is banner-marked and sits in the index's History section. Do
  not act on it; do not re-test the truncation bug.

---

## Protocol state

| Step | Status |
|------|--------|
| 1. Brief | ✅ Approved by Trevor, 2026-07-28 ("yp"). Scope locked. |
| 2. Council | ✅ Run 2026-07-28 (llm-council). Findings folded into the brief; several were overturned by Trevor afterwards — **the brief wins, not the council transcript**. |
| 0. Match-key gate | ✅ Passed 2026-07-28 against a fresh export. See above. |
| 3. Builder | ⬜ Not started. Branch `staging/brief-g-pdf-drop` exists, is level with `main` at `d33d583`, and has no build work on it. Supervised from the main conversation. |
| 4. Independent verifier | ⬜ Separate agent, never the builder. |
| 5. Browser test | ⬜ Vercel preview: drop a **fresh** PDF, confirm preview counts, confirm existing jobs' Tag/Hours/Action/VB/BL survive. |
| 6. Merge | ⬜ Needs a second "yp" from Trevor. |

Repo state at handoff: branch `staging/brief-g-pdf-drop`, clean, level with `main` at `d33d583`
(docs-only commit — closed out the truncation handoff, recorded step 0). `main` is pushed and in
sync with origin. **No app code has been written.**

---

## First moves for the next session

1. Ask Trevor for a **fresh Multitrack export** into `~/Downloads` before any browser test — the
   28 Jul one is fine for parser work but goes stale for counts.
2. Start the builder agent on **scope item 1** (port `parseMultitrackPdf.ts` from
   `BUILDS/NEW SCHEDULER BUILD/workshop-scheduler/lib/`) and **item 2** (the six-column sparse
   writer), on `staging/brief-g-pdf-drop`.
3. Then items 3 (ownership move), 3b (cutover check — **needs Trevor's eyes on DB vs Sheet**),
   4 (Jobs Sheet page), 4b (M/T swap, both copies), 5 (preview screen), 6 (count sanity-check),
   7 (duplicate protection).

---

## Scope changes go back to the brief

Brief G is scope-locked. Anything that turns up mid-build which isn't in its Scope list gets
written back into the brief for a fresh "yp" — not absorbed quietly. Per CLAUDE.md, a fix that
keeps growing new problems each review pass is a stop signal, not a cue for another guard layer.
