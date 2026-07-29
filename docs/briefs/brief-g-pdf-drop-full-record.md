doc_status: closed

> **Shipped.** Brief G's complete working record: Build 1a `f927248`, 1b `f2ee449`,
> 1c `b665e1d`. Nothing in this file is a task list. Kept for the council reasoning on
> sparse upserts (`23502`), the migration-by-hand mechanism, the six `days` read sites,
> and the NZ local-date rule. Build 2 is scoped in `.claude/pending-brief.md`, not here.

# Pending Brief G — PDF-drop import, Build 1 (split into 1a + 1b)

**Status:** ✅ **APPROVED by Trevor, 2026-07-28 ("yp").** Scope is locked to what is written below.
**Split into two supervised builds 2026-07-28, also on Trevor's "yp"** — same eight scope items,
same order, nothing added or removed, with a Trevor-only checkpoint (item 3b) between the halves.
Build proceeds on a staging branch. Anything not in the Scope list is out — bring scope changes back
here for a fresh "yp" rather than absorbing them mid-build.
**Amendment approved by Trevor, 2026-07-29 ("yp")** — the whole 2026-07-29 amendment below,
including Build 1c, is now in scope.
**Next action — updated 2026-07-29 after the 1b merge:** Build 1a is **shipped** (`f927248`).
Checkpoint 3b was cleared 2026-07-29 against the widened six-field list. **Build 1b is shipped
(`f2ee449`)** — full protocol run, verifier 21/21, browser test five of six items live with the
sixth dropped deliberately, merged on Trevor's "yp". Its working record is
`docs/briefs/re-fresh-brief-g-build-1b-browser-test-and-merge.md`, now `closed`.
**✅ BUILD 1c IS SHIPPED — merged to `main` at `b665e1d`, 2026-07-29.** Full protocol run: brief
approved, two `ggnz-council` reviews (both "proceed with changes", folded into items 8/8b/9/10/11/12
as the ⚡ notes), `ggnz-builder` on staging branch `build-1c-jba-first-seen`, independent
`ggnz-verifier` (pass on every code-checkable item), browser test on the Vercel preview, merged on
Trevor's "yp".

Closed out at merge, so the record is here and not only in the transcript:
- **Item 8** — Trevor ran the `ALTER TABLE` in the Supabase SQL editor; `first_seen` confirmed
  present and readable by a live `SELECT` before any write existed. Now also in
  `docs/supabase-schema.sql`, so the checked-in schema matches the live database.
- **Item 8b (match-key gate)** — run against the real `GGNZ JBA 29 Jul.pdf`: 47 refs parsed, PDF's
  own footer stated 47, **47/47 matched `jobs.id`, 0 unmatched, 0 near-misses**, 0 refs missing a
  Date In. 6 top-level DB jobs absent from the JBA (1671, 1698, 1702, 1619, 1620, 1626) — the
  legitimate extras this brief predicted; they are reported, never deleted. Gate closed.
  The proof script was a throwaway and is deleted by design, which is why a code-only review cannot
  re-confirm this — that is expected, not a gap.
- **Browser test** — job 97 reads **3162**, not the stale 3159. Every job was exactly 3 days behind
  before the import, confirming the staleness was systematic rather than per-job.

**This whole file is now history.** Nothing in it is a task list. The next brief to write is
**Build 2 — retire the CSV pipeline**, which is not scoped here.

**Standing order from Trevor, 2026-07-29:** *"save all UI changes until after PDF drop implemented
successfully and CSV pipeline gone"*. So the queue is **1c → Build 2 (retire the CSV pipeline) → any
UI work**, and no look-and-feel change gets slipped in ahead of it, however small. The two parked UI
briefs (`docs/briefs/parked-jobs-sheet-usability-changes.md` and
`docs/briefs/appointments-not-showing-on-the-calendar.md`) are held by this ordering, not by
anything technical. Note this makes **Build 2 the next brief to write after 1c ships**, and it is
still out of scope for this one.
**Date:** 2026-07-28, amended 2026-07-29
**Repo state:** `main` @ `482feb9`, clean. (Was `65cadc0` when this brief was written.)
**Predecessor:** the scope-and-council session, whose brief was deleted in the 2026-07-28 briefs
cleanup once its content landed here (recover with `git log -- docs/briefs/`). Scope was agreed by
Trevor; council has since run (llm-council, as-written, 5 advisors → anonymised peer review →
chairman).
Brief F (Waiting/Planning chips) shipped and is archived at `docs/briefs/brief-f-waiting-chip-shipped.md`.

---

## AMENDMENT — 2026-07-29 — the job date, and the fields this brief missed

**Why this exists.** Trevor asked "where is the original date column?" during checkpoint 3b. It
wasn't in the checkpoint, and chasing that turned up a false claim in this brief plus a whole
export nobody had written down. A full audit of every live and parked brief followed. This section
records what changed. **Approved by Trevor 2026-07-29 ("yp")** — the sections below are new
scope on top of a scope-locked brief, so they needed their own approval, and they have it.

### What was wrong

1. **The `days` claim was false.** Fixed in place under "The CSV back door" below.
2. **The Google Sheet owns eight columns, not five.** `scripts/sheet_to_csv.command:32`:
   `MANUAL_FIELDS = ['FirstSeen', 'Days', 'Tag', 'Hours', 'Action', 'VB', 'BL', 'PJ']`.
   This brief's ownership move (decision 3) and checkpoint 3b both cover five of them.
   `Days` and `PJ` had no plan; `FirstSeen` has never worked at all.
3. **The second PDF export was missing from every document in this repo.** See below.
4. **The M/T swap has three copies, not two.** Fixed in place under Verified facts.

### The second export — Jobs by Age (JBA)

Multitrack has **two** open-jobs exports, and they are complementary. Trevor has said this more
than once across sessions; it reached a memory file and no brief. **Verified 2026-07-29 against
`GGNZ JBA 29 Jul.pdf` and `GGNZ Jobs 28 Jul.pdf` — both report 47 jobs, the same job set.**

| | Medium Job Search (the one 1a imports) | Jobs by Age (JBA) |
|---|---|---|
| Job number | ✅ | ✅ |
| Customer | ✅ | ❌ **not present** |
| Mfr / Model / Status / Desc | ✅ | ✅ |
| **Date In** | ❌ | ✅ `2017-12-01` |
| **Days** | ❌ | ✅ `3162`, computed by Multitrack |

**Multitrack already calculates the age.** The Google Sheet was recomputing a number Multitrack
hands over for free. That is the whole reason the date went missing from this brief — the app has
no date column, so nothing on the code side pointed at it.

Column layout differs between the two files (JBA is date-led, Mfr wraps to two lines on long
names, and x-positions shift partway down the document). It needs its **own parser**, not a flag
on the existing one.

### The freeze problem — Trevor, 2026-07-29

> *"after the initial first JBA drop the pipeline only accepted Jobs pdf so the G sheet never
> received the JBA again bc I entered date in manually, so I made the Days column calculate based
> on date in. Would be nice to have that again instead of having to drop 2 pdfs, but not a deal
> breaker."*

This is the part that matters. **In the Sheet, Days is a live formula off Date In — it re-ticks
every morning.** A number copied into the database does not. Verified 2026-07-29: the database says
job 97 is **3159** days old; the JBA export says **3162**. It is already three days behind, and
under Build 1b with the CSV switched off it would sit at 3159 forever.

**So storing `days` as a number is the wrong shape, whoever owns it.**

### DECISION — Days is computed, not stored. Date In is what gets imported.

- Add a **`first_seen` date column** to the `jobs` table. Additive migration, nothing dropped,
  nothing rewritten. This is the one real schema change in Brief G.
- The **JBA drop writes `first_seen`** (and nothing else it doesn't own).
- **The app computes age on render:** `days = today − first_seen`. It re-ticks daily on its own,
  exactly like the Sheet formula, with no drop and no sync required.
- **This is what answers Trevor's "would be nice".** Once a job has its `first_seen`, its age is
  correct forever. JBA is only needed to *fill in a date the app doesn't have yet* — so routine
  days stay a single Jobs-PDF drop, and JBA gets dropped when new jobs arrive (or whenever, it is
  idempotent). Two drops is not the steady state; one is.
- `days` stays as the stored column for now and `preserveKnownDays()` stays, so nothing breaks on
  day one. Once `first_seen` is populated for every job, `days` becomes dead and gets removed in
  Build 2 — **not in this build.**
- `FirstSeen` in the CSV script stays broken and unused. It is not worth fixing something that is
  being retired; the JBA path replaces it.

### DECISION — `PJ` moves app-side with the other five. Six columns, not five.

`PJ` is the project flag, Sheet-owned, in neither PDF, and read at `src/data/jobs.js:351`
(`project: obj.PJ === 'Y'`). It has exactly the two-masters problem decision 3 describes. Verified
live 2026-07-29: 4 jobs are `Y` (1175, 1448, 1520, 1679), 47 are `N`, 2 are unset (1711/1712 — the
PDF-imported ones, correctly untouched by 1a's six-column writer).

Wherever this brief says *"the five fields"* or *"`tag`, `hours`, `action`, `vb`, `bl`"*, read
**six**: `tag`, `hours`, `action`, `vb`, `bl`, `project`. That applies to decision 3, the Jobs
Sheet page, scope item 3, scope item 4 and checkpoint 3b. `PJ` renders as a checkbox, same as VB
and BL.

### Checkpoint 3b is widened

3b now checks **six** columns against the Sheet, not five. `days` is deliberately **not** in the
check — it stops being a hand-kept value the moment `first_seen` lands, so freezing it correctly
is no longer the goal. See `docs/briefs/re-fresh-brief-g-checkpoint-3b-and-build-1b.md`.

### New scope item — Build 1c

Added as a **third supervised build**, after 1b. It does not block 1b and 1b does not block it;
they touch different columns. Full detail at the end of the Scope section.

---

## Plain-English summary

Today the Multitrack PDF goes into a DropBox folder, a background script on Micky picks it up,
turns it into a CSV, and pushes that into the database. Several moving parts Trevor never sees.

The goal: drop the PDF straight into the Scheduler in the browser and new jobs appear.

The catch the council was asked to solve: the PDF only contains **six** things about a job —
job number, customer, manufacturer, model, status, and the fault description. Six things Trevor
maintains by hand are **not in that PDF at all**: Tag, Hours, Action, VB, BL, PJ.
*(Was "five" — `PJ` was missed. Corrected 2026-07-29; see the amendment above. Job age is the
seventh, and it comes from the JBA export instead — Build 1c.)*

The danger, confirmed in the live code: the current save routine writes *every* column on *every*
job in one go. Dropping a PDF today would blank Tag, Action, VB, BL, PJ and job age on all 53
existing top-level jobs — weeks of markup gone in one click. This is the same bug that already bit
the job-age column once and was patched with `preserveKnownDays()`.

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

- `upsertJobsBatch()` (`src/utils/supabase.js:159`, aliased as `saveJobsMasterBatch` at :1340)
  hardcodes ~20 columns on every row of the batch, including `tag`, `action`, `hours`,
  `vb`, `bl`, `days`. A Supabase array upsert sends the **union** of all rows' keys, so any
  column named on one row is NULL-filled across the whole batch.
- **The safe writer already exists.** `batchWriteJobsState()` (`src/utils/supabase.js:1354`)
  maps only the keys actually present via `toJobRow()` (:129), then **groups rows by their exact
  column signature** so a sparse row is never NULL-filled by a fuller one in the same request.
  The pattern is in production and commented. The PDF path does not need a new writer invented.
- Every job upsert conflicts on `id`, and for a top-level job **`id` is the job number**.
- **Hours is NOT inferred from the description.** `parseCSV()` reads it straight from the CSV's
  Hours column (`parseFloat(obj.Hours) || 0`, `src/data/jobs.js:321`), then defaults to **1h** for
  a schedulable job with no hours (:329). `inferBench()` infers the *bench* from description
  keywords; `benchHours` only sizes split subtask cards in `createSubtasks()`. An earlier draft of
  this brief claimed hours were keyword-inferred — that was wrong, corrected 2026-07-28.
- **Tag is effort/difficulty, not a workflow code** (Trevor, 2026-07-28): Easy / Medium / Tricky /
  High, stored as `EZ` / `M` / `T` / `H`. The workflow codes INC/CI/RS/RS-C/DG/GTS live in the
  **Action** column — a different field. Do not conflate them.
- **Tag drives Hours, and that conversion happens in the Google Sheet, not in this app.** Trevor
  sets the effort in the Sheet; the Sheet turns it into a number; the app only ever receives the
  finished Hours. There is no Tag→Hours mapping anywhere in the codebase.
- **`job.tag` is vestigial.** Nothing displays it and nothing branches on it. The job cards show
  **hours**, not the tag. Written at `src/utils/supabase.js:187`, read back at
  `src/hooks/useSupabase.js:67`, and set on the CSV path at `src/data/jobs.js:343`
  (`tag: obj.Tag || inferTag(effectiveHours)`). (An earlier line here said "exactly two live
  lines" and missed the third — corrected 2026-07-29. `helpArticles.js:154` also documents it;
  see the ⚠️ under `inferTag()` below.)
- **`inferTag()` (`src/data/jobs.js:172`) has T and M swapped** (confirmed by Trevor, twice). It
  reads EZ ≤1.5h → T ≤3h → M ≤5.5h → H, but Tricky is *more* work than Medium, so it should be
  EZ ≤1.5h → M ≤3h → T ≤5.5h → H. Dormant today because nothing reads `job.tag`; it also only
  fires when the Tag cell is blank, and the Sheet fills it. **Decision 2 below makes it live.**
  The **same swap is duplicated** in `scripts/sheet_to_csv.command:295-300` (`infer_tag`) and both
  copies must be fixed together, because Build 1 runs both paths at once.
  > ⚠️ **Corrected 2026-07-29 — there is a THIRD copy.** `src/data/helpArticles.js:154` is the
  > app's own help text and it teaches the swap verbatim: *"Difficulty tags: EZ (≤1.5h), T (≤3h),
  > M (≤5.5h), H (>5.5h)."* Fixing only the two code copies leaves the app explaining the wrong
  > mapping to Trevor on screen. **Scope item 4b covers all three.**
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

`preserveKnownDays()` stays exactly as it is, still covering `days` only. **Do not widen it. Do not
remove it.**

> ⚠️ **Corrected 2026-07-29.** This paragraph previously read: *"`days` is a Multitrack fact that
> legitimately still arrives by import."* **That was false when written.** The PDF importer sets
> `days: null` on every new job (`src/data/pdfImportPlan.js:75`), and `days` has only ever reached
> the database through the CSV, sourced from the Google Sheet's `Date` column. Nobody checked it.
>
> The *conclusion* survives, for a different reason: `days` **is** a Multitrack fact, and the JBA
> export carries it as a finished number (see Build 1c). So the guard is correct to keep — it just
> has nothing to guard until 1c ships. Between now and then, `days` is frozen at whatever the last
> CSV sync wrote. Verified 2026-07-29: the database says job 97 is 3159 days old, the JBA export
> says 3162.

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

## Scope — split into Build 1a and Build 1b

> **Split approved by Trevor, 2026-07-28 ("yp").** Nothing was added or removed — the eight scope
> items below are the same eight, in the same order, run as two supervised builds with a checkpoint
> between them. Reasons: (i) an eight-item brief in one builder run is where drift starts, and drift
> means Trevor comes back to the Mac mid-session, which is what the protocol exists to prevent;
> (ii) item 3b is a checkpoint only Trevor can clear, and it falls naturally between the halves.
>
> **The split is safe, and this is why:** 1a's writer sends six Multitrack columns and nothing else,
> so it cannot touch Tag/Hours/Action/VB/BL regardless of who owns them. The two-masters problem
> that decision 3 solves only exists once an in-app editor exists — and that is 1b. So 1a can ship
> and be used for real while ownership still sits where it is today. **1a must not be extended to
> include any field editing.**

---

### Build 1a — the PDF actually imports

Ends with: Trevor drops a real PDF on the Vercel preview, sees the counts, imports, and existing
jobs are untouched. Merges on its own.

0. **Match-key proof** (above). ✅ Passed 2026-07-28 against a fresh export — 46 refs parsed, 45
   match the `jobs` table character-for-character, 1 genuinely new (`1711`), zero near-misses.
   **Re-run it if the PDF used at build time is more than a few days old** — it is a throwaway
   script and it is the difference between a clean import and silently duplicated jobs.
1. **Port the parser** — `lib/parseMultitrackPdf.ts` from
   `/Users/admin/Desktop/1. PROJECTS/Business/AI FILES/BUILDS/NEW SCHEDULER BUILD/workshop-scheduler/`
   into this repo (JS, `pdfjs-dist`). Six fields out, nothing more.
2. **Six-column sparse PDF writer** — reuse the `toJobRow` + column-signature-grouping pattern from
   `batchWriteJobsState()`. Explicit six-name allow-list. Do **not** call `upsertJobsBatch()`.
   **The "no Hours and no Days ⇒ skip the job" rule must not apply on this path** — a PDF has
   neither, so leaving it in place would silently import nothing. See the ⚠️ note in Verified facts.
5. **Preview screen** — counts, new-job names, missing-job names, Import / Cancel.
6. **Count sanity-check** — a short parse refuses to import rather than importing partially.
7. **Duplicate protection** — re-dropping the same PDF never creates a second copy.

**1a verification (independent agent, then browser test):** drop a real PDF on the Vercel preview;
confirm the counts; confirm Tag / Hours / Action / VB / BL on existing jobs are unchanged; confirm
no calendar slot, bench assignment or split state moved. Then merge 1a.

---

### CHECKPOINT — Trevor, between the builds

3b. **Cutover check. Only Trevor can clear this.** The moment the CSV stops writing these columns
   (step 3, first thing in 1b), whatever is in the `jobs` table becomes the permanent starting
   point. Before the switch, print the current tag / hours / action / vb / bl for all ~46 jobs
   beside the Google Sheet's values and confirm with Trevor they match. If the DB is stale
   anywhere, **one final CSV sync fixes it *before* ownership moves.**
   **Do not start Build 1b until Trevor has cleared this.** Getting it wrong means his markup is
   permanently frozen at a stale value with no CSV left to correct it.

---

### Build 1b — the Jobs Sheet page, and the Sheet stops being master

Ends with: Trevor edits Tag/Hours/Action/VB/BL in the app, commits, and the CSV can no longer
revert him.

3. **Move ownership of `tag`, `hours`, `action`, `vb`, `bl` app-side** — the constants in
   `src/data/joinJobs.js`, plus stop the CSV import path writing those five columns. No DB
   migration, no data movement. **Do this before step 4**, so the sheet page never ships into a
   world where the CSV can revert it.
   ~~Widen `preserveKnownDays()`~~ — dropped, see "The CSV back door" above. Leave it days-only.
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
   (b), so the mapping is live. Both must move together — both paths still run during 1b, and
   fixing only one makes them disagree.

**1b verification (independent agent, then browser test):** edit an Action in the sheet page,
commit, run a CSV sync, confirm the edit survives. Confirm the Tag→Hours auto-fill uses the
corrected M/T bands. Confirm a range in the Hours cell (`2-4`) averages to 3.

---

### Build 1c — the JBA drop, and job age stops going stale

**Added by the 2026-07-29 amendment. Approved by Trevor 2026-07-29 ("yp"). Runs after Build 1b.**

> ✅ **COUNCIL RAN 2026-07-29** — two independent `ggnz-council` agents on the 1c scope
> (the migration, the second parser, the computed-age change). **Both returned "proceed with
> changes."** Every change they asked for is written into the scope items below and is
> **binding on the builder**; each is marked ⚡. Trevor approved the amendments 2026-07-29
> ("yes overwrite, yes go ahead"), including the overwrite ruling in item 11.
> Every council claim below was re-verified against the live tree before being written in.

Ends with: Trevor drops the JBA PDF, every job gets its real Date In, and the age on the card
counts up on its own every morning without anything being dropped or synced.

8. **`first_seen` column** — additive migration on the `jobs` table, `date`, nullable. Nothing
   dropped, nothing rewritten, no existing column touched. Run it before the parser lands so the
   writer has somewhere to write.
   ⚡ **HOW the migration is applied — council 1, blocking.** There is no migrations runner in
   this repo and no `supabase/` directory. Every schema change here has been applied by hand:
   the `ALTER TABLE` is added to `docs/supabase-schema.sql` **and Trevor pastes it into the
   Supabase SQL editor himself**. Precedent: `git show 6b39f3d`, and the `days` column at
   `1ab2b9d`. So the builder must (a) add the column to `docs/supabase-schema.sql`, (b) hand
   Trevor the exact one-line SQL to paste, and (c) **confirm it landed before testing any
   write** — a `select first_seen from jobs limit 1` is enough. Do not assume the column exists.

8b. ⚡ **Match-key proof for JBA — council 2, blocking. Do this before item 10 writes anything.**
   Build 1a's step 0 proved the *Jobs PDF's* ref extraction matches `jobs.id` character for
   character. It proves nothing about JBA, which is a different layout. Because the upsert
   conflicts on `id`, a ref that parses even slightly differently **silently creates a second
   job row** instead of updating — and every preview count still looks right. Throwaway script,
   same shape as 1a's: parse the real JBA PDF, print its refs beside `jobs.id`, require a clean
   match. **If they do not match cleanly, stop and come back to Trevor.**
9. **Port a second parser — `parseJobsByAgePdf`.** Its own file, its own tests. **Do not extend
   the Medium-Job-Search parser with a mode flag** — the layouts differ (date-led rows, Mfr wraps
   to a second line on long names, x-positions shift partway down the file) and one parser serving
   two layouts is how a short parse becomes silent.
   Fields out: **job number and Date In. Nothing else.** JBA also carries Mfr/Model/Status/Desc,
   and those already arrive on the Jobs PDF — a second writer for the same columns is the
   two-masters bug again, in a new place. **JBA owns exactly one column: `first_seen`.**
   ⚡ **Share the ref derivation, not the layout logic — council 2.** `fixLigatures()`
   (`src/data/parseMultitrackPdf.js:32`) is layout-independent text repair and must be
   **imported, not copied** — Mfr names wrap the same broken way in both PDFs. The y-grouping
   (`toLines`, :41) and the fault/wrap-gap logic are Jobs-PDF-specific and correctly stay
   separate. **Critically:** the ref derivation is currently inlined inside `finalize()`
   (~:113) and is not a named function. **Pull it out into one exported helper both parsers
   call** before writing the second parser. If JBA re-derives its own trim/join logic, any
   tiny divergence is exactly the silent-duplicate bug item 8b exists to catch.
10. **One-column sparse writer** — same `toJobRow` + column-signature-grouping pattern as 1a. One
    name in the allow-list: `first_seen`. Do **not** call `upsertJobsBatch()`.
    ⚡ **`job` MUST ride along on every row — council 1, blocking. Taken literally, "one name in
    the allow-list" makes every JBA import fail on write.** `jobs.job` is `NOT NULL`
    (`docs/supabase-schema.sql:8`), and Postgres validates NOT NULL against the *proposed insert
    row* **before** it resolves `ON CONFLICT` onto the existing row — so `{id, first_seen}` is
    rejected with `23502` even though the row already exists and only an update was intended.
    This is not theoretical: it is the documented, reproduced-live cause of drags never
    persisting after the Supabase migration (job 842) — see the comment block at
    `src/data/joinJobs.js:135-171` and the fix in `jobsStateFieldsFor()`. 1a's writer already
    handles it (`src/utils/supabase.js:281-287`, Guard 3). Do the same: send
    `{id, job, first_seen}`. Never send `job: undefined` — log loudly and skip that one row.
    ⚡ **`toJobRow()` does not know `first_seen` today** — neither `JOB_COLUMN_MAP` nor
    `JOB_PASSTHROUGH_FIELDS` (`src/utils/supabase.js:85-121`) has an entry. Add it. Small, but
    the brief's "same pattern as 1a" reads as if this file needs no change, and it does.
11. **Preview screen and count sanity-check**, same shape as 1a: "45 dates filled · 2 already
    known · 6 jobs here that aren't in this file". Import / Cancel. A short parse refuses.
    **A job in the database but absent from JBA is reported, never deleted** — verified 2026-07-29,
    the database holds 53 top-level jobs against JBA's 47, and the 6 extra are legitimate.
    ⚡ **Reuse 1a's modal shell and `pdfImportPlan.js` machinery** (count refusal, missing-list,
    `isTopLevelJob`) — same new/known/missing shape. Only the `writes[]` construction differs
    (six fields vs one). Duplicating the modal is risk for no gain.
    ⚡ **DECIDED by Trevor 2026-07-29 — a differing date OVERWRITES.** Council 2 found this
    genuinely unspecified. If a job already has a `first_seen` and JBA carries a different date,
    **JBA wins.** Multitrack owns the date exactly as it owns customer and status, and this keeps
    the one rule that already holds everywhere: *Multitrack's facts win; Trevor's markup is never
    touched.* The alternative — skip if already set — would mean a single bad date could never be
    corrected without hand-editing the database. Show these as a third count on the preview
    ("N dates changed") so an overwrite is never invisible.
12. **Age is computed** — `days = today − first_seen`, falling back to the stored `days` column
    when `first_seen` is null so nothing goes blank mid-migration.
    ⚡ **Compute it ONCE, in `normalizeJobsFromDb()` (`src/hooks/useSupabase.js:33`, where
    `days` is already set at :62) — NOT at each render site. Both councils, blocking.** The
    brief previously said "wherever job age is displayed", which is wrong twice over: `job.days`
    is read in **six** places, and **two of them are sort orders, not displays** —
    `src/components/JobShelf.jsx:144` and `src/components/DailyLogPage.jsx:825`, plus
    `src/data/jobs.js:381`. Displays are `src/components/JobCard.jsx:164`,
    `src/components/ProjectsPage.jsx:29`/`:155` and `src/components/DailyLogPage.jsx:409`/`:435`.
    All six verified live 2026-07-29. Patch the screens but not the sorts and the cards show
    correct ticking ages while the list order stays frozen at today's stale numbers — and during
    the mixed period a sort cannot compare a computed age against a stored one at all. Computing
    once at the normalise step means all six keep reading the same `job.days` they read today and
    **no call site changes.**
    ⚡ **Use the local-date pattern, not UTC — council 1.** NZ is UTC+12/13 and this codebase
    already carries the warning: `src/utils/calendar.js:1-2` documents that
    `toISOString().slice(0,10)` drifts a day off local date, which is why `localDateKey()`
    exists. Naive `new Date(first_seen)` day-maths lands one out — and the verification
    criterion ("3162, not 3159") is precisely an off-by-one test. Reuse `localDateKey()`.

**Explicitly NOT in 1c:** removing the `days` column, removing `preserveKnownDays()`, or changing
what the Jobs PDF writes. Those are Build 2, once every job has a `first_seen`.

**Expected, not a bug — tell Trevor.** A brand-new job that arrives on the Jobs PDF before the
next JBA drop has `days: null` (`src/data/pdfImportPlan.js:86`) and no `first_seen`, so it shows
**no age** until JBA is next dropped. That is today's behaviour for a PDF-imported job, unchanged
by 1c. Not a regression, and not something to "fix" inside this build.

**1c verification (independent agent, then browser test):** drop the real JBA PDF on the Vercel
preview; confirm job 97 reads 3162 days, not 3159; confirm Tag/Hours/Action/VB/BL/PJ and customer
are all unchanged; confirm no calendar slot, bench assignment or split state moved; re-drop the
same file and confirm nothing duplicates. ⚡ **Added by council:** confirm the job list **sort
order** reflects the new ages, not just the numbers on the cards (all six read sites in item 12);
confirm a job whose stored date differs from JBA is **overwritten** and counted on the preview;
confirm the age is right at NZ local midnight boundaries, not one day out.

**Blast radius — full protocol applies.** 1c touches `src/hooks/useSupabase.js` and the `jobs[]`
shape, both on CLAUDE.md's blast-radius list. It does **not** touch `scheduledSlots`,
`calendarSlot` or `useGoogleCalendar.js` — both councils confirmed the "scheduling untouched"
claim independently.

---

## Out of scope — do not build

- Retiring the DropBox/watcher/CSV pipeline. That is **Build 2**, a separate brief, after real
  PDFs have imported successfully. **Also Build 2:** removing the `days` column and
  `preserveKnownDays()` once `first_seen` covers every job, and deleting the never-working
  `FirstSeen` handling in `scripts/sheet_to_csv.command`.
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
2. **Council** — ✅ done 2026-07-28 (llm-council, as-written: 5 advisors → anonymised peer
   review → chairman). It reviewed the original eight scope items, so **1a and 1b are both
   covered**. Findings above are binding; the builder does not reopen them.
   **What council did not see:** the `PJ` sixth field (added 2026-07-29 — same treatment as the
   other five, no new design, so 1b proceeds), and the whole of Build 1c (new design — it gets
   its own council round, see the end of this file).
3. **Builder — run 1a** — staging branch, supervised from the main conversation.
4. **Independent verifier — 1a** — separate agent, never the builder.
5. **Browser test — 1a** — Vercel preview: drop a real PDF, confirm the preview counts, confirm
   existing jobs keep their Tag/Action/VB/BL, confirm scheduling is untouched.
6. **Merge 1a** — Trevor's "yp".
7. **CHECKPOINT — Trevor clears item 3b.** The cutover check. Build 1b does not start until he has.
8. **Builder — run 1b** — fresh builder agent, fresh staging branch.
9. **Independent verifier — 1b** — separate agent, never the builder.
10. **Browser test — 1b** — edit a field in the sheet page, commit, run a CSV sync, confirm the edit
    survives.
11. **Merge 1b** — Trevor's "yp".
12. **Builder — run 1c** — fresh builder agent, fresh staging branch.
13. **Independent verifier — 1c** — separate agent, never the builder.
14. **Browser test — 1c** — drop the real JBA PDF, confirm job 97 reads 3162 not 3159, confirm
    nothing else moved.
15. **Merge 1c** — Trevor's "yp".

Each build gets its own builder run, its own verifier and its own browser test. Steps 1 and 2
(brief and council) are done once and cover all three — the council's findings are binding on
every builder.

**Council on Build 1c — ✅ DONE 2026-07-29.** Two independent `ggnz-council` agents reviewed the
1c scope (migration / second parser / computed-age). Both: **proceed with changes.** All changes
are written into scope items 8, 8b, 9, 10, 11 and 12, marked ⚡, and are **binding on the
builder** exactly as the 2026-07-28 verdict is. Trevor approved them and ruled on the overwrite
question the same day. 1a and 1b keep the original council verdict. **Next action: step 12,
builder on a fresh staging branch.**

**No commits before step 1 is approved.**
