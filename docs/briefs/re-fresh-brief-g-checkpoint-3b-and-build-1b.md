---
doc_status: closed
---

> **Superseded 2026-07-29.** Build 1b was built and verified in the session this brief
> handed off to. Everything below that says Build 1b "is not started" and that "no
> staging branch is open" is now false — the branch is
> `staging/brief-g-jobs-sheet-page`, built at `ccb1503` and restyled at `8b3ce93`.
> Two other facts in here were wrong when read: the M/T swap is in **four** places, not
> three (`helpArticles.js` has two passages), and `batchWriteJobsState()` is at
> `supabase.js:1356`, not `:1354`.
>
> **The live brief is
> [re-fresh-brief-g-build-1b-browser-test-and-merge.md](re-fresh-brief-g-build-1b-browser-test-and-merge.md).**
> Read that one. This file is history.

# Re-fresh — Brief G: Build 1a is shipped, checkpoint 3b is cleared. Next is Build 1b

**Written:** 2026-07-29. **Predecessor:** `re-fresh-brief-g-pdf-drop-build.md`, now `closed`.
**The instruction set is still `.claude/pending-brief.md` (Brief G)** — approved, scope-locked,
and more current than this file on anything to do with scope. Read it.

---

## 🔴 START HERE — handoff to the next session, 2026-07-29

**Everything blocking Build 1b is gone. The next session builds it.**

| | |
|---|---|
| **Repo** | `main` @ `7edf56c`, clean, pushed. No staging branch open, no worktrees. |
| **Shipped** | Build 1a — Multitrack PDF drop, six PDF fields, at `f927248`. |
| **Cleared** | Checkpoint 3b, 2026-07-29. Trevor checked all six hand-kept fields across 53 top-level jobs against the Google Sheet; it matched as-is. Job `1671`'s bad Action (`parts`) was blanked in Supabase — the job is closed and not in the Sheet, so it can't be reverted by a sync. |
| **Approved** | `.claude/pending-brief.md`, including the whole 2026-07-29 amendment (PJ as a sixth field, the JBA second export, Build 1c). Trevor said "yp" on 2026-07-29. |
| **Do next** | **Build 1b** — Brief G scope items **3, 4, 4b**, detailed further down this file. |
| **Do NOT do** | Build 1c. It comes after 1b and council has never seen it. Don't fold it in. |

**Read these two, in this order, before touching anything:**
1. `.claude/pending-brief.md` — the scope-locked instruction set. Authoritative on scope.
2. This file, from "Build 1b" down, plus "Things that are easy to get wrong".

**Protocol for 1b:** council **has run** — 2026-07-28, llm-council as-written, 5 advisors →
anonymised peer review → chairman. It reviewed Brief G's original eight scope items, which
includes 1b's items 3, 4 and 4b, and its findings are recorded in `.claude/pending-brief.md`
under "Council verdict — BINDING ON THE BUILDER". So 1b resumes at **step 3, the builder** —
`ggnz-builder` (opus) on a fresh staging branch → `ggnz-verifier` (sonnet, never the builder) →
browser test on the Vercel preview → merge on Trevor's "yp". Model discipline and the
`enforce-agent-model.py` hook apply as written in CLAUDE.md.

> The one thing council never saw in 1b is the **`PJ`** field, added on 2026-07-29. It gets
> exactly the same treatment as the five fields council did review — same ownership move, same
> grid column — so it introduces no new design question and does not warrant a re-run. **Build
> 1c is different: council has never seen any of it, and it gets its own round before it starts.**

**The one landmine to check before writing any commit path:** `upsertJobsBatch()` in
`src/utils/supabase.js`. Use the `toJobRow` + column-signature-grouping pattern instead — see the
full note under "Things that are easy to get wrong".

**Loose end, deliberately out of scope:** six jobs are in the database but absent from the
Multitrack export (`1619`, `1620`, `1626`, `1671`, `1698`, `1702`), most likely all finished but
still showing as live. This is a *status* question, not a Sheet question. It does not block 1b.
It needs its own brief — do not fold a "close missing jobs" rule into 1b or 1c on the quiet.

---

## Plain English — where this is up to

Trevor can now drop the Multitrack PDF into the Scheduler in his browser and new jobs appear.
That half is built, tested against real data, merged and live.

What's left is the second half: moving ownership of his hand-kept fields into the app, and
rebuilding the Google Sheet as a page inside the Scheduler where he edits Tag / Hours / Action /
VB / BL / PJ and presses commit.

**Between the two halves sat one job only Trevor could do** — checking that those fields
already in the database match what's in his Google Sheet. Once the app owns them, the
Sheet stops being the master copy, so whatever is in the database at that moment becomes the
truth. If it's stale, the staleness becomes permanent. That check is checkpoint 3b, and
**he cleared it on 2026-07-29. Build 1b can start.**

> ⚠️ **Widened 2026-07-29 from five fields to six.** The Google Sheet owns **eight** columns
> (`scripts/sheet_to_csv.command:32`), not five. `PJ` — the project flag — was missed, and it has
> the same two-masters problem as the rest, so it joins the check and the ownership move.
> `Days` was also missed, but it turned out **not** to belong here at all: Multitrack computes job
> age itself and prints it on a second export nobody had written down. `FirstSeen` has never
> worked. See "The job date" below, and the 2026-07-29 amendment in `.claude/pending-brief.md`.

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

## ✅ Checkpoint 3b — CLEARED 2026-07-29

**Brief G, item 3b.** Trevor checked all six fields against the Google Sheet and signed them off.
The record is at the bottom of this section. **Build 1b is unblocked.**

### The six fields being checked, and why not the other two

The Sheet owns eight columns — `MANUAL_FIELDS` at `scripts/sheet_to_csv.command:32`:
`FirstSeen`, `Days`, `Tag`, `Hours`, `Action`, `VB`, `BL`, `PJ`.

| Column | In this check? | Why |
|---|---|---|
| `Tag` | ✅ | app becomes master at 1b |
| `Hours` | ✅ | app becomes master at 1b |
| `Action` | ✅ | app becomes master at 1b |
| `VB` | ✅ | app becomes master at 1b |
| `BL` | ✅ | app becomes master at 1b |
| `PJ` | ✅ | **added 2026-07-29** — was missed by every earlier draft |
| `Days` | ❌ | becomes a computed number at Build 1c, so there is nothing to freeze |
| `FirstSeen` | ❌ | has never worked — `sheet_to_csv.command:84` looks for a column called `FirstSeen`, the Sheet's column is called `Date`, so it has always been `None`. Retired at Build 2. |

### The job date — why `Days` dropped out of this check

Trevor's Sheet has a `Date` column, and its Days is a **live formula** off that date, so it is
correct every morning without him touching it. The database's `days` is a **stored number** that
was written once and has been going stale ever since — verified 2026-07-29, the database says job
97 is 3159 days old and Multitrack says 3162.

Freezing that at cutover would freeze a wrong number that then never moves again. So `Days` is
not on the checklist. Instead, **Build 1c** adds a `first_seen` date column, populated from
Multitrack's *Jobs by Age* export, and the app computes the age on render — the same live-formula
behaviour Trevor's Sheet has, without him keeping the date by hand.

That JBA export was always meant to be part of this — two PDF drops, one for dates and one for
customer names. Only the customer one got built. See the 2026-07-29 amendment in
`.claude/pending-brief.md` for the full design; **Build 1c is not started and not part of 3b.**

### The database, as of 2026-07-29

**53 top-level jobs** (plus 8 split/derived rows, which are app-side and not part of this check).
This is the table Trevor checked against the Google Sheet on 2026-07-29. It matched as-is — no
final CSV sync was needed.

```
Job   Customer                  Tag  Hrs  Action  VB  BL  PJ  Status
------------------------------------------------------------------------------------
97    Audio Solutionz           T    3    RS-C    N   Y   N   Booked In
112   Audio Solutionz           T    3    RS-C    N   Y   N   On Hold
182   Toi Ohomai Insitute of T  SKP  4    RS      N   Y   N   On Hold
321   Sheep as Chips Ltd        SKP  6    CI      N   Y   N   On Hold
341   Audio Solutionz           T    3    RS-C    N   Y   N   On Hold
393   Toi Ohomai Insitute of T  H    3    INC     N   Y   N   Booked In
592   Sheep as Chips Ltd        SKP  6    CI      N   Y   N   On Hold
693   Toi Ohomai Insitute of T  H    3    INC     N   Y   N   Booked In
842   Greg Purcell              T    2    RS-C    N   Y   N   On Hold
875   Audio Solutionz           T    3    RS-C    N   Y   N   Active
919   Public Sound Company      T    3    RS-C    N   Y   N   On Hold
1175  Julian Henry              M    6    CI      N   Y   Y   On Hold
1268  Chris Doms                SKP  2    GTS     N   N   N   Waiting
1345  Missy Kennedy             M    2    GTS     N   N   N   Active
1382  James Sullivan            M    4    GTS     N   N   N   Booked In
1411  James Curtis              T    3    CI      N   N   N   Active
1448  Annette Papuni            H    6    CI      N   N   Y   Waiting
1505  Trident High School       EZ   2    GTS     N   N   N   Active
1513  Freedom Center            M    3    GTS     N   N   N   Booked In
1520  Pete Johanson             M    8    GTS     N   N   Y   Active
1544  Te Pukenga TA Toi Ohomai  M    2    RS-C    N   N   N   Booked In
1582  Jason Crawford            M    2    GTS     N   N   N   Active
1604  Toi Ohomai                T    5    CI      N   N   N   Waiting
1609  Paul Jones                EZ   1    GTS     N   N   N   Booked In
1616  Damon Oates               EZ   2    CI      N   N   N   On Hold
1619  Sheep as Chips Ltd        EZ   1    GTS     N   N   N   Active
1620  Sheep as Chips Ltd        EZ   1    GTS     N   N   N   Active
1621  Tony Robson               M    9    GTS     N   N   N   Booked In
1626  Griffin Beach             M    3    GTS     Y   N   N   Active
1632  Bailey Stevens            M    5    GTS     N   N   N   Active
1635  Adam Barrett              T    6    GTS     N   N   N   Waiting
1637  Tawera Simpson-Rangi      EZ   4    GTS     N   N   N   On Hold
1671  Richard Allen             M    1.5          N   N   N   Waiting   ← action blanked 2026-07-29
1676  Tony Procter              EZ   2    CI      Y   N   N   Booked In
1679  Gav Comber                M    8    GTS     N   N   Y   Waiting
1682  Papamoa College           EZ   1    GTS     N   N   N   To Be Inv
1683  Papamoa College           EZ   1    GTS     N   N   N   To Be Inv
1684  Papamoa College           EZ   1    GTS     N   N   N   To Be Inv
1685  Papamoa College           EZ   1    GTS     N   N   N   To Be Inv
1686  Papamoa College           EZ   1    GTS     N   N   N   To Be Inv
1687  Papamoa College           EZ   1    GTS     N   N   N   Active
1688  Papamoa College           EZ   1    GTS     N   N   N   To Be Inv
1689  Papamoa College           EZ   1    GTS     N   N   N   Active
1690  Papamoa College           EZ   1    GTS     N   N   N   Booked In
1698  Matt Packard              EZ   1    GTS     N   N   N   Booked In
1702  Sheep as Chips Ltd        EZ   1    GTS     N   N   N   Active
1703  Murray Spicer             EZ   4    GTS     N   N   N   Booked In
1705  Hannah Wanhill            M    2    GTS     N   N   N   Waiting
1706  Josh Allison              EZ   1    CI      N   N   N   On Hold
1708  Matt Packard              M    1    GTS     N   N   N   Booked In
1710  John Taotao               EZ   1    GTS     N   N   N   Booked In
1711  Dean Cronin                    1                        Booked In
1712  Jules Lovell                   0                        Waiting
```

**Things worth Trevor's eye specifically:**

- **`PJ` is `Y` on exactly four jobs** — `1175`, `1448`, `1520`, `1679` — and `N` on the other 47,
  except `1711` and `1712` which are unset. This column has never been eyeballed before, because
  no brief knew it existed. It is the one genuinely new thing in the widened check.
- **`1711` and `1712` have no Tag, no Action, no VB, no BL, no PJ.** These are the two jobs the PDF
  import brought in, and that is exactly right — Multitrack doesn't print those fields, so the
  import can't invent them. They need Trevor's values. Once Build 1b's sheet page exists he can
  type them there; before then they're blank.
- **`1671` has `action` = `parts`**, which is not one of the workflow codes
  (INC / CI / RS / RS-C / DG / GTS). Legacy value from the CSV era. Trevor's call whether to
  correct it.
- **`SKP`** appears as a Tag on four jobs (182, 321, 592, 1268) — not one of EZ / M / T / H.
  Same question: legacy, or intentional?
- **6 jobs are in the database but not in the latest PDF**: `1619`, `1620`, `1626`, `1671`,
  `1698`, `1702`. Reported only, never deleted. `1620` is confirmed complete — Trevor said so.
  These are the same six that have no `days` value and don't appear in the JBA export either.

To re-pull this table fresh:

```bash
cd "/Users/admin/Desktop/1. PROJECTS/Business/AI FILES/GGNZ SCHEDULER PROJECT" && set -a && . ./.env && set +a && curl -s "$VITE_SUPABASE_URL/rest/v1/jobs?select=id,customer,tag,hours,action,vb,bl,pj,status&order=id.asc" -H "apikey: $VITE_SUPABASE_ANON_KEY" -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY"
```

> Note: `order=id.asc` sorts as text, so `1712` comes before `182`. Harmless for reading, but
> don't mistake it for missing rows.

---

### 📝 Record the outcome here — the 3b session must fill this in before it ends

**This is not optional.** Build 1b freezes whatever is in the database as the permanent truth
for these six fields. If the only record of what was checked and corrected is a session
transcript, the next session is taking it on trust. Write it down, commit it, push it.

**Status: ✅ CLEARED 2026-07-29.** All six fields checked against the Google Sheet. Build 1b is
free to start.

- **Cleared on:** 2026-07-29
- **Cleared by:** Trevor, session `0ca0ef1e` (Micky)
- **Sheet vs database:** ☑ **matched as-is** — no final CSV sync needed
- **If a sync was run:** n/a — none run, table above pulled straight from Supabase 2026-07-29
- **Job count at cutover:** **53** top-level jobs (8 split/derived rows excluded)
- **`1671`'s Action was `parts`** (not a valid workflow code) → Trevor's decision: **blank it out.**
  ☑ **applied 2026-07-29** — `action` set to `NULL` in Supabase, verified on the returned row.
  No Sheet-side change was needed: **job 1671 is closed and is not in the Google Sheet at all**,
  so no CSV sync can put `parts` back.
- **`SKP` used as a Tag** on 182 / 321 / 592 / 1268 (not EZ/M/T/H) → Trevor's decision:
  **legacy, leave it anyway.** No change. It will be one of the values the 1b sheet page has to
  tolerate rather than reject.
- **`1711` and `1712` blank** on Tag/Action/VB/BL/PJ → ☑ **left blank, to be typed into the new
  sheet page** once Build 1b ships.
- **`PJ` — Y on 1175 / 1448 / 1520 / 1679, N on the other 47:** ☑ **confirmed correct** by Trevor,
  2026-07-29. Those four are the project jobs; nothing else is.
- **Anything else corrected:** nothing. Everything else matched.
- **Anything deliberately left wrong, and why:** `SKP`, above — legacy tag values Trevor wants
  kept. Also `days`, which is stale in the database (job 97 reads 3159, Multitrack says 3162);
  deliberately not corrected here because Build 1c replaces the stored number with a computed one.

### ⚠️ One thing 3b does not cover, raised while clearing it

**Job `1671` is closed, but the database still has it as `Waiting`** — i.e. live work sitting in
the blocked pile. It is one of the **six jobs in the database that aren't in the Multitrack
export** (`1619`, `1620`, `1626`, `1671`, `1698`, `1702`), and `1620` was already known to be
complete. The likeliest reading is that **all six are finished jobs the app never heard about**,
because the PDF import deliberately reports missing jobs and never deletes them.

This does **not** block Build 1b. `status` comes from Multitrack, not the Google Sheet, so it is
not one of the six fields being frozen — the app already gets it right on every import for every
job Multitrack still lists. But six dead jobs showing as Active / Booked In / Waiting is wrong on
the board today, and it will stay wrong until someone decides how the app learns a job is gone.

**Not in Brief G's scope.** Per the scope lock, it goes back to `.claude/pending-brief.md` if it
is to be built, or gets its own brief. Do not fold a "close missing jobs" rule into 1b or 1c on
the quiet — silently deleting or completing jobs on an import is exactly the class of change that
needs its own council round.

Build 1b may now start at protocol step 3.

---

## ⬜ Build 1b — next. The checkpoint has cleared.

Brief G scope items **3, 4, 4b**. Fresh builder agent, fresh staging branch, full protocol
again — council is already done and its findings still stand, so it starts at step 3.

| Item | What it is |
|------|-----------|
| 3 | Ownership move — the app becomes master for Tag / Hours / Action / VB / BL / **PJ** |
| 4 | Jobs Sheet page — all jobs in a grid, edit the six fields, commit button |
| 4b | Fix the Medium/Tricky swap in **all three** copies: `inferTag()` at `src/data/jobs.js:172`, `infer_tag()` at `scripts/sheet_to_csv.command:295-300`, and the user-facing help text at `src/data/helpArticles.js:154`. Correct order is EZ ≤1.5h → **M ≤3h → T ≤5.5h** → H |

> ⚠️ **Both rows widened 2026-07-29.** Items 3 and 4 previously said five fields; `PJ` was
> missed. And 4b previously said "both copies" — there is a third, the help article, which
> tells Trevor the wrong thresholds in plain English inside the app. Fixing the code and
> leaving the help text is worse than fixing neither.

Protocol steps still to run for 1b: builder (`ggnz-builder`, opus) → independent verifier
(`ggnz-verifier`, sonnet, never the builder) → browser test (edit a field in the sheet page,
commit, run a CSV sync, confirm the edit survives) → merge on Trevor's "yp".

**Build 1c — the JBA drop and computed job age — is separate, comes after 1b, and has not been
through council.** Its scope is in `.claude/pending-brief.md`, items 8–12. Don't fold it into 1b.

---

## Things that are easy to get wrong — carried forward, all learned the hard way

- **The Sheet owns eight columns, not five. `grep MANUAL_FIELDS scripts/sheet_to_csv.command`.**
  Every brief in this series was written by looking at the *app* and never at the *Sheet*, which
  is why `PJ`, `Days` and the whole JBA export went missing for months. One grep on the one line
  that defines what Trevor maintains by hand would have caught all three on day one. If a brief
  ever again says "Trevor's hand-kept fields are X, Y, Z" — check that line before believing it.
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
