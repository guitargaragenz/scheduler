---
doc_status: live
---

# Re-fresh — Brief G: Build 1a is shipped. Next is checkpoint 3b (Trevor only), then Build 1b

**Written:** 2026-07-29. **Predecessor:** `re-fresh-brief-g-pdf-drop-build.md`, now `closed`.
**The instruction set is still `.claude/pending-brief.md` (Brief G)** — approved, scope-locked,
and more current than this file on anything to do with scope. Read it.

---

## Plain English — where this is up to

Trevor can now drop the Multitrack PDF into the Scheduler in his browser and new jobs appear.
That half is built, tested against real data, merged and live.

What's left is the second half: moving ownership of his five hand-kept fields into the app, and
rebuilding the Google Sheet as a page inside the Scheduler where he edits Tag / Hours / Action /
VB / BL and presses commit.

**Between the two halves sits one job only Trevor can do** — checking that the five fields
already in the database match what's in his Google Sheet. Once the app owns those fields, the
Sheet stops being the master copy, so whatever is in the database at that moment becomes the
truth. If it's stale, the staleness becomes permanent. That check is checkpoint 3b, and
**Build 1b does not start until Trevor clears it.**

---

## ✅ Build 1a — SHIPPED

Merged to `main` and pushed on 2026-07-29 as **`f927248`** ("Brief G / Build 1a: drop a
Multitrack PDF, import the six PDF fields"). Staging branch was `staging/brief-g-pdf-drop`.

Covers Brief G scope items **1, 2, 5, 6, 7**:

| Item | What shipped |
|------|--------------|
| 1 | Multitrack PDF parser ported into [`src/data/parseMultitrackPdf.js`](../../src/data/parseMultitrackPdf.js) |
| 2 | Six-column sparse writer `writePdfImportBatch()` in [`src/utils/supabase.js`](../../src/utils/supabase.js) |
| 5 | Preview screen — counts first, import only on a second click ([`PdfImportPreviewModal.jsx`](../../src/components/PdfImportPreviewModal.jsx)) |
| 6 | Refuses to write when the parsed count disagrees with the PDF's own footer tally |
| 7 | Refuses to write on duplicate job numbers |

Import buttons live in the Sidebar, the Job Shelf and the mobile Daily Log page.

### How it was proved

- **Independent verifier** (`ggnz-verifier`, never the builder): 13 checklist items, **12 pass,
  1 concern**. The one concern was a missing `pdf_import_log` table, since created — see below.
  It confirmed the PDF path never calls `upsertJobsBatch()`, uses column-signature grouping,
  keeps new-job rows and existing-job rows in separate signature groups so neither NULL-fills
  the other, throws on a stray field, and leaves `jobs.js`, `JobDrawer.jsx` and `joinJobs.js`
  with empty diffs against `main`.
- **167 tests pass, clean build** — re-run on merged `main`, not just on the branch.
- **Counts predicted before the test, from the database**: 2 new / 45 already here / 6 missing.
  The live preview matched exactly. That made the browser test a real check, not a rubber stamp.
- **Live import against real data.** Every row diffed before and after:
  - **0 changes** to `tag`, `hours`, `action`, `vb`, `bl`, `days` or `bench` on any existing job
  - 2 rows added (`1711`, `1712`), 0 removed
  - 7 genuine Multitrack status changes (1682–1686, 1688 Active → To Be Inv; 1635 Active → Waiting)

### Two things to know, neither a bug

- **New job `1712` landed with hours 0 and no bench.** Correct. Its status is `Waiting`, i.e.
  blocked, and the app only defaults 1h and infers a bench for schedulable jobs.
- **`pdf_import_log` was created after the live import ran**, so the table is currently empty.
  The logger is deliberately best-effort and never blocks an import. The next PDF drop writes
  the first row. Table definition is in [`docs/supabase-schema.sql`](../../docs/supabase-schema.sql),
  no RLS — consistent with every other table in that schema.

### One honest gap

No `scheduled_slots` snapshot was taken *before* the live import (26 rows after). "Scheduling
untouched" therefore rests on the verifier's code grep — nothing in the PDF path writes slots —
plus a visually unchanged board, **not** on a row-by-row before/after diff. If you want that
belt-and-braces, snapshot `scheduled_slots` before the next import.

---

## ⬜ Checkpoint 3b — Trevor only. Do this next.

**Brief G, item 3b.** Nothing gets built until Trevor says the numbers are right.

The database side is already pulled, below, as of 2026-07-29. **53 top-level jobs** (plus 8
split/derived rows, which are app-side and not part of this check). Trevor compares this
against the Google Sheet. If it's stale, one final CSV sync, then re-pull and re-check.

```
Job   Customer                  Tag  Hrs  Action  VB  BL  Status
------------------------------------------------------------------------------------
97    Audio Solutionz           T    3    RS-C    N   Y   Booked In
112   Audio Solutionz           T    3    RS-C    N   Y   On Hold
182   Toi Ohomai Insitute of T  SKP  4    RS      N   Y   On Hold
321   Sheep as Chips Ltd        SKP  6    CI      N   Y   On Hold
341   Audio Solutionz           T    3    RS-C    N   Y   On Hold
393   Toi Ohomai Insitute of T  H    3    INC     N   Y   Booked In
592   Sheep as Chips Ltd        SKP  6    CI      N   Y   On Hold
693   Toi Ohomai Insitute of T  H    3    INC     N   Y   Booked In
842   Greg Purcell              T    2    RS-C    N   Y   On Hold
875   Audio Solutionz           T    3    RS-C    N   Y   Active
919   Public Sound Company      T    3    RS-C    N   Y   On Hold
1175  Julian Henry              M    6    CI      N   Y   On Hold
1268  Chris Doms                SKP  2    GTS     N   N   Waiting
1345  Missy Kennedy             M    2    GTS     N   N   Active
1382  James Sullivan            M    4    GTS     N   N   Booked In
1411  James Curtis              T    3    CI      N   N   Active
1448  Annette Papuni            H    6    CI      N   N   Waiting
1505  Trident High School       EZ   2    GTS     N   N   Active
1513  Freedom Center            M    3    GTS     N   N   Booked In
1520  Pete Johanson             M    8    GTS     N   N   Active
1544  Te Pukenga TA Toi Ohomai  M    2    RS-C    N   N   Booked In
1582  Jason Crawford            M    2    GTS     N   N   Active
1604  Toi Ohomai                T    5    CI      N   N   Waiting
1609  Paul Jones                EZ   1    GTS     N   N   Booked In
1616  Damon Oates               EZ   2    CI      N   N   On Hold
1619  Sheep as Chips Ltd        EZ   1    GTS     N   N   Active
1620  Sheep as Chips Ltd        EZ   1    GTS     N   N   Active
1621  Tony Robson               M    9    GTS     N   N   Booked In
1626  Griffin Beach             M    3    GTS     Y   N   Active
1632  Bailey Stevens            M    5    GTS     N   N   Active
1635  Adam Barrett              T    6    GTS     N   N   Waiting
1637  Tawera Simpson-Rangi      EZ   4    GTS     N   N   On Hold
1671  Richard Allen             M    1.5  parts   N   N   Waiting
1676  Tony Procter              EZ   2    CI      Y   N   Booked In
1679  Gav Comber                M    8    GTS     N   N   Waiting
1682  Papamoa College           EZ   1    GTS     N   N   To Be Inv
1683  Papamoa College           EZ   1    GTS     N   N   To Be Inv
1684  Papamoa College           EZ   1    GTS     N   N   To Be Inv
1685  Papamoa College           EZ   1    GTS     N   N   To Be Inv
1686  Papamoa College           EZ   1    GTS     N   N   To Be Inv
1687  Papamoa College           EZ   1    GTS     N   N   Active
1688  Papamoa College           EZ   1    GTS     N   N   To Be Inv
1689  Papamoa College           EZ   1    GTS     N   N   Active
1690  Papamoa College           EZ   1    GTS     N   N   Booked In
1698  Matt Packard              EZ   1    GTS     N   N   Booked In
1702  Sheep as Chips Ltd        EZ   1    GTS     N   N   Active
1703  Murray Spicer             EZ   4    GTS     N   N   Booked In
1705  Hannah Wanhill            M    2    GTS     N   N   Waiting
1706  Josh Allison              EZ   1    CI      N   N   On Hold
1708  Matt Packard              M    1    GTS     N   N   Booked In
1710  John Taotao               EZ   1    GTS     N   N   Booked In
1711  Dean Cronin                    1                    Booked In
1712  Jules Lovell                   0                    Waiting
```

**Things worth Trevor's eye specifically:**

- **`1711` and `1712` have no Tag, no Action, no VB, no BL.** These are the two jobs the PDF
  import brought in, and that is exactly right — Multitrack doesn't print those fields, so the
  import can't invent them. They need Trevor's values. Once Build 1b's sheet page exists he can
  type them there; before then they're blank.
- **`1671` has `action` = `parts`**, which is not one of the workflow codes
  (INC / CI / RS / RS-C / DG / GTS). Legacy value from the CSV era. Trevor's call whether to
  correct it.
- **`SKP`** appears as a Tag on five jobs (182, 321, 592, 1268) — not one of EZ / M / T / H.
  Same question: legacy, or intentional?
- **6 jobs are in the database but not in the latest PDF**: `1619`, `1620`, `1626`, `1671`,
  `1698`, `1702`. Reported only, never deleted. `1620` is confirmed complete — Trevor said so.

To re-pull this table fresh:

```bash
cd "/Users/admin/Desktop/1. PROJECTS/Business/AI FILES/GGNZ SCHEDULER PROJECT" && set -a && . ./.env && set +a && curl -s "$VITE_SUPABASE_URL/rest/v1/jobs?select=id,customer,tag,hours,action,vb,bl,status&order=id.asc" -H "apikey: $VITE_SUPABASE_ANON_KEY" -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY"
```

---

### 📝 Record the outcome here — the 3b session must fill this in before it ends

**This is not optional.** Build 1b freezes whatever is in the database as the permanent truth
for these five fields. If the only record of what was checked and corrected is a session
transcript, the next session is taking it on trust. Write it down, commit it, push it.

Replace the blanks below, then commit with a message saying 3b cleared.

- **Cleared on:** `____-__-__`
- **Cleared by:** Trevor, in session `____`
- **Sheet vs database:** ⬜ matched as-is / ⬜ needed a final CSV sync
- **If a sync was run:** date `____`, and the table above re-pulled afterwards? ⬜ yes / ⬜ no
- **Job count at cutover:** `____` top-level jobs
- **`1671`'s Action was `parts`** (not a valid workflow code) → Trevor's decision: `____________`
- **`SKP` used as a Tag** on 182 / 321 / 592 / 1268 (not EZ/M/T/H) → Trevor's decision: `____________`
- **`1711` and `1712` blank** on Tag/Action/VB/BL → ⬜ filled in before cutover / ⬜ left blank, to be typed into the new sheet page
- **Anything else corrected:** `____________`
- **Anything deliberately left wrong, and why:** `____________`

Then set this file's status line for Build 1b and let the next session start at step 3.

---

## ⬜ Build 1b — after the checkpoint clears, not before

Brief G scope items **3, 4, 4b**. Fresh builder agent, fresh staging branch, full protocol
again — council is already done and its findings still stand, so it starts at step 3.

| Item | What it is |
|------|-----------|
| 3 | Ownership move — the app becomes master for Tag / Hours / Action / VB / BL |
| 4 | Jobs Sheet page — all jobs in a grid, edit the five fields, commit button |
| 4b | Fix the Medium/Tricky swap in **both** copies: `inferTag()` at `src/data/jobs.js:172` and `infer_tag()` at `scripts/sheet_to_csv.command:295-300`. Correct order is EZ ≤1.5h → **M ≤3h → T ≤5.5h** → H |

Protocol steps still to run for 1b: builder (`ggnz-builder`, opus) → independent verifier
(`ggnz-verifier`, sonnet, never the builder) → browser test (edit a field in the sheet page,
commit, run a CSV sync, confirm the edit survives) → merge on Trevor's "yp".

---

## Things that are easy to get wrong — carried forward, all learned the hard way

- **Tag ≠ Action.** Tag is *effort* — EZ / M / T / H. Action is the *workflow code* —
  INC / CI / RS / RS-C / DG / GTS. Different columns. This was conflated twice and Trevor had
  to correct it both times.
- **The exported status string is `Waiting`, not `Waiting Parts`.** Multitrack's dropdown
  *label* reads "Waiting parts" but the export is master. `src/data/jobs.js` is correct as-is.
  Do not "fix" it.
- **`JobDrawer.jsx` is the manual split editor and is out of scope.** It is not the sheet page.
  Saying "drawer editors are out" alarmed Trevor once — be precise about which editor.
- **`upsertJobsBatch()` in `src/utils/supabase.js` is the loaded gun.** It hardcodes ~20 columns
  on every row, and a Supabase array upsert sends the union of all rows' keys, NULL-filling
  across the batch. Use the `toJobRow` + column-signature-grouping pattern from
  `batchWriteJobsState()`. `writePdfImportBatch()` is now a second worked example of that
  pattern — read it before writing 1b's commit path.
- **Split/derived rows have non-numeric ids** (`1620_Electronics_0`, `1689_Luthier_1`). Never
  match, write or count them from an import path. `isTopLevelJob()` in
  `src/data/pdfImportPlan.js` is the existing test.
- **The CSV pipeline is being retired.** Don't patch it. Brief G is its replacement.
- **Always use a fresh Multitrack export into `~/Downloads`**, asked for on the day. Do not
  reach for `SCHEDULER_old/DropBox/processed/`.
- **Trevor never runs git.** Claude runs every git command, every session.

---

## Scope changes go back to the brief

Brief G is scope-locked. Anything that turns up mid-build which isn't in its Scope list gets
written back into `.claude/pending-brief.md` for a fresh "yp" — not absorbed quietly. Per
CLAUDE.md, a fix that keeps growing new problems each review pass is a stop signal, not a cue
for another guard layer.
