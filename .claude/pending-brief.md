# Pending Brief G — PDF-drop import, Build 1

**Status:** AWAITING TREVOR'S "yp". No code written. No commits until approved.
**Date:** 2026-07-28
**Repo state:** `main` @ `65cadc0` (PR #7, planning tags + pile colours, merged)
**Predecessor:** `docs/briefs/re-fresh-pdf-drop-scope-and-council.md` — scope agreed by Trevor;
council now run (llm-council, as-written, 5 advisors → anonymised peer review → chairman).
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
Tag, Action, VB or BL into the app at all**. They have only ever arrived from the Sheet
(verified — the word `tag` does not appear in `JobDrawer.jsx`, `MobileJobSheet.jsx` or
`JobsPage.jsx`). So a PDF-dropped job would land with four blank fields and nowhere to fill
them in. Adding those editors is therefore part of this build, not a later nicety.

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
- `parseCSV(csvText, benchKeywords, benchHours)` already derives bench and hours from the
  description text. Hours is not purely hand-typed today.
- Ownership of master vs state fields is decided by JS constants in `src/data/joinJobs.js`
  (`NON_MASTER_FIELDS`, `DERIVED_STATE_FIELDS`) — **not** by a database migration.
- **No in-app editor exists for Tag, Action, VB or BL.** Hours is editable in `JobDrawer.jsx`.

### The five decisions — resolved

1. **Existing jobs — never touched.** The PDF write path sends six columns and only six:
   job/ref, customer, mfr, model, status, desc. Tag, Hours, Action, VB, BL and days are
   *physically absent* from the write — not "preserved", not "merged". Nothing to get wrong.
   Rejected: a second `preserveKnownDays()`-style guard. Per CLAUDE.md, symptom-patching is a
   stop signal, and a preserve-merge still reads, still sends, and still can be wrong.
2. **New jobs — blank, except bench and hours.** Run the existing bench-keyword inference on the
   PDF description, exactly as the CSV path already does. Tag, Action, VB, BL start visibly empty.
   Rejected: inferring Tag from fault text — a wrong Tag looks filled-in and never gets reviewed.
3. **Do NOT move the five fields to the app-owned side in this build.** Three advisors wanted it;
   four of five reviewers backed the Executor's dissent and the chairman sided with them. It is
   cheaper than assumed (a constant, not a migration) but Build 1 does not need it to be safe.
   Revisit in Build 2 when the CSV retires.
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

### The CSV back door — must be closed in Build 1

The Contrarian's catch, and the plan fails without it. Both importers are live in Build 1. Trevor
drops a PDF, gets a new job, types Tag=RS into the app — and the next CSV import blanks it,
because on that path blank means blank. Build 1 would ship the exact bug it fixes, one pipeline over.

**Fix:** generalise `preserveKnownDays()` (`src/data/jobs.js:86`) from days-only to
days + tag + action + vb + bl. Same rule, same shape, wider column list: blank never overwrites
good; a changed populated value still wins.

Rule in one sentence: *if the job is in the Sheet, the Sheet still owns your notes; if it came in
by PDF drop, the app owns them and nothing can overwrite them.*

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
3. **Widen `preserveKnownDays()`** to cover tag + action + vb + bl + days on the CSV path.
4. **Editors for Tag, Action, VB, BL** in the job drawer, alongside the existing Hours field.
5. **Preview screen** — counts, new-job names, missing-job names, Import / Cancel.
6. **Count sanity-check** — a short parse refuses to import rather than importing partially.
7. **Duplicate protection** — re-dropping the same PDF never creates a second copy.

## Out of scope — do not build

- Retiring the DropBox/watcher/CSV pipeline. That is **Build 2**, a separate brief, after real
  PDFs have imported successfully.
- Moving Tag/Hours/Action/VB/BL to the app-owned side of `joinJobs.js`. Build 2.
- Any snapshot/restore or undo button.
- Auto-deleting or auto-completing jobs missing from the PDF.
- Inferring Tag from fault text; provenance/"suggested vs confirmed" flags; a hours-estimate
  learning loop; a daily triage screen with inline editing. All proposed by one advisor, all
  rejected as Build-1 scope creep that would require Trevor to babysit the build.
- Anything in `SCHEDULER_old/`. Anything touching scheduling, calendar slots or bench assignment.
- Deleting dead `useFirebase.js` (noted, separate housekeeping).

---

## Method — agent-team protocol

1. **Brief** — this file. ⬜ Awaiting Trevor's "yp".
2. **Council** — ✅ done 2026-07-28 (llm-council, as-written). Findings above are binding; the
   builder does not reopen them.
3. **Builder** — staging branch, supervised from the main conversation.
4. **Independent verifier** — separate agent, never the builder.
5. **Browser test** — Vercel preview: drop a real PDF, confirm the preview counts, confirm existing
   jobs keep their Tag/Action/VB/BL, confirm scheduling is untouched.
6. **Merge** — Trevor's "yp".

**No commits before step 1 is approved.**
