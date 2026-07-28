# Pending Brief G — PDF-drop import, Build 1

**Status:** ✅ **APPROVED by Trevor, 2026-07-28 ("yp").** Scope is locked to what is written below.
Build proceeds on a staging branch. Anything not in the Scope list is out — bring scope changes back
here for a fresh "yp" rather than absorbing them mid-build.
**Date:** 2026-07-28
**Repo state:** `main` @ `65cadc0` (PR #7, planning tags + pile colours, merged)
**Predecessor:** the scope-and-council session, whose brief was deleted in the 2026-07-28 briefs
cleanup once its content landed here (recover with `git log -- docs/briefs/`). Scope was agreed by
Trevor; council has since run (llm-council, as-written, 5 advisors → anonymised peer review →
chairman).
Brief F (Waiting/Planning chips) shipped and is archived at `docs/briefs/brief-f-waiting-chip-shipped.md`.

---

## Plain-English summary

Today the Multitrack PDF goes into a DropBox folder, a background script on Micky picks it up,
turns it into a CSV, and pushes that into the database. Several moving parts Trevor never sees.

The goal: drop the PDF straight into the Scheduler in the browser and new jobs appear.

The catch the council was asked to solve: the PDF only contains **six** things about a job —
job number, customer, manufacturer, model, status, and the fault description. Five things Trevor
maintains by hand are **not in the PDF at all**: Tag, Hours, Action, VB, BL.

The danger, confirmed in the live code: the current save routine writes *every* column on *every*
job in one go. Dropping a PDF today would blank Tag, Action, VB, BL and job age on all ~46
existing jobs — weeks of markup gone in one click. This is the same bug that already bit the
job-age column once and was patched with `preserveKnownDays()`.

**The fix, in one sentence Trevor can repeat:** the PDF can only fill in the six things it
actually says; everything else is his, and the import can never touch it.

**One thing the council found that nobody had noticed:** there is currently **no way to type
Action, VB or BL into the app at all**. They have only ever arrived from the Sheet. So a
PDF-dropped job would land with three blank fields and nowhere to fill them in. Adding those
editors is therefore part of this build, not a later nicety. Action matters most — it is what
sorts jobs into the Planning and Waiting piles.

**Tag turned out not to be a problem at all** (Trevor, 2026-07-28). Tag is *effort* — Easy,
Medium, Tricky, High — and its only job is to become an Hours number. That conversion happens in
the Google Sheet, never in this app; the app just receives the finished hours. The cards show
hours, not tags. So under PDF-drop there is nothing to replace: Trevor sets the hours on the card
directly, which he already does. Tag needs no editor and no inference.

---

## Council verdict — BINDING ON THE BUILDER

Run 2026-07-28. Five advisors, anonymised peer review, chairman synthesis. All code claims below
were re-verified against the live tree before this brief was written.

### Verified facts (do not re-litigate)

- `upsertJobsBatch()` (`src/utils/supabase.js:159`, aliased as `saveJobsMasterBatch` at :1217)
  hardcodes ~20 columns on every row of the batch, including `tag`, `action`, `hours`,
  `vb`, `bl`, `days`. A Supabase array upsert sends the **union** of all rows' keys, so any
  column named on one row is NULL-filled across the whole batch.
- **The safe writer already exists.** `batchWriteJobsState()` (`src/utils/supabase.js:1231`)
  maps only the keys actually present via `toJobRow()` (:129), then **groups rows by their exact
  column signature** so a sparse row is never NULL-filled by a fuller one in the same request.
  The pattern is in production and commented. The PDF path does not need a new writer invented.
- Every job upsert conflicts on `id`, and for a top-level job **`id` is the job number**.
- **Hours is NOT inferred from the description.** `parseCSV()` reads it straight from the CSV's
  Hours column (`parseFloat(obj.Hours) || 0`, `src/data/jobs.js:322`), then defaults to **1h** for
  a schedulable job with no hours (:329). `inferBench()` infers the *bench* from description
  keywords; `benchHours` only sizes split subtask cards in `createSubtasks()`. An earlier draft of
  this brief claimed hours were keyword-inferred — that was wrong, corrected 2026-07-28.
- **Tag is effort/difficulty, not a workflow code** (Trevor, 2026-07-28): Easy / Medium / Tricky /
  High, stored as `EZ` / `M` / `T` / `H`. The workflow codes INC/CI/RS/RS-C/DG/GTS live in the
  **Action** column — a different field. Do not conflate them.
- **Tag drives Hours, and that conversion happens in the Google Sheet, not in this app.** Trevor
  sets the effort in the Sheet; the Sheet turns it into a number; the app only ever receives the
  finished Hours. There is no Tag→Hours mapping anywhere in the codebase.
- **`job.tag` is vestigial.** It appears in exactly two live lines — written at
  `src/utils/supabase.js:187`, read back at `src/hooks/useSupabase.js:67`. Nothing displays it and
  nothing branches on it. The job cards show **hours**, not the tag. (`helpArticles.js:154` claims
  cards show difficulty tags — stale doc.)
- **`inferTag()` (`src/data/jobs.js:172`) has T and M swapped** (confirmed by Trevor, twice). It
  reads EZ ≤1.5h → T ≤3h → M ≤5.5h → H, but Tricky is *more* work than Medium, so it should be
  EZ ≤1.5h → M ≤3h → T ≤5.5h → H. Dormant today because nothing reads `job.tag`; it also only
  fires when the Tag cell is blank, and the Sheet fills it. **Decision 2 below makes it live.**
  The **same swap is duplicated** in `scripts/sheet_to_csv.command:295-300` (`infer_tag`) and both
  copies must be fixed together, because Build 1 runs both paths at once.
- **Hours in the Sheet can be a range, and the pipeline averages it.**
  `scripts/sheet_to_csv.command:319` — if the raw Hours cell contains `-` (e.g. `2-4`), it takes
  the mean (3). Trevor uses this. The Jobs Sheet page must accept a range in the Hours cell, or
  he loses a way of working he has today.
- ⚠️ **Jobs with no Hours *and* no Days are dropped on the floor today.**
  `scripts/sheet_to_csv.command:335` skips them entirely — they never reach the app, with no error.
  A dropped PDF supplies **neither**. So on the PDF path this rule must not apply, or every
  imported job vanishes silently and it looks like "the import is broken". Covered in scope item 2.
- **`SKP` (Skip) does not exist in the code.** It appears in pre-migration backup data only. Per
  Trevor, every SKP job is already On Hold or Waiting, so it is already handled as blocked —
  **do not add SKP handling; it would risk breaking blocked-pile behaviour for no gain.**
- Ownership of master vs state fields is decided by JS constants in `src/data/joinJobs.js`
  (`NON_MASTER_FIELDS`, `DERIVED_STATE_FIELDS`) — **not** by a database migration.
- **No in-app editor exists for Tag, Action, VB or BL.**
- **`JobDrawer.jsx` (400 lines) is the manual split editor** — bench rows, sessions, per-session
  hours, day picker. Hours is editable there, but as *split/session* hours; for an unsplit job the
  drawer hydrates a single row from `job.bench`/`job.hours` (:59), so editing it does set the job's
  hours. This file is **out of scope** — see the warning under "The Jobs Sheet page".

### The five decisions — resolved

1. **Existing jobs — never touched.** The PDF write path sends six columns and only six:
   job/ref, customer, mfr, model, status, desc. Tag, Hours, Action, VB, BL and days are
   *physically absent* from the write — not "preserved", not "merged". Nothing to get wrong.
   Rejected: a second `preserveKnownDays()`-style guard. Per CLAUDE.md, symptom-patching is a
   stop signal, and a preserve-merge still reads, still sends, and still can be wrong.
2. **New jobs — bench inferred, hours default to 1h, the rest blank.** Run the existing
   `inferBench()` keyword inference on the PDF description, exactly as the CSV path does. Hours
   takes the existing 1h default for a schedulable job and **Trevor adjusts it on the job card**,
   which he already does today and is happy to keep doing (his call, 2026-07-28). Action, VB and
   BL start visibly empty.
   **Tag now gets a column in the Jobs Sheet page** (Trevor: *"I edit sheet in app Tags and
   Actions"*). Superseded the earlier "no Tag editor" line — that was written when field entry
   still meant per-job drawer editors.
   **DECIDED, 2026-07-28 — option (b): picking a Tag auto-fills Hours, still hand-overridable.**
   Trevor: *"b as they convert now"*. Tag stops being decoration and finally drives something.

   **The conversion.** Today it lives only as a formula inside the Google Sheet — confirmed absent
   from both `src/data/jobs.js` and `scripts/sheet_to_csv.command`, which merely read a finished
   Hours number. Trevor supplied the thresholds, and separately confirmed **M and T are the wrong
   way round in them**. Corrected, the bands are:

   | Tag | Meaning | Band | Auto-filled Hours |
   |-----|---------|------|-------------------|
   | EZ  | Easy    | ≤ 1.5h | 1.5 |
   | M   | Medium  | ≤ 3h   | 3   |
   | T   | Tricky  | ≤ 5.5h | 5.5 |
   | H   | High    | > 5.5h | 6 (Trevor's number, 2026-07-28 — the band is open-ended so it has no ceiling to take) |

   The bands are *ceilings*, so each Tag auto-fills the top of its band. Trevor overrides on the
   job card whenever the estimate is finer than the band — which he already does today, and will
   do often for H, since 6 is that band's floor rather than a typical value.
   Because (b) is now live, the `inferTag()` M/T swap is **no longer dormant** — see scope item 4b,
   and the identical swap in `scripts/sheet_to_csv.command:295-300` must be fixed with it or the
   two paths will disagree while both are running in Build 1.

   Rejected: inferring Action from fault text — a wrong Action looks filled-in, never gets
   reviewed, and would mis-sort the Planning and Waiting piles.
3. ~~Do NOT move the five fields to the app-owned side in this build.~~
   **OVERTURNED BY TREVOR, 2026-07-28. The five fields MOVE app-side in Build 1.**

   The council's answer was correct on the facts it had: leave ownership alone, because nothing in
   the app could edit those fields anyway, so there was nothing to protect. Trevor then changed the
   design — see "The Jobs Sheet page" below — and that assumption no longer holds.

   **Why the move is now mandatory, not optional.** With an editable sheet page in the app *and*
   the CSV still importing those columns, two masters write the same field. Trevor changes Action
   from `CI` to `GTS` and commits; the next CSV sync still says `CI`; `CI` is a populated value, not
   a blank, so it wins and his edit silently reverts. A "blank never overwrites good" guard cannot
   help — nothing is blank, it is two real values disagreeing.

   **Trevor's ruling, verbatim in substance:** *"there can only be one master and after the build it
   will be the app page."*

   **The change:** `tag`, `hours`, `action`, `vb`, `bl` move to the app-owned side of
   `src/data/joinJobs.js` (`NON_MASTER_FIELDS` / `DERIVED_STATE_FIELDS`), and the CSV import path
   stops writing them entirely. This is a JS constant list, **not a database migration** — verified.
   Existing values already in the `jobs` table stay exactly as they are; the import simply stops
   overwriting them. No data moves.
4. **Preview screen, mandatory, before any write.** Three counts and two lists:
   "9 new · 34 already here · 3 in your last drop that aren't in this one", with the names of the
   9 and the names of the 3. Import / Cancel. **No field-level diff** — a line reading
   "VB: unchanged" teaches nobody. A toast tells him what already happened; that is not enough.
5. **Nothing is irreversible, so no undo button.** The writer can only insert rows and update six
   Multitrack facts; nothing Trevor typed can be lost. Log each import batch (timestamp, filename,
   row count, ids touched) for forensics.
   **Explicitly rejected: snapshot-and-restore of the `jobs` table.** Restoring the table would
   also roll back scheduling, pomodoro and split state written since the last import — a direct
   violation of the "scheduling comes out untouched" constraint.

### The Jobs Sheet page — Trevor's design, replaces the drawer editors

**Trevor's proposal, 2026-07-28, and it supersedes the council's answer to field entry:** build the
Google Sheet as a page inside the app. He edits Tag, Hours, Action, VB and BL for every job in one
grid, presses a commit button, and it saves. Exactly the workflow he has today, minus the Sheet.

**Accepted. It replaces the council's proposal to add Action/VB/BL fields into `JobDrawer.jsx`.**
Bulk entry is the entire point of a sheet; opening 46 drawers one at a time to set an Action is not
a workflow that survives a real week.

> ⚠️ **`JobDrawer.jsx` IS NOT TOUCHED BY THIS BUILD.** It is the **manual split editor** — benches,
> sessions, per-session hours, day picker — and it is a completely separate concern from job admin.
> Nothing in it is removed, moved or changed. The "drawer editors" being dropped are three fields
> that **were never built** — a council proposal, not existing functionality. An earlier phrasing of
> this brief said "drawer editors are out", which read as removing splits. It does not. Splits stay.

Design constraints:

- **Explicit commit. No autosave.** Trevor's own instinct and the right one — he sees what he
  typed, presses the button, it goes. Same shape as the import preview screen.
- **Only the five app-owned columns are editable.** The six Multitrack facts (job, customer, mfr,
  model, status, desc) render read-only/greyed. Multitrack owns those; the sheet must not offer to
  fight it.
- **Action is a picker, not free text** — INC / CI / RS / RS-C / DG / GTS / blank. It drives the
  Planning and Waiting piles, so a typo would silently mis-sort a job.
- **The save reuses `batchWriteJobsState()`** (`src/utils/supabase.js:1231`) — already sparse,
  already column-signature-grouped, already in production. Commit writes only the columns actually
  edited. **Do not write a new batch writer, and do not call `upsertJobsBatch()`.**
- **Desktop-first.** Micky is where this gets used. On iPhone the page may be read-only rather than
  a bad grid; confirm with Trevor before building a mobile editing mode.
- Note against `trevor-needs-focus-windows` (one-thing-at-a-time, never grids): that rule stands for
  UI *proposed to* Trevor. This grid is a form factor he has used daily for years and explicitly
  asked for. Not a violation.

### The CSV back door — closed by the ownership move, not by a guard

The Contrarian's catch: with both importers live, the CSV path would overwrite what Trevor types in
the app. The council's fix was to widen `preserveKnownDays()` to cover tag + action + vb + bl.

**That fix is now dropped, and this is the better outcome.** Once the CSV import stops writing those
five columns (decision 3), there is no back door left to guard — the CSV cannot overwrite what it no
longer sends. Widening the preserve guard would have been a patch on a problem the ownership move
deletes outright. Per CLAUDE.md: root cause over patches.

`preserveKnownDays()` stays exactly as it is, still covering `days` only. `days` is a Multitrack
fact that legitimately still arrives by import, and its blank-never-overwrites-good rule is still
needed there. **Do not widen it. Do not remove it.**

Rule in one sentence: *Multitrack owns the six facts about the guitar; the app page owns everything
Trevor decides; neither can write the other's columns.*

### Also binding

- **Missing jobs are reported, never deleted and never auto-completed.** The PDF is a snapshot;
  a job absent from today's file might be finished, or might be a short parse.
- **Status from the PDF always wins** — it is Multitrack's fact and it drives the pile colours
  just merged in PR #7. A status that disagrees with Trevor's Action is information, not a conflict.
- **Scheduling untouched throughout** — no calendar slots, bench assignments or split state written
  by any part of this build.

---

## Step 0 — the gate, before any import code

**Prove the job numbers match.** Parse the real Multitrack PDF and print its refs beside the ~46
job numbers already in Supabase. They must match character for character.

Missed by all five advisors, caught by four of five reviewers. Because `id` *is* the job number
and the upsert conflicts on `id`, a ref that parses even slightly differently — a trailing space,
a dropped leading zero, different formatting — does not update the existing job. It **silently
creates a second one** with five blank fields, and every count on the preview screen still looks
correct. Duplicate protection, preserve behaviour and the preview counts all assume this lookup works.

Throwaway script, no app changes, decides whether Build 1 is a week or a month.
**If the refs do not match cleanly, stop and come back to Trevor before building anything.**

---

## Scope — Build 1, in order

0. **Match-key proof** (above). Report the result before writing import code.
1. **Port the parser** — `lib/parseMultitrackPdf.ts` from
   `/Users/admin/Desktop/1. PROJECTS/Business/AI FILES/BUILDS/NEW SCHEDULER BUILD/workshop-scheduler/`
   into this repo (JS, `pdfjs-dist`). Six fields out, nothing more.
2. **Six-column sparse PDF writer** — reuse the `toJobRow` + column-signature-grouping pattern from
   `batchWriteJobsState()`. Explicit six-name allow-list. Do **not** call `upsertJobsBatch()`.
   **The "no Hours and no Days ⇒ skip the job" rule must not apply on this path** — a PDF has
   neither, so leaving it in place would silently import nothing. See the ⚠️ note in Verified facts.
3. **Move ownership of `tag`, `hours`, `action`, `vb`, `bl` app-side** — the constants in
   `src/data/joinJobs.js`, plus stop the CSV import path writing those five columns. No DB
   migration, no data movement. **Do this before step 4**, so the sheet page never ships into a
   world where the CSV can revert it.
   ~~Widen `preserveKnownDays()`~~ — dropped, see "The CSV back door" above. Leave it days-only.
3b. **Cutover check.** The moment the CSV stops writing these columns, whatever is in the `jobs`
   table becomes the permanent starting point. Before the switch, print the current tag / hours /
   action / vb / bl for all ~46 jobs beside the Google Sheet's values and confirm with Trevor they
   match. If the DB is stale anywhere, one final CSV sync fixes it *before* ownership moves.
4. **The Jobs Sheet page** — all jobs in a grid; the five app-owned columns editable, the six
   Multitrack columns read-only; Action as a picker; explicit commit button, no autosave; save via
   `batchWriteJobsState()`. See "The Jobs Sheet page" above for the full constraints.
   **`JobDrawer.jsx` is not touched.** It is the manual split editor and stays exactly as it is.
   The council's idea of adding Action/VB/BL fields into it is dropped — those fields were never
   built, so there is nothing to remove.
   **The Hours cell must accept a range** (`2-4`), averaged the way the Sheet pipeline already
   does it — Trevor uses ranges today and must not lose them.
   **Picking a Tag auto-fills Hours** per the table in decision 2, still hand-overridable.
4b. **Fix the M/T swap in BOTH copies** — `inferTag()` at `src/data/jobs.js:172` and `infer_tag()`
   at `scripts/sheet_to_csv.command:295-300`. No longer optional: decision 2 resolved to option
   (b), so the mapping is live. Both must move together — Build 1 runs both paths at once, and
   fixing only one makes them disagree.
5. **Preview screen** — counts, new-job names, missing-job names, Import / Cancel.
6. **Count sanity-check** — a short parse refuses to import rather than importing partially.
7. **Duplicate protection** — re-dropping the same PDF never creates a second copy.

## Out of scope — do not build

- Retiring the DropBox/watcher/CSV pipeline. That is **Build 2**, a separate brief, after real
  PDFs have imported successfully.
- ~~Moving Tag/Hours/Action/VB/BL to the app-owned side of `joinJobs.js`.~~ **Now IN scope** —
  Trevor overturned this 2026-07-28. See decision 3.
- Any snapshot/restore or undo button.
- Auto-deleting or auto-completing jobs missing from the PDF.
- **Any SKP (Skip) handling.** Per Trevor, every SKP job is already On Hold or Waiting and is
  therefore already treated as blocked. Adding SKP logic risks breaking blocked-pile behaviour
  for no gain. Leave it alone.
- Editing the six Multitrack-owned columns anywhere in the app. Multitrack owns those; if one is
  wrong, it gets fixed in Multitrack and arrives on the next drop.
- Writing back to the Google Sheet. The flow is one-way and the Sheet is on its way out.
- Inferring Action from fault text; provenance/"suggested vs confirmed" flags; a hours-estimate
  learning loop; a daily triage screen with inline editing. All proposed by one advisor, all
  rejected as Build-1 scope creep that would require Trevor to babysit the build.
- Anything in `SCHEDULER_old/`. Anything touching scheduling, calendar slots or bench assignment.
- Deleting dead `useFirebase.js` (noted, separate housekeeping).

---

## Method — agent-team protocol

1. **Brief** — this file. ✅ Approved by Trevor 2026-07-28.
2. **Council** — ✅ done 2026-07-28 (llm-council, as-written). Findings above are binding; the
   builder does not reopen them.
3. **Builder** — staging branch, supervised from the main conversation.
4. **Independent verifier** — separate agent, never the builder.
5. **Browser test** — Vercel preview: drop a real PDF, confirm the preview counts, confirm existing
   jobs keep their Tag/Action/VB/BL, confirm scheduling is untouched.
6. **Merge** — Trevor's "yp".

**No commits before step 1 is approved.**
