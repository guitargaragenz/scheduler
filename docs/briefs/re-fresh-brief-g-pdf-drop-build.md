---
doc_status: live
---

# Re-fresh — Brief G (PDF-drop import): step 0 passed, split into 1a + 1b, build starts at item 1

> **Split 2026-07-28, on Trevor's "yp".** Brief G's eight scope items now run as **two supervised
> builds** — same items, same order, nothing added or removed. **Build 1a** = the PDF actually
> imports (items 1, 2, 5, 6, 7) and merges on its own. **Checkpoint** = item 3b, which only Trevor
> can clear. **Build 1b** = the ownership move and the Jobs Sheet page (items 3, 4, 4b). Each half
> gets its own builder, verifier and browser test. See `.claude/pending-brief.md` for the reasoning
> and the safety argument.

**Written:** 2026-07-28, updated late 2026-07-28. **Status of the work:** brief approved and
scope-locked, **step 0 gate passed**, and **Build 1a's code is now written and pushed** on
`staging/brief-g-pdf-drop`. Not yet verified, browser-tested or merged. Nothing is half-finished
and nothing is broken.

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

~~**Start at scope item 1**~~ — done. Items 1, 2, 5, 6 and 7 are all built; see the protocol table
below.

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
| 3. Builder — **1a** | ✅ Built 2026-07-28 on `staging/brief-g-pdf-drop`, pushed. Four commits `77e7a15`→`23e93a8` cover items 1, 2, 5, 6, 7. 167 tests pass. |
| 4. Independent verifier — 1a | ⬜ Separate agent, never the builder. |
| 5. Browser test — 1a | ⬜ Vercel preview: drop a **fresh** PDF, confirm preview counts, confirm existing jobs' Tag/Hours/Action/VB/BL survive. |
| 6. Merge 1a | ⬜ Needs a second "yp" from Trevor. |
| 7. **Checkpoint (item 3b)** | ⬜ **Trevor only.** DB tag/hours/action/vb/bl for all ~46 jobs checked against the Google Sheet; one final CSV sync if stale. **1b does not start until this is cleared.** |
| 8. Builder — **1b** | ⬜ Fresh builder, fresh staging branch. |
| 9. Independent verifier — 1b | ⬜ Separate agent, never the builder. |
| 10. Browser test — 1b | ⬜ Edit a field in the sheet page, commit, run a CSV sync, confirm the edit survives. |
| 11. Merge 1b | ⬜ Needs a "yp" from Trevor. |

Repo state, updated 2026-07-28 late: branch `staging/brief-g-pdf-drop` at `23e93a8`, clean, pushed.
**Build 1a's app code is written** — parser, import plan, six-column writer, preview modal, import
buttons, plus tests. Next protocol step is the independent verifier, then the browser test.

---

## First moves for the next session

1. Ask Trevor for a **fresh Multitrack export** into `~/Downloads` before any browser test — the
   28 Jul one is fine for parser work but goes stale for counts.
2. ~~Start the builder agent on **Build 1a**~~ — done, all five items, pushed at `23e93a8`.
   Next: run `ggnz-verifier` against the 1a checklist, then the browser test, then merge.
3. Then the **checkpoint**: item 3b, the cutover check — **needs Trevor's eyes on DB vs Sheet**.
   Do not start 1b before he clears it.
4. Then **Build 1b** — item 3 (ownership move), item 4 (Jobs Sheet page), item 4b (M/T swap, both
   copies).

---

## Scope changes go back to the brief

Brief G is scope-locked. Anything that turns up mid-build which isn't in its Scope list gets
written back into the brief for a fresh "yp" — not absorbed quietly. Per CLAUDE.md, a fix that
keeps growing new problems each review pass is a stop signal, not a cue for another guard layer.
