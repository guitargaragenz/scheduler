---
doc_status: closed
closed: 2026-07-27
superseded_by: -
---

# Implementation plan — "Why isn't this job moving?"

> # ⛔ CLOSED — HISTORY ONLY. The build this plan describes has SHIPPED.
>
> Brief E (job blocking) was built, verified and merged to `main` on 2026-07-27.
> The "Status: not yet approved / no commits until the protocol has run" line below was
> true when written and is now wrong. **Do not build from this file and do not treat its
> status line as current.** Kept as the record of how the plan was derived.

Date: 2026-07-27
Spec: [../specs/2026-07-26-job-blocking-design.md](../specs/2026-07-26-job-blocking-design.md)
Status: plan written against the real code, not yet approved. **No commits until the full
agent-team protocol has run** (brief → council → builder on staging → independent verifier →
browser test → merge).

This plan was written after reading the actual files. Every line reference below was checked
against the working tree at `d0e3a2c`. Where the spec and the code disagree, the code wins and
the disagreement is called out in "Corrections to the spec" — read that section first, it
changes the size of the job.

---

## Corrections to the spec

Five things in the spec don't hold up against the files. Two are small, one adds work, and two
are scope decisions Trevor has to make.

### 1. `days` is not persisted at all — this is the big one

The spec says job age "reads data that already exists" and "needs no join, no manual typing,
and no export change." That's true of the CSV. It is not true of the app.

- `parseCSV` reads `Days` into `job.days` ([src/data/jobs.js:207](../../../src/data/jobs.js)).
- The `jobs` table **has no `days` column** ([docs/supabase-schema.sql:5](../../../docs/supabase-schema.sql)).
- `upsertJobsBatch` never writes it ([src/utils/supabase.js:173](../../../src/utils/supabase.js)),
  `toJobRow` has no mapping and no passthrough entry for it, and `normalizeJobsFromDb` never
  reads it back ([src/hooks/useSupabase.js:33](../../../src/hooks/useSupabase.js)).

So `days` lives only in memory, only until the page reloads. After any refresh every job has
`days === undefined`. That's why the Projects page timeline (`job.days || 0`) collapses
everything to day zero unless a CSV was uploaded in that same session.

**Consequence for this build:** job age needs new plumbing after all — a column, a write, a
read, and the blank guard. It's still small, but it is not free, and the spec's "stuck age is
the only thing that needs new plumbing" line is wrong. Task 1 covers it.

This is a known-and-skipped item, not a new discovery. Brief D scope item 4 already said
"`days` (job age) has no Supabase equivalent" and told the Builder to "either add a real
intake-date column sourced from the CSV import, or explicitly disable stuck30/60-style age
reporting and say so plainly." Neither happened — the column was never added and nothing was
disabled, so the age numbers have been quietly wrong ever since. Task 1 is the debt being paid.

### 2. The blank-`Days` bug is at line 207, not line 235

The spec says `jobs.js:235` sorts blank-`Days` rows into `NaN`. It can't:

```js
days: parseInt(obj.Days) || 0,     // line 207
```

`parseInt('') || 0` is `0`, never `NaN`. The rows arrive as zero, which is the *worse* bug —
it silently erases the difference between "brand new" and "unknown age", the exact distinction
the spec calls a hard requirement. Fixing 207 to produce `null` is the root-cause fix; adding
the `?? 0` guard at 235 is still worth doing because Supabase-loaded rows can carry `null`
once Task 1 lands. Both are in Task 1.

### 3. `inferBench` already routes blocked jobs to Admin

The spec's Admin table reads as if blocked jobs currently scatter. They don't — lines 20–23
already funnel `In Transit`, `Waiting` (non-INC/CI) and `On Hold` to Admin deliberately. The
change is to return **no bench** instead, which is a smaller edit than the spec implies, but it
means `bench` becomes nullable everywhere downstream. Task 4 covers the fallout.

### 4. `parts_to_order` is empty, not dead — the parts features are premature, not impossible

**CORRECTED 2026-07-27.** This finding originally read "`parts_to_order` is dead code" on the
grounds that nothing in `src/` writes to it. **That was the wrong test and the wrong verdict.**
The conclusion — cut both parts items from this build — still stands, but for a different
reason, and the distinction matters because "dead" invites deleting the table and its five
Supabase functions.

**The writer is not in `src/`.** The Sunday board meeting feeds this list.
`.claude/workflows/sunday-board-meeting.js` says so in its own header at lines 12 and 16: the
three end-of-meeting writes are schedule → `scheduledSlots`, picked jobs → `focus_list`, and
**new parts → `parts_to_order`**, all as live chat turns outside any Workflow call. Line 73
reads the list back and line 95 hands it to the Admin seat. Searching `src/` for callers was
always going to return zero and prove nothing.

**Verified live 2026-07-27** (read-only probe): `parts_to_order` exists in Supabase with all
six columns — `id`, `description`, `category`, `needed_for_job`, `added_at`, `resolved`.
`completed_jobs` has `invoice_amount` and `week_key`. `scripts/board_meeting_export.mjs` runs
clean end to end. The Brief D migration was already run; the two "still-unrun" notes in
`docs/briefs/re-fresh-brief-d-sunday-board-meeting.md` were stale and are corrected.

**The table is empty because the first board meeting has not run yet.** Confirmed with Trevor
2026-07-27: the Sunday meeting is deliberately held until after the job-blocking build merges.

One part of the original finding does still hold: `PartsDrawer.jsx` is the **PartsBox
inventory** drawer, a different system (`utils/partsbox.js`), unrelated to `parts_to_order`.
Also unrelated: `admin/context/GGNZ Parts Shopping List.csv`, a May 2026 component-level
restoration BOM (capacitors and resistors by value, with board references). Trevor was unaware
it existed. Do not migrate it into `parts_to_order` — different granularity, different purpose.

**Recommendation unchanged: cut both parts items from this build.** The reason is sequencing,
not deadness — the list is empty until the first meeting populates it, so building the UI now
ships a feature that displays nothing and cannot be tested against real data. Parked as its own
brief: [../../briefs/parked-parts-as-a-stuck-reason.md](../../briefs/parked-parts-as-a-stuck-reason.md),
which waits on the first meeting run. **Do not delete the table or its five Supabase
functions** on the strength of the superseded "dead code" reading.

---

### 5. The "Planning" pile, as specced, is empty on the live data

Counted against the current `jobs.csv` (46 rows, 2026-07-27):

- Jobs carrying `INC`: **393 and 693 only** — and both are `Booked In`, not `Waiting`.
- Jobs carrying `Waiting`: 1268 (GTS), 1448 (CI), 1604 (CI), 1679 (GTS), 1705 (GTS) — **none
  of them `INC`**.

So `status === 'Waiting' && action === 'INC'` matches **zero jobs**. The Planning pile would
ship as a permanently empty section, and 393/693 — the two jobs that genuinely are in planning —
would sit in the schedulable lists as if they were ready to start.

This is a rule problem, not a code problem, and it has to be settled before Task 5 is built.
Three options:

1. **Pile on `action === 'INC'` alone**, ignoring status. Catches 393 and 693. Simplest, and it
   matches what `INC` actually means in MT.
2. **Keep the `Waiting + INC` rule** and accept an empty pile until the tagging changes.
3. **Fix the tagging in MT** — re-tag 393/693 as `Waiting`, then rule 1 and rule 2 agree.

Recommendation: **option 1**, with option 3 as housekeeping. `INC` is the signal; the status
column is not carrying it reliably today. Added to "Decisions needed".

---

## Task list

Tasks are ordered so each one is independently reviewable. Tasks 1–3 are data-layer and can be
verified without touching the UI; 4–8 are the visible change; 9–10 are the small wins.

---

### Task 1 — Make job age survive a reload, and keep blanks blank

**Why:** correction #1 and #2 above. Nothing else in the plan works until age is real — the
Waiting count, the red 14-day flag and the 90-day meeting surface all read it.

**Files:**

1. `docs/supabase-schema.sql` — add to the `jobs` table:
   ```sql
   days INTEGER,
   ```
   and a one-off migration note for the live database (`ALTER TABLE jobs ADD COLUMN IF NOT
   EXISTS days INTEGER;`). There is no migration tooling in this project — the SQL gets run by
   hand in the Supabase SQL editor, same as every previous schema change. **This is the only
   step in the whole plan that touches production data directly; it runs before the branch is
   merged, and it is additive, so old clients are unaffected.**

2. `src/data/jobs.js:207` — blank must stay blank:
   ```js
   days: obj.Days?.trim() ? parseInt(obj.Days, 10) : null,
   ```
   Guard against a non-numeric value too: if `parseInt` yields `NaN`, store `null`.

3. `src/data/jobs.js:235` — null-safe sort, blanks to the newest end:
   ```js
   return jobs.sort((a, b) => (b.days ?? -1) - (a.days ?? -1));
   ```
   `-1` not `0`: a genuine 0-day job must sort ahead of an unknown one.

4. `src/utils/supabase.js` — add `days` to `JOB_PASSTHROUGH_FIELDS` (line 117) and to the
   `transformed` object in `upsertJobsBatch` (line 173).

5. `src/hooks/useSupabase.js:33` — add to `normalizeJobsFromDb`:
   ```js
   days: j.days == null ? null : Number(j.days),
   ```

6. **The blank-beats-good guard.** The spec's hard requirement. `handleCsvUpload`
   ([src/hooks/useJobs.js:267](../../../src/hooks/useJobs.js)) is upsert-only, so an import with
   a blank `Days` would write `null` over a good value. The guard belongs in `handleCsvUpload`,
   where both the incoming row and the current in-memory job are visible:

   ```js
   const prevByJobNo = Object.fromEntries(
     jobs.filter(j => !j.parentId).map(j => [j.job, j])
   );
   const topLevel = parsed.filter(j => !j.parentId).map(j => {
     const prev = prevByJobNo[j.job];
     return (j.days == null && prev?.days != null) ? { ...j, days: prev.days } : j;
   });
   ```
   Placed immediately after the existing `topLevel` filter, before `masterByJobNo` and before
   the `saveJobsMasterBatch` write, so both the optimistic merge and the persisted row carry the
   preserved value.

   Note the Haiku plan claimed a line `newJob.days = parseInt(row.Days) || null;` exists in this
   function. It does not. Don't go looking for it.

**Verification:**
- Unit test in `src/data/jobs.test.js`: a row with `Days` empty parses to `days: null`, not `0`;
  a row with `Days=274` parses to `274`.
- Unit test on the sort: `[{days:null},{days:0},{days:5}]` orders `5, 0, null`.
- Unit test on the import guard: job 1708 with a populated `days` in state and a blank in the
  CSV keeps its value; a job with a *changed* populated value takes the new one.
- Browser: upload `jobs.csv`, reload the page, confirm job 1582 still reads 274 days and jobs
  1708/1710 render blank rather than "0d".

---

### Task 2 — `job_status_since` table and Supabase functions

**Why:** stuck age. MT doesn't have it and nothing else in the system knows it.

**Files:**

1. `docs/supabase-schema.sql` — new table, exactly as specced:
   ```sql
   CREATE TABLE IF NOT EXISTS job_status_since (
     job_id TEXT PRIMARY KEY,
     status TEXT NOT NULL,
     action TEXT,
     since   TIMESTAMPTZ NOT NULL DEFAULT NOW()
   );
   ALTER PUBLICATION supabase_realtime ADD TABLE job_status_since;
   ```
   No foreign key to `jobs`. Same reasoning as the comment above `parts_to_order.needed_for_job`
   at [supabase.js:761](../../../src/utils/supabase.js): a job row can be deleted and re-created
   by an import, and a cascade would silently reset the clock — the one thing this table exists
   to prevent.

   **RLS:** every existing table in this schema is created without RLS and the app uses the anon
   key. Match that. Do not invent policies for this one table — a lone RLS'd table in an
   otherwise open schema is a false sense of security and a live risk of silently blocking reads
   (see `loadJobs`'s "RLS policy likely blocking" fallback at
   [supabase.js:30](../../../src/utils/supabase.js), which already exists because of exactly that).
   Whether the schema as a whole should be locked down is a real question, and a separate one.

2. `src/utils/supabase.js` — four functions, placed alongside the other side-table sections:
   - `loadStatusSince()` → `{ [jobId]: { status, action, since } }`, or `null` on failure.
     Returning `null` rather than `{}` is load-bearing: it's what lets the hook refuse to arm
     writes after a failed read, the same pattern as `loadFocusList`.
   - `upsertStatusSince(rows)` → per-row `upsert` with `onConflict: 'job_id'`. Returns
     `{ ok: boolean }`, matching `batchWriteJobsState`'s resolve-don't-reject convention so
     callers can gate on `res?.ok`.
   - `clearStatusSince(jobIds)` → `delete().in('job_id', jobIds)`. Never a bare `.neq('id','')`
     table-wipe.
   - `subscribeToStatusSince(callback)` → same channel shape as `subscribeToFocusList`
     ([supabase.js:647](../../../src/utils/supabase.js)), re-reading on any event and dropping
     the event when the re-read returns `null`.

   **Explicitly not** `saveFocusList`'s clear-and-rewrite. The spec calls this out and it
   matters: that function's snapshot-and-restore guard exists because one bad read can destroy
   the whole list. A per-row table has no such failure mode, and copying the pattern would
   import the risk for no benefit.

**Verification:** unit tests with a mocked client covering the `null`-on-error contract and the
`{ok:false}`-not-throw contract. No UI yet.

---

### Task 3 — `useJobStatusSince` hook

**Why:** owns the clock and the reconciliation rule.

**File:** `src/hooks/useJobStatusSince.js` (new), modelled on
[useFocusList.js](../../../src/hooks/useFocusList.js) — same `ready` gate, same
`justSavedAt` / 3000ms echo guard, same `failedSavesRef` cap of 3.

Differences from `useFocusList`, deliberately:
- No debounced whole-list auto-save. Reconciliation is per-row and event-driven.
- Takes `jobs` as an argument and reconciles when it changes.

**Reconciliation rule**, straight from the spec:

```
for each top-level, not-done job:
  row = stored[job.id]
  if !row                                        -> upsert { status, action, since: now }
  else if row.status !== job.status
       || row.action !== job.action              -> upsert { status, action, since: now }
  else                                           -> leave alone
for each stored row whose job is done or gone    -> clearStatusSince
```

Action is part of the comparison, not just status: a job moving `Waiting/INC` →
`Waiting/CI` has genuinely changed pile (Planning → Waiting) and must restart its clock, even
though the status string is identical. This is the one place the spec's prose ("if a job's
status differs") is looser than the table it defines, and the table wins.

Three guards the build must not skip:
- **Never reconcile before `ready`.** A failed read plus an eager write would stamp `since: now`
  on every job in the shop and destroy every real stuck age at once. This is the single most
  destructive failure mode in the plan.
- **Only reconcile after the first real jobs snapshot.** `jobs` is `[]` on first render;
  treating that as "every job disappeared" would clear the whole table. Gate on the same
  `hasSeenFirstSnapshotRef` idea `useSupabase` already uses at
  [useSupabase.js:107](../../../src/hooks/useSupabase.js).
- **Top-level only.** Split children (`parentId != null`) and derived cards (`isDerived`) never
  get a row — they don't have their own MT status.

Returns `{ statusSince, stuckDays }`, where `stuckDays(jobId)` is whole days since `since`,
computed with `localDateKey`-style local-date maths rather than `toISOString()` — NZ is UTC+12
and a naive UTC diff reads a day off for half of every day. `useSupabase`'s week keys already
avoid `toISOString()` for exactly this reason.

Wired in `App.jsx` next to the other hooks; `stuckDays` passed down the same way `focusList` is.

**Verification:** unit tests for each branch of the reconciliation rule, plus the `ready` gate
and the empty-`jobs` gate. These two gate tests are non-negotiable — they are the tests that
prove the destructive case can't happen.

---

### Task 4 — Blocked jobs get no bench; unclassified gets flagged

**Why:** Admin stops being the dumping ground.

**File:** `src/data/jobs.js`, `inferBench` (lines 10–35).

```js
if (status === 'In Transit') return null;
if (status === 'Waiting' && !['INC', 'CI'].includes(act)) return null;
if (status === 'Waiting' && ['INC', 'CI'].includes(act)) return null;
if (status === 'On Hold' && !(backlog && act === 'GTS')) return null;
```

Two things the builder must not do:

- **Do not touch `DEFAULT_BENCH_KEYWORDS` (lines 3–8) or the manufacturer lists (lines 31–32).**
  Those are months of hand-tuning. This task changes the early-return status branches and the
  final fallback, nothing between them.
- **Do not rewrite the function.** The Haiku plan replaced it wholesale and invented benches
  ("Finishing", "Electrical") that don't exist. The real benches are Fretwork, Luthier, Setup,
  Electronics and Admin.

`inferBench` is positional (`desc, status, action, model, mfr, keywords`) and currently receives
no `backlog` argument, so the `On Hold + BL=Y + GTS` case can't be distinguished inside it as it
stands. Two options, and the builder should take the second:

1. Add a `backlog` parameter — positional, so every call site must be checked.
2. Leave `On Hold` returning `null` and let the ready-to-start case be handled where it already
   is, in `deriveJobStatusFlags` — the caller can re-infer a bench for `readyToStart` jobs. This
   keeps the signature untouched.

Option 2 is safer and matches how the flag already works. Confirm at council.

**The final `return 'Admin'` (line 34) becomes `return null`,** and the job is flagged. Rather
than a new stored field, derive it: a top-level job with `bench == null` and no blocked status
is unclassified. That keeps it out of `jobs[]` shape and out of the CSV write path.

`To Be Invoiced` keeps its Admin bench — it is real bookable work. Verify the keyword path
actually produces Admin for it rather than falling through to the new `null`.

**Fallout to check (this is the widening blast radius the spec warns about):**
- `BENCH_COLORS[job.bench] || BENCH_COLORS.Admin` at [JobsPage.jsx:163](../../../src/components/JobsPage.jsx)
  and `:81` — a `null` bench now hits the Admin fallback colour. Needs its own "no bench" style.
- `JobsPage.jsx:20` builds bench chips from `topLevel.some(j => j.bench === b)` — fine with
  `null`, but confirm the "Needs a bench" chip is added deliberately.
- `Sidebar.jsx:98` `matchBench` — `j.bench === benchFilter` is false for `null`, which is correct.
- `createSubtasks` and `BENCH_HOURS` — confirm a `null` bench doesn't produce a split card with
  no bench.
- `upsertJobsBatch` writes `bench: job.bench` — `null` into a nullable TEXT column, fine.

**Verification:** unit tests over `inferBench` for each status/action combination in the spec's
table, plus a regression test that a plain `Active` job with fret keywords still lands on
Fretwork. Browser: the Admin bench chip on the Jobs page should hold only `To Be Invoiced` jobs.

---

### Task 5 — The three piles in the Sidebar

**Why:** the visible shape of the whole change.

**File:** `src/components/Sidebar.jsx`, lines 69–75 and the render sections below.

Today:
```js
const readyToStart  = unscheduled.filter(j => j.readyToStart);
const awaiting      = unscheduled.filter(j => j.awaiting);
const inTransit     = unscheduled.filter(j => j.inTransit);
const onHold        = unscheduled.filter(j => !j.schedulable && !j.awaiting && !j.inTransit);
```

After — the three locked sections (`awaiting`, `inTransit`, `onHold`) collapse into two lines:

```js
const planning = unscheduled.filter(j => actionOf(j) === 'INC');   // see correction #5
const waiting  = unscheduled.filter(j =>
  !j.schedulable && !planning.includes(j));   // CI, In Transit, On Hold, non-INC Waiting
```

**The `planning` line above assumes decision 4 lands on option 1** (`INC` alone). If council
picks option 2, restore the `j.status === 'Waiting' &&` clause and expect the pile to render
empty until MT tagging changes. Do not build both.

`readyToStart`, `active` and `backlog` are untouched.

- **Waiting (n)** — count red when any member's `stuckDays` ≥ 14. Red on the *count*, per the
  spec, not on individual rows.
- **Planning (n)** — no red, ever. Ages shown quietly on the rows.
- Both collapsed by default, expanding to rows showing the plain-English reason and stuck age.

`deriveJobStatusFlags` already gives `awaiting` for `Waiting + INC|CI` — that flag now splits
into two piles, so don't reuse it directly for either. Add the split in a small exported helper
in `src/data/jobs.js` (`blockedPile(job) -> 'waiting' | 'planning' | null`) so Sidebar, JobsPage,
JobShelf and CalendarGrid all read the same rule rather than four copies of the same filter.
This is the single most important structural decision in the task: four inconsistent copies of
"is this blocked" is how the current three-section sprawl happened.

**Verification:** browser on the Vercel preview — count the jobs in each pile against `jobs.csv`
by hand. From the current file (46 rows, 2026-07-27): under option 1, **Planning = 393, 693**
(the only two `INC` rows, both `Booked In`); under option 2, **Planning = empty**. Waiting should
hold 1448 and 1604 (`Waiting/CI`), the three `Waiting/GTS` rows 1268, 1679, 1705, and every
`On Hold` row. The builder must recount from the live data, not from this list.

---

### Task 6 — Hide blocked work from the "what can I touch" lists

**Why:** the whole point — blocked work stops competing for attention.

**Files and exact filter sites** (the spec asked for these to be confirmed; they are):

| File | Line | Change |
|------|------|--------|
| `src/components/JobsPage.jsx` | 17 | `topLevel` excludes `blockedPile(j)` |
| `src/components/JobShelf.jsx` | ~90–97 | `topLevel` excludes blocked before `visible` is built |
| `src/components/Sidebar.jsx` | 70–72 | already handled by Task 5 |
| `src/components/CalendarGrid.jsx` | — | **no exclusion** — scheduled blocked jobs stay visible |

`CalendarGrid` instead gets a small tag on a scheduled blocked job, per the spec: hiding work out
of a day Trevor already planned would be worse than the noise.

`DailyLogPage.jsx:824` sorts by days but is the daily log, not a "what can I touch" list — leave
it alone unless council says otherwise.

**Verification:** browser — a `Waiting/CI` job must be absent from the Jobs page and the job
shelf, present in the Sidebar's Waiting line, and still on the calendar if scheduled.

---

### Task 7 — Plain-English reason labels

**File:** `src/data/jobs.js`, new exported `blockedReason(job)`:

| Status + Action | Returns |
|---|---|
| `Waiting` + `CI` | `waiting on the customer` |
| `Waiting` + `INC` | `planning` |
| `In Transit` | `in transit` |
| `On Hold` | `on hold` |
| ready-to-start | `null` |

Pure function, no data access. The parts variant (`waiting on parts: …`) is **cut** — see
correction #4.

Rendered in `JobCard`, `JobDrawer` and `MobileJobSheet` alongside the stuck age.

**Verification:** unit tests per row of that table.

---

### Task 8 — Stuck age on the cards

**Files:** `JobCard.jsx` (near line 149, where `📅 {job.days}d` already renders), `JobDrawer.jsx`,
`MobileJobSheet.jsx`.

- Job age: `job.days == null ? '' : `${job.days}d`` — the blank must render blank. Line 149
  currently renders `undefined` as an empty string by accident; make it deliberate.
- Stuck age: `waiting 12 days`, from `stuckDays(job.id)`. Only on blocked jobs.

**Verification:** browser — jobs 1708 and 1710 show no age badge at all, not "0d".

---

### Task 9 — mTrack deep link

**Files:** `JobCard.jsx` / `JobDrawer.jsx` / `MobileJobSheet.jsx`.

```js
const mtrackUrl = job => `https://www.multitrack.co.nz/guitarg/vw_job.php?sw=1&jb=${encodeURIComponent(job.job)}`;
```

`target="_blank" rel="noopener noreferrer"`. Pure URL template, touches no data. Smallest item
here and the highest value per line — could ship on its own if the rest stalls.

**Verification:** click it, land on the right MT job.

---

### Task 10 — "Needs a bench" pile

**File:** `JobsPage.jsx` — a chip alongside the bench chips, listing top-level jobs with
`bench == null` that aren't blocked. Amber, so it reads as "needs attention" rather than "broken".

Low priority. The spec explicitly allows this to ship after the main change; if the build is
running long, cut it and keep it on the backlog.

---

## Out of scope — do not build

Carried from the spec, plus correction #4:

- A Scheduler-side "why is this stuck" reason field. The meeting is the reason.
- Importing MT's `Comments` box, a second PDF source, or hunting for extra export columns.
- Any Gantt chart, dependency arrows, dependency types, or job-to-job dependency records.
- Auto-rescheduling calendar slots.
- Sub-benches.
- **The two parts features** (parts as a reason, resolve nudge) — no parts-to-order list exists.
- Touching the Multitrack PDF parser or the watcher. The parser is still unfixed; dropping a bad
  PDF re-truncates `jobs.csv`.
- Anything in `SCHEDULER_old/`.

## Decisions — SETTLED at council, 2026-07-27

Two independent council agents reviewed. Where they split, the main conversation checked the
code directly and broke the tie. **These four are settled; the builder does not re-open them.**

1. **The two parts features — CUT.** Both agents agree, all claims verified: a repo-wide grep
   for the five `parts_to_order` functions plus `needed_for_job` returns zero hits in `src/`
   outside their own definitions. Leave the five functions in `supabase.js` alone — deleting
   them is separate cleanup. *(New: the table is read by `scripts/board_meeting_export.mjs:80`
   and the Sunday workflow, populated by hand during the board meeting. A human meeting
   artefact, not a code feature — which reinforces the cut.)*

2. **`inferBench` backlog — ADD THE PARAMETER (option 1). This overrides the plan's original
   recommendation.** Option 2 as written above is not implementable:
   `deriveJobStatusFlags(status, action, backlog)` ([jobs.js:63](../../../src/data/jobs.js))
   takes three arguments and has no `desc`/`model`/`mfr`/`keywords` — it cannot re-infer a
   bench. Doing it at the two `inferBench` call sites instead would duplicate a
   "spoof the status" trick in two files, which is the copies-drift failure mode Task 5 exists
   to prevent. Append `backlog` as a 7th positional parameter: there are exactly **two** call
   sites, [jobs.js:196](../../../src/data/jobs.js) and
   [App.jsx:779](../../../src/App.jsx), both already pass all six arguments and both already
   have `backlog` in scope.
   - **`App.jsx:779` is a call site the plan never mentioned, and it is not read-only** —
     line 785 writes every changed bench back to Supabase via `saveJob`. A `null` bench becomes
     a real write. Check it.
   - ~~Live impact is one job: **1175** (Allen & Heath GL2800), the only `On Hold + BL=Y + GTS`
     row. Today [jobs.js:14](../../../src/data/jobs.js) gives it `Admin` even though it is
     schedulable — an existing bug this fixes. With `backlog` passed it resolves to
     Electronics.~~
   - **CORRECTED 2026-07-27 — this premise was wrong, and the verifier must not test against
     it.** Job 1175's `GTS` was stale data, not a real state. It is **On Hold + CI** — the job
     is in dispute. The Google Sheet has said `CI` since some point after 26 July 5:39pm; the
     CSV never picked it up because both pipeline watchers were killed during the truncation
     incident and never restarted. A read-only Sheet-vs-CSV diff on 27 July found exactly three
     stale cells (1175 Action, plus Tag/Action on the two new jobs 1708 and 1710) and nothing
     else. The CSV has been corrected; Supabase still holds `GTS` until Trevor re-uploads.
   - **Consequence: there are now ZERO live `On Hold + BL=Y + GTS` jobs.** Every On Hold row
     was re-checked. The `readyToStart` exception has no example in today's data.
   - **The change is still correct — keep it.** Without `backlog`, `inferBench` would strip the
     bench off any future ready-to-start job while `Sidebar.jsx` simultaneously listed it under
     ✅ READY TO START. That self-contradiction is the thing being fixed. It is now a
     consistency fix with no visible effect today, not a bug fix with a live example.
   - **New browser-test expectation for 1175:** after the corrected CSV is uploaded, it should
     move from "✅ Ready to Start, Admin badge" to **blocked, no bench chip, reason "waiting on
     the customer"**. Do not expect Electronics.
   - `scripts/sheet_to_csv.command:326` has a Python mirror of this logic whose header claims
     the two are hand-kept in sync. It targets Firestore, not Supabase, so it cannot corrupt
     the live DB — but update the comment rather than leaving it claiming a sync that no longer
     holds.

3. **The `days` migration — Trevor, by hand, in the Supabase SQL editor. Confirmed, with an
   ordering correction: it runs BEFORE THE BROWSER TEST, not before merge.** The Vercel preview
   points at the same production Supabase; there is one database and no sandbox. Verified there
   is no migration tooling (no `supabase/` dir, no CLI in `package.json`); the precedent is
   `docs/supabase-daily-logs-migration.sql`, hand-run.
   - **Column-before-code is safe** — `loadJobs` does `select('*')`, `normalizeJobsFromDb`
     simply won't map the new column, and `upsertJobsBatch` builds from an explicit key list, so
     the column stays NULL and nothing in the deployed app touches it.
   - **Code-before-column fails silently and is the trap.** PostgREST would reject the whole
     batch, `supabase.js:208-210` swallows the error, and `useJobs.js:295` still shows
     "Loaded N jobs from CSV". Trevor would see a successful import that saved nothing.
   - Tell Trevor in advance: `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS days INTEGER;` is
     idempotent, but Task 2's `ALTER PUBLICATION supabase_realtime ADD TABLE job_status_since;`
     is **not** — re-running it throws "relation is already member of publication". Harmless,
     but he must not read that red error as having broken something.

4. **Planning pile — `INC` alone.** Both agents confirmed independently, and the main
   conversation re-counted the live CSV a third time: **45 records** (not 46 — job 842's `Desc`
   wraps two lines); INC = **393 and 693 only**, both `Booked In`, both `BL=Y`; the five
   `Waiting` rows (1268/GTS, 1448/CI, 1604/CI, 1679/GTS, 1705/GTS) carry no INC; so
   `Waiting + INC` = **zero jobs**. Blank `Days` = 1708, 1710. Confirmed.
   - **Note for whoever reads this later:** INC-alone makes the pile status-independent. A
     future `Active + INC` job would be pulled out of the active list. That is what INC means,
     and it is intended — not a regression.
   - The CSV also carries a **`FirstSeen`** column. It is **empty on all 45 rows** and no code
     in `src/` reads it (only the three scripts write it). It is not a shortcut for stuck age;
     Task 2's table is still required.

---

## Council amendments to the task list — MANDATORY

Five changes the builder must apply. The first three came from both agents independently.

**A. `blockedPile(job)` is the single source of truth, and `active`/`backlog` must subtract it.**
Task 5's line "`readyToStart`, `active` and `backlog` are untouched" is **wrong** and must be
struck. Jobs 393 and 693 are `Booked In` (so `schedulable`) and `BL=Y` (so `backlog`), so today
they render in the Sidebar's BACKLOG section
([Sidebar.jsx:70-71](../../../src/components/Sidebar.jsx)). Under Task 5 as written they would
render in **Backlog and Planning at once**, be hidden from the Jobs page, and still carry an
Electronics bench chip — four screens, three different stories about the same two guitars. That
is the exact "where did my job go" failure this build exists to prevent, manufactured by the fix.
`active` and `backlog` must both exclude `blockedPile(j)`.

**B. `inferBench` must read the same predicate.** Task 4 returns `null` only for
`In Transit`/`Waiting`/`On Hold`. 393 and 693 are `Booked In`, so they keep a bench — both hit
`/passport|pa\s*\d/` at [jobs.js:30](../../../src/data/jobs.js) and resolve to Electronics. So
"blocked jobs get no bench" would be false of the entire Planning pile. Drive `inferBench`'s
blocked branches off `blockedPile` too, so no job can be blocked in one list and workable in
another. **This is the single most important structural requirement in the build.**

**C. Search must always see blocked jobs, even when the lists don't.**
[JobsPage.jsx:17](../../../src/components/JobsPage.jsx) builds `topLevel`, and **search filters
that same array** (lines 23-31), as does [JobShelf.jsx:91](../../../src/components/JobShelf.jsx).
If Task 6 removes blocked jobs from `topLevel`, then a customer rings, Trevor types their name,
and gets "no jobs match" for a guitar physically in his shop. Exclude blocked from the *display*
path only — when a search query is active, the exclusion must not apply.
Note also that JobsPage **already** quarantines locked jobs under a "Waiting / On Hold" header
with no tap handler (lines 144-156, `onTap` null at line 59), so Task 6 buys less here than the
plan assumes while costing search. Weigh it accordingly.

**D. The `useJobStatusSince` guard is structural, not a copied gate.** Do **not** simply copy
`useFocusList`'s `ready` gate — it proves only that *its own* table read succeeded, and the new
hook depends on two reads. `loadJobs` fails **silently and returns an empty array**
(`supabase.js:30-32`, `return jobsCache`, which is `[]` on a cold load), and
`useSupabase.loadAndSetJobs` then calls `setJobs([])` unconditionally. With `ready === true` and
`jobs === []`, the reconciliation rule's "for each stored row whose job is gone → clear" wipes
the whole table. `hasSeenFirstSnapshotRef` does not help: it is only ever flipped inside the
realtime subscription, never by `loadAndSetJobs`. Required instead, in this order:
   1. **Never delete a row merely because its job is absent.** Only clear rows for jobs that are
      present-and-`done`. A stale row costs nothing — it is keyed by `job_id` and gets re-adopted
      if the job returns, which is exactly the re-import case cited as the reason for no foreign
      key. This removes the failure mode structurally rather than guarding it.
   2. Gate the reconcile on `jobs.length > 0` **and** on `firebaseReady`.
   3. Refuse any single pass that would delete more than half the stored rows.
   4. **If the write fails, show an in-app banner** ("stuck ages unavailable, not saving") and
      **suppress the stuck-age display entirely rather than showing `0d`**. Brief D already
      logged that a failed save is console-only, and Trevor does not open the console. A wrong
      number he trusts is far worse than a missing one.

**E. Task 7 needs a fallback reason.** The label table covers `Waiting+CI`, `Waiting+INC`,
`In Transit`, `On Hold`. **Three of the five live Waiting jobs are `Waiting + GTS`** — 1268,
1679, 1705 — and match no row, so they would land in the Waiting pile with a blank reason. Add a
fallback string ("waiting — see Multitrack"). Also 1637 (Martin DCPA5) is `On Hold + GTS` with
`BL` blank, so it is not `readyToStart` and gets hidden despite an action code that reads "good
to start" — MT's tagging, not the app's, but expect the question.

## Other council findings the builder must know

- **`bench` is stored, not derived.** `normalizeJobsFromDb` reads `bench: j.bench` straight from
  the row and nothing re-infers on load, so every currently-stored blocked job keeps
  `bench: 'Admin'` until a CSV import rewrites it. **The browser test must upload `jobs.csv`
  first**, or the verifier will fail a working build.
- **The red 14-day flag cannot fire for two weeks after deploy.** `job_status_since` starts
  empty, so the first reconcile stamps `since: now` on all 45 jobs and every `stuckDays` reads 0.
  Expected — but it will read as broken unless stated up front.
- **There is nothing to backfill the stuck clock from. Checked 2026-07-27; do not re-investigate.**
  The question was whether past board-meeting exports recorded which jobs were Waiting each week,
  which would let the flag be real from day one. They don't, on two counts. First, no board meeting
  has ever run — Trevor is holding the first one until this build merges. Second, even once they do
  run, nothing saves the output: `.claude/workflows/sunday-board-meeting.js` builds its report and
  hands it to the chat session, and no file is written. There is no history anywhere in the repo.
  MT's `Days` can't seed it either — that is total job age, not time-in-status. The fortnight of
  dormancy is unavoidable.
- **Task 8's `JobCard.jsx:149` note is half right.** `<span>📅 {job.days}d</span>` — JSX drops a
  null value but the literal `📅 ` and `d` still render, so a blank age currently shows `📅 d`,
  not nothing. The guard must wrap the whole span.
- **Two more places collapse a null age to zero**, not listed in Task 8: `ProjectsPage.jsx:29`
  (`job.days || 0`) and `DailyLogPage.jsx:408` (`ageDotColor(job.days ?? 0)`).
  `DailyLogPage.jsx:434` already guards correctly.
- **`days` needs no change in `pickMasterFields`** ([joinJobs.js:64-77](../../../src/data/joinJobs.js))
  — it is a deny-list against `NON_MASTER_FIELDS`, which does not contain `days`, so it passes
  through automatically. Do not "helpfully" add it and break the deny-list's logic.
- **Task 1's blank-beats-good guard cannot be done by omitting the `days` key on some rows of a
  single upsert batch.** Heterogeneous key sets in one PostgREST call are a known hazard here —
  `batchWriteJobsState` groups rows by column set for exactly this reason. Blank-days rows (1708,
  1710) need a separate batch or a read-merge, not a conditional spread.
- **Sort the Waiting pile oldest-first.** Red on the count without naming the job means Trevor
  sees "3" and still has to open the pile to find the offender. Oldest at the top fixes that with
  no second alarm.
- **Cut line if the build runs long:** tasks 1, 2, 3, 5, 6, 7 are one indivisible feature. Task 4
  is separable and can ship after. Tasks 8, 9, 10 are optional — but 9 (the Multitrack link) is
  worth more per line than 8, so protect it. **The one combination to avoid is shipping 4 without
  a unified `blockedPile`.**
- **Scale check, for the brief:** under INC-alone, ~~**17 of 45 jobs (38%)**~~ **18 of 45 jobs
  (40%)** leave the schedulable lists at once — 5 Waiting, **11** On Hold, 2 Planning. Revised
  2026-07-27: 1175 is not ready-to-start (see the correction under decision 2), so no On Hold row
  is subtracted. Right call, but a big visible change on first load.

## Protocol

Blast-radius work under CLAUDE.md: `jobs[]` shape and filtering across most job-rendering
components, plus the CSV import path.

1. Brief in `.claude/pending-brief.md`, Trevor approves ("yp")
2. Two council agents review — specifically the three decisions above
3. Builder on a staging branch
4. Independent verifier, never the builder
5. Browser test on the Vercel preview
6. Merge on "yp"

No commits before step 1.
