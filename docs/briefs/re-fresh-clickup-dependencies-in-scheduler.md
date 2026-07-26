# Session refresh — ClickUp-style dependencies in the Scheduler

Continuing work in the GGNZ Scheduler project (repo root, `main` at `d0e3a2c`, no
uncommitted app code). Goal of this session: **talk through how ClickUp handles job
dependencies and decide whether/how that concept belongs in the Scheduler.** This is a
design conversation, not a build.

---

## Where things stand

**The data-loss incident is closed.** A Multitrack PDF with a shifted column layout
truncated 45 jobs to 12 and the pipeline then deleted 33 rows from the Google Sheet.
All recovered: Sheet restored, `jobs.csv` rebuilt to 45 clean rows, Supabase never lost
anything. Trevor's words on the pipeline now: **"limping but working, so all good there."**
Treat it as no-urgency. Full write-up (root causes, all four problems, what not to do) is
in the incident handoff — read it, don't re-derive it.

One loose end from the incident, low priority: Supabase still holds 10 blank `mfr`
values. Fixed by Trevor clicking 📂 in the app and uploading the rebuilt `jobs.csv`.

**The design thread is where the real work is.** Over this session Trevor set two hard
constraints, both now saved to memory:

- **"I want base to be MT and scheduler."** Two systems only. The Google Sheet dies,
  ClickUp is out. Consequence: the manual fields (`Action`, `BL`, `PJ`, `VB`) have to
  become editable *inside the Scheduler* — that's settled by elimination, don't re-ask it.
- **He abandoned ClickUp despite having it fully populated** — "too busy and get
  overwhelmed really fast.... no focus windows." Density is the failure mode, not missing
  features. Any design that shows a wall of rows is off-brief.

**The actual topic for this session has not been discussed at all yet.** Trevor's last
message: *"where I was going with this... is the way ClickUp handles dependencies."* He
rejected ClickUp as a *tool*, but he wants its **dependency model** — jobs that block
other jobs, waiting-on relationships, ordering. Start there. Don't restart the pipeline
discussion.

Groundwork already established that feeds the dependency question:

- `BL` (backlog), `PJ` (project), `VB` drive real UI — Sidebar backlog section, the whole
  Projects page, a ⭐ badge. `Tag` is dead (nothing reads it). `FirstSeen` has always been
  blank (the Sheet column is named `Date`, so the script never found it).
- The `focus_list` table and `useFocusList` hook exist and are read-wired everywhere, but
  the write path only landed for the on-card/drawer toggle in `d0e3a2c` and `dda30fd`.
- The app's import (`handleCsvUpload`) is **upsert-only** — a job that vanishes from
  Multitrack stays in Supabase as open forever. This is why two closed jobs lingered.
  `pendingRevenueReview` was built for exactly this case and has no UI at all.

**Recommendation already on the table (Trevor hasn't responded to it yet):** put the
manual-field controls on the job drawer first as the foundation, then make a Board Meeting
screen a guided one-job-at-a-time walk over those same controls. Also: if MT + Scheduler is
the whole system, the PDF is the *only* bridge, so the import preview becomes the safety
net that the Sheet's version history used to be — it has to show what will *change*, not
just what's new, and nothing should be written until Trevor confirms.

---

## Next steps

1. **Ask what he means by dependencies** — likely candidates: parts-on-order blocking a
   job, a job waiting on customer approval, one job that must finish before another can
   start, or sub-jobs of a project. Find out which of these actually bite him weekly.
   One question at a time.
2. **Check what already exists before designing anything.** The repo already has
   `parts_to_order`, `deferred_items`, `parking_lot`, `pending_revenue_review`, split jobs
   (`parentId`), and the Projects page. A dependency feature may be mostly surfacing
   relationships that are already in the data.
3. **Keep it a focus window.** Whatever the shape, it has to answer "what can I actually
   work on right now" — not display a graph. That's the real value of dependencies for him.
4. Only then propose 2–3 approaches with a recommendation, present a design, get "yp",
   and write the spec. Nothing gets built this session.

Two forks still genuinely undecided, and they're workflow questions only Trevor can answer:

- **Where do `Action`/`BL`/`PJ`/`VB` get edited** — job drawer (any time, in context) or a
  Board Meeting screen (weekly ritual, but mid-week edits have nowhere to go)?
- **What should an import do with a job that has vanished from the Multitrack PDF?**
  Options put to him: ask in the preview / auto-mark done but never delete (leaning) /
  flag and leave visible. Depends how often he closes jobs in MT that aren't really done.

---

## Files to open (read these, don't re-derive)

- `handoff-pdf-import-truncation-incident.md` — the incident, fully diagnosed. Read the
  "Do not do next" section before touching anything in `SCHEDULER_old/`.
- `handoff-board-meeting-and-pdf-drop.md` — scopes the two unbuilt features (Board Meeting
  rebuild, in-app PDF drop). Both need the full agent-team protocol.
- `SCHEDULER-ARCHITECTURE.md` — tech stack, CSV pipeline, file boundaries, code patterns.
- `src/hooks/useJobs.js:267` — `handleCsvUpload`, the upsert-only import. This is where a
  "job has vanished" decision would have to live.
- `src/hooks/useSupabase.js:33` — `normalizeJobsFromDb`, proves `BL`/`PJ`/`VB` are
  load-bearing and how they map to `backlog`/`project`/`vb`.
- `src/utils/supabase.js` — all table names in one place; `saveJobsMasterBatch` at ~line
  1100. Useful for seeing what relationship data already exists.
- `~/Library/Mobile Documents/com~apple~CloudDocs/Desktop/SCHEDULER_old/jobs.csv` — the
  rebuilt 45-row file. The truncated original is `jobs.csv.bak-truncated-14col` beside it.
- `.../BUILDS/NEW SCHEDULER BUILD/workshop-scheduler/lib/parseMultitrackPdf.ts` — the
  port candidate parser (x-position based, immune to the truncation bug). Its
  `app/import/page.tsx` confirm step is add-only, which is a regression vs today — don't
  port that part as-is.
- `rebuild_csv.py` (in this folder) — the one-off Sheet→CSV recovery script written during
  the incident. Read-only on the Sheet, writes only the local CSV, has a <40-row refusal
  guard. Carried here because it only existed in the session scratchpad, which gets wiped.
  Not committed to the repo yet — Trevor hasn't decided whether it belongs in `scripts/`.

Memory already holds both of Trevor's constraints
(`trevor-needs-focus-windows`, `ggnz-base-is-multitrack-plus-scheduler`) — they load
automatically, no need to re-establish them.

---

## Avoid repeating

- **Don't re-open "where should the manual fields be edited — Sheet, ClickUp, or app?"**
  Answered by elimination: the app.
- **Don't propose a spreadsheet-style bulk-edit grid.** Already offered, already killed by
  the focus-windows constraint.
- **Don't ask whether ClickUp could be the bridge.** Rejected on UX grounds.
- **Don't drop a Multitrack PDF or restart the watcher.** The parser is still unfixed; a
  bad PDF re-truncates `jobs.csv` and the next `sheet_to_csv.command` run re-wipes the
  Sheet from it.
- **Don't trust `sheet_to_csv.command`'s name.** It is CSV-authoritative: any Sheet row
  absent from `jobs.csv` gets deleted, no sanity floor. That's what caused the incident.
- **Don't "fix" the blank `FirstSeen`** without checking what depends on the blank.
- The incident file's original claim that the Firebase/Supabase split caused the two stuck
  closed jobs is **wrong** and already corrected in the file — the real cause is
  upsert-only import. Don't reintroduce the old diagnosis.
