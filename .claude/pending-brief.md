doc_status: live

# Pending Brief H — Build 2: retire the CSV pipeline

**Status:** ⏳ **DRAFT — awaiting Trevor's "yp". Not approved, not council-reviewed. No commits.**
**Date:** 2026-07-29
**Repo state:** `main` @ `e6c302e`, clean.
**Predecessor:** Brief G, all three builds shipped (1a `f927248`, 1b `f2ee449`, 1c `b665e1d`).
Its full record is `docs/briefs/brief-g-pdf-drop-full-record.md`, now `closed`.

**Standing order, Trevor 2026-07-29:** *"save all UI changes until after PDF drop implemented
successfully and CSV pipeline gone"*. The PDF drop is done. **This brief is the "CSV pipeline
gone" half — the last thing standing between now and UI work.** No look-and-feel change gets
slipped in alongside it.

---

## Plain-English summary

Right now the Scheduler has **two front doors** for job data and only one of them is still wanted.

The new door works: Trevor drops a Multitrack PDF into the app in the browser, sees a preview,
presses Import. Jobs land. A second PDF (Jobs by Age) fills in each job's booked-in date, and the
app works the age out fresh every morning from that.

The old door is the Google Sheet → CSV pipeline. A Terminal window has to stay open on Micky
watching a DropBox folder; when a PDF lands it runs a Python script, talks to Google, writes a
`jobs.csv` on the desktop, and pushes that into the database. There is also an **Upload CSV
button** inside the app in three places.

Brief G already took the teeth out of it — the CSV can no longer overwrite Tag, Hours, Action, VB,
BL or PJ, because those went app-owned in Build 1b. So the old door is not dangerous any more. It
is just **still there**, and that costs three things:

1. Trevor has to remember whether the watcher is running, and what happens if it isn't.
2. Every future change to job data has to be thought about twice — once for each door.
3. The job-age column `days` can't be cleaned up while the CSV is still allowed to write it.

**This build closes the old door and takes the spare parts out.** Nothing Trevor does day to day
changes, except that he stops running a Terminal window and the Upload CSV buttons disappear.

**The one thing to be careful about, and the reason for the gate below:** job age is currently
computed from the booked-in date *when we have one*, and falls back to the old stored number when
we don't. Removing the old stored number is only safe once **every** job has a booked-in date. That
is a live-data question, not a code question, and it gets answered before anything is written.

---

## Step 0 — the gate — ✅ **RUN AND PASSED 2026-07-29**

**The gate was asked the wrong question first, and the answer changed nothing. Recorded here in
full so nobody re-opens it.**

The question as originally written was *"does every top-level job have a `first_seen`?"* Trevor ran
it 2026-07-29 and it came back **6**, not 0. Queried live against Supabase the same day, those six
are **1619, 1620, 1626, 1671, 1698, 1702** — the exact six Brief G's item 8b already recorded as
present in the database and absent from the 29 Jul JBA export (53 top-level jobs against JBA's 47).

**They are not new PDF-drop arrivals waiting on a JBA drop — they are the oldest rows in the
table.** All six carry `created_at = 2026-07-26T01:11:35.675Z`, identical to the millisecond: a
single CSV-era bulk write, the truncation-incident repair. By contrast the newest jobs, 1711 and
1712, arrived on the PDF path and **do** have a `first_seen`. So the new pipeline is filling dates
correctly; these six predate it and Multitrack does not list them in Jobs by Age at all. **Another
JBA drop will not fix them.**

### The question that actually matters

Removing the stored `days` column only costs something if a row has a `days` number **and** no
`first_seen` — that row would lose an age it currently shows. Asked directly, across all 61 rows in
the table, children included:

```sql
select count(*) from jobs where first_seen is null and days is not null;
```

**Returns 0.** All six of the dateless jobs have `days = null` as well, so **they already show no
age today** — that is Brief G's documented "expected, not a bug" behaviour, unchanged. 43 rows
carry both values, and for every one of them `days` is redundant with `first_seen`.

**Verdict: no row on the board regresses when `days` goes. The gate is clear and scope item 2
proceeds in full.**

### Why those six are missing — answered, and there is nothing to fix

Trevor confirmed 2026-07-29: **all six jobs are complete.** Jobs by Age lists open jobs only, so
Multitrack correctly leaves them out, and there is no missing Date In to chase. Their absence is
right, not a gap. Ignore any earlier note in this file suggesting a Multitrack-side fix.

**Nothing here holds up Build 2** — the app behaves identically before and after.

**But it surfaces a real gap, and it is not this brief's:** four of the six (1626, 1671, 1698,
1702) are already `done` in the app, but **1619 and 1620 are still sitting on the board as live
work** — 1620 with one split half open. The app has no way to learn a job was completed in
Multitrack: a finished job simply stops appearing on the PDF, and Brief G's binding rule is
*"Missing jobs are reported, never deleted and never auto-completed."* That rule is right — the app
must not silently close jobs — but it leaves Trevor to spot the disappearance himself. **Needs its
own brief; do not scope it into Build 2.**

**Scope items 1 and 3 never depended on this gate.** Only item 2 did, and it is now clear.

---

## Verified facts — checked against the live tree 2026-07-29

Everything below was grepped, not remembered. Re-check anything this brief asserts before acting
on it; that rule cost Briefs E, F and G a build round each.

### The app-side CSV path

- **One entry point:** `handleCsvUpload()` — `src/hooks/useJobs.js:280`, exported at :550.
- **Three upload buttons**, all `accept=".csv"`, all doing the same `FileReader` →
  `onCsvUpload(evt.target.result)`:
  `src/components/Sidebar.jsx:337`, `src/components/JobShelf.jsx:207`,
  `src/components/DailyLogPage.jsx:1064`.
- **Prop threading to remove with them:** `src/App.jsx:647` and `:676`;
  `src/components/Sidebar.jsx:6`; `src/components/JobShelf.jsx:63`;
  `src/components/DailyLogPage.jsx:666` and `:1317`. Also the test stub at
  `src/components/JobShelf.test.jsx:47`.
- **`parseCSV()`** — `src/data/jobs.js:293`, an RFC-4180 parser. Called from exactly two places:
  `handleCsvUpload` and `src/App.jsx:53`.
- ⚠️ **`RAW_CSV` is already empty.** `src/data/jobs.js:1` is a header line and nothing else:
  `` `Job,Mfr,Model,Status,Days,Tag,Hours,Action,Desc,VB,BL,Customer` ``. So
  `parseCSV(RAW_CSV, …)` at `src/App.jsx:53` returns `[]` today. It is seeding initial state with
  an empty array the long way round. **Replacing that call with `[]` is behaviour-identical** —
  verify it, don't assume it.
- ⚠️ **Do NOT delete the helpers `parseCSV` calls.** `inferBench()` (`jobs.js:21`),
  `createSubtasks()` (:217), `inferTag()` (:179), `parseDays()` (:60), `blockedPile()`,
  `benchColors()` are all used by the PDF path and the UI. `App.jsx:828` calls `inferBench` on a
  bench-keyword change. Only `parseCSV` and `RAW_CSV` go.

### The `days` column

- **`preserveKnownDays()`** — `src/data/jobs.js:86`. Its only production caller is
  `handleCsvUpload` (`useJobs.js:288`). **Delete the CSV path and this function has no caller
  left.** Its tests are `src/data/jobs.test.js:73-113`.
- **Age is already computed.** `jobAgeDays(firstSeen, storedDays, now)` — `src/utils/jobAge.js:63`
  — computes `today − first_seen` and falls back to `storedDays` when `first_seen` is null. Called
  once, at the normalise step: `src/hooks/useSupabase.js:78`. That is Build 1c's design and it is
  correct; item 2 only removes the fallback arm.
- **Six read sites still read `job.days`, and three of them are sorts, not displays** — verified
  live again 2026-07-29. Sorts: `JobShelf.jsx:144`, `DailyLogPage.jsx:825`, `jobs.js:381`.
  Displays: `JobCard.jsx:170`, `ProjectsPage.jsx:29`/`:155`, `DailyLogPage.jsx:409`/`:435`.
  **None of them change in this build** — they keep reading `job.days`, which keeps being set by
  `normalizeJobsFromDb`. That is the whole point of computing it once at the normalise step.
- **Write sites:** `days` is in the passthrough list at `src/utils/supabase.js:124` and written at
  `:214`.
- **Schema:** `docs/supabase-schema.sql:177` (`days INTEGER`) and `:251` (`first_seen DATE`). The
  comment block at `:233-250` already says in writing that `days` and `preserveKnownDays()` go in
  Build 2.

### The Mac-side pipeline

- `scripts/start_watcher.command` — watches `SCHEDULER_old/DropBox`, runs the parser then
  `sheet_to_csv.command`. Its own header comment still says *"pushes to Firebase"*; that is stale,
  the app has been on Supabase for months. Confirms nobody has read this file in a long time.
- `scripts/sheet_to_csv.command` — Google Sheet → `jobs.csv`. `MANUAL_FIELDS` at :32 is
  `['FirstSeen', 'Days', 'Tag', 'Hours', 'Action', 'VB', 'BL', 'PJ']`. `FirstSeen` has never
  worked; six of the other seven went app-owned in Build 1b.
- `scripts/rebuild_csv.py` — a one-off recovery tool for the 2026-07-26 truncation incident, which
  is closed. Its own docstring says *"once"*.
- `scripts/reauth_google.command` — ⚠️ **verified: its `SCOPES` list is Sheets/Drive only**
  (`:25-26`), no Calendar scope. So it belongs to this pipeline and **removing it cannot break
  Google Calendar sign-in**, which authenticates separately in the browser. Check this again
  before deleting.
- The scripts live in the repo but **run from `~/…/Desktop/SCHEDULER_old/`**. Deleting them here
  does not stop a copy already sitting on Micky. Item 3 covers both.

### Documentation that will be wrong the moment this ships

- `src/data/helpArticles.js` — the app's own in-app help. `:9-17` is an article titled *"Uploading
  jobs.csv"* telling Trevor to click a button that will no longer exist and to run a script called
  `pdf_jobs_to_csv.command` that is not even in this repo. `:122` and `:136` also describe sections
  updating "when you re-upload the CSV". `:300-303` is a whole CSV-pipeline section.
- `SCHEDULER-ARCHITECTURE.md:14-26` — the CSV pipeline section, including a `curl` install line
  and a column list. `:90` documents `parseCSV()` as canonical.

**Leaving these is not a documentation nicety.** Trevor reads the in-app help. Help that describes
a door that no longer exists is how a working app gets reported as broken.

---

## Scope — what gets built

**Proposed as three supervised builds, for council to confirm or collapse.** 2a and 2c are
independent of the step-0 gate; 2b is not.

### Build 2a — close the app's CSV door

1. **Remove the CSV upload path.**
   - Delete `handleCsvUpload()` (`useJobs.js:280-324`) and its export at :550.
   - Delete the three file inputs and their surrounding buttons (`Sidebar.jsx:337`,
     `JobShelf.jsx:207`, `DailyLogPage.jsx:1064`) and the `onCsvUpload` prop threading listed
     under Verified facts. The **PDF** upload control in each of those places **stays** — they sit
     next to each other; do not remove the wrong one.
   - Delete `parseCSV()` and `RAW_CSV` from `src/data/jobs.js`, and replace `src/App.jsx:53` with
     an empty initial array. Keep every helper listed in the ⚠️ note above.
   - Update `src/data/jobs.test.js` — the `parseCSV` cases go with it; the tests for
     `parseDays`, `blockedPile`, `benchColors` and the rest stay.

2. **Fix the in-app help in the same commit.** Remove the *"Uploading jobs.csv"* article and the
   CSV-pipeline section from `helpArticles.js`; reword the two section-list mentions to describe
   the PDF drop. **This is not a UI change under the standing order** — it is removing an
   instruction for a control that no longer exists, and it ships with the removal or the app lies
   to Trevor.

**2a verification:** the app loads with an empty board and no CSV button anywhere; a Jobs PDF drop
still imports; a JBA drop still fills dates; existing jobs keep Tag/Hours/Action/VB/BL/PJ; no
calendar slot, bench assignment or split state moves; the help search finds no dead article.

### Build 2b — the stored `days` column goes

**Gate cleared 2026-07-29 — see step 0. No row loses an age.**

3. **Remove `preserveKnownDays()`** (`jobs.js:86`) and its tests (`jobs.test.js:73-113`). It has no
   caller once 2a lands.
4. **Simplify `jobAgeDays()`** (`jobAge.js:63`) to computed-only, and drop the `storedDays`
   argument at its one call site (`useSupabase.js:78`). Update `jobAge`'s tests and the comment at
   `jobAge.js:59-61` that promises this removal.
5. **Stop writing `days`** — remove it from the passthrough list (`supabase.js:124`) and the write
   at `:214`.
6. **The database column.** ⚠️ **Open question for council, and it is the one real risk in this
   build.** Dropping a column is the only irreversible act in the whole of Brief G and Brief H.
   The safe order is: ship 4 and 5 first, run for a week on `first_seen` alone, and only then
   `ALTER TABLE jobs DROP COLUMN days`. **Recommendation: leave the column in the database and
   drop only the app's reads and writes in this build.** A dead column costs nothing; a dropped one
   cannot be un-dropped. Applied by hand in the Supabase SQL editor exactly as `first_seen` was —
   there is no migrations runner in this repo (precedent `git show 6b39f3d`, and `1ab2b9d`).

**2b verification:** every job on the board shows an age, and it matches `today − first_seen` to
the day at NZ local time — reuse the `localDateKey()` pattern, not `toISOString()`
(`src/utils/calendar.js:1-2` documents why). The **sort order** of the job list still puts oldest
first — all three sort sites, not just the cards. A job with no `first_seen` shows no age rather
than a wrong one.

### Build 2c — the Mac-side scripts

7. **Delete from the repo:** `scripts/start_watcher.command`, `scripts/sheet_to_csv.command`,
   `scripts/rebuild_csv.py`, `scripts/reauth_google.command` (after re-confirming the Sheets-only
   scope). Git keeps them permanently.
8. **Trevor stops the watcher on Micky** and removes the copies under
   `~/…/Desktop/SCHEDULER_old/`. **A Trevor step, not a builder step** — the builder must not touch
   anything outside the repo. Give him the exact paths.
9. **Rewrite `SCHEDULER-ARCHITECTURE.md:14-26`** — the CSV pipeline section becomes the PDF-drop
   section, and the `parseCSV()` line at :90 goes.

**2c verification:** `grep -rn "sheet_to_csv\|start_watcher\|jobs.csv" .` returns only history and
this brief. A Jobs PDF drop and a JBA drop both still work with no Terminal window open anywhere.

---

## Out of scope — do not build

- **Any UI or look-and-feel change.** The standing order holds until this brief ships. The two
  parked UI briefs (`docs/briefs/parked-jobs-sheet-usability-changes.md` and
  `docs/briefs/appointments-not-showing-on-the-calendar.md`) stay parked. Removing the dead help
  article in item 2 is not an exception to this — it is deleting text about a deleted control.
- **The Google Sheet itself.** Not touched, not written to, not deleted. It stops being read; what
  Trevor does with the spreadsheet afterwards is his call.
- **Deleting `src/utils/useFirebase.js`.** Still dead, still separate housekeeping, still not this.
  It is on `docs/briefs/re-fresh-repo-housekeeping.md`.
- **`SplitDrawer.jsx`, the stale local branches, the spent one-off scripts** — all housekeeping,
  same brief as above. Item 7 deletes the three pipeline scripts *because they are this build's
  subject*, not as a cleanup pass.
- Anything touching `scheduledSlots`, `calendarSlot`, `useGoogleCalendar.js`, or scheduling, split
  and pomodoro state.
- Changing what either PDF importer writes.
- Anything in `SCHEDULER_old/` beyond item 8's stop-and-remove.

---

## Blast radius — full protocol applies

Touches `src/hooks/useSupabase.js`, `src/utils/supabase.js` and the `jobs[]` shape — three of
CLAUDE.md's blast-radius files. It does **not** touch `scheduledSlots`, `calendarSlot` or
`useGoogleCalendar.js`.

## Method — agent-team protocol

1. **Brief** — this file. ⏳ **Awaiting Trevor's "yp".**
2. **Council** — two independent `ggnz-council` agents. Three things to rule on specifically:
   whether the 2a/2b/2c split is right or over-engineered; item 6, the drop-the-column question;
   and whether anything else in the app still depends on the CSV path that this brief has missed.
3. **Step 0 gate** — ✅ done 2026-07-29, clear. Blocked 2b only; no longer blocks anything.
4. **Builder → verifier → browser test → merge**, once per build, fresh agents each time, verifier
   never the builder.

**No commits before step 1 is approved.**
