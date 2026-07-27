# Session refresh — Brief E round 3 (job blocking)

Continuing work in the GGNZ Scheduler repo, on branch `staging/job-blocking` (pushed, up to date
with `origin/staging-job-blocking` at `7ed6f4c`). Goal of this session: **fix the three blockers the
independent verifier raised against Brief E, re-verify, browser-test, and merge.**

Working tree was clean at handoff. Tests green: 5 files / 84 tests.

---

## Where things stand

Brief E ("Why isn't this job moving?" — job blocking) is at step 4 of the agent-team protocol.
The builder finished round 2, and the **independent verifier returned DO NOT SHIP**. Its three
blockers were then re-checked by hand in the main session and **all three are confirmed real**.

### What the build actually did
Blocked jobs now get **no bench** — `inferBench` delegates to `blockedPile` and returns `null`
([src/data/jobs.js:27](../../src/data/jobs.js#L27)). That part works: exactly 18 of 45 live jobs come
back bench-less, and zero jobs are workable-but-unclassified.

### What it didn't do
It made "no bench" legal in one file and never taught the rest of the app what a bench-less job
looks like. That is **one root cause with three symptoms**, not three separate bugs — it's an
unfinished job, not the patch-on-patch spiral CLAUDE.md flags as a stop signal. Finish it; don't
back it out.

---

## The three blockers (all independently confirmed)

**1. Blocked jobs can no longer be scheduled, and the error message lies.**
`scheduled_slots.bench` is `TEXT NOT NULL` ([docs/supabase-schema.sql:40](../supabase-schema.sql#L40)),
but `saveScheduledSlotsBatch` now sends `bench: null` ([src/utils/supabase.js:344](../../src/utils/supabase.js#L344)).
`JobCard.jsx` calls `useDraggable` with no `disabled` flag ([src/components/JobCard.jsx:8](../../src/components/JobCard.jsx#L8)),
so a blocked job still looks draggable. Drag job 1616 onto a slot → it appears to land, then reverts
with `⚠ Save failed — #1616 snapped back, try again`. That toast reads as a network hiccup. It isn't;
it will fail every time.

**2. The new bench-less colour is imported by nobody.**
`NO_BENCH_COLORS` and `benchColors()` exist only at [src/data/jobs.js:417–422](../../src/data/jobs.js#L417)
— grep confirms **zero importers**. Roughly 17 render sites still do
`BENCH_COLORS[job.bench] || BENCH_COLORS.Admin` (JobCard, JobsPage, CalendarGrid, JobShelf,
ProjectsPage, MobileJobSheet, SplitDrawer, PomoDrawer, DailyLogPage, WeeklySummaryModal,
CloseDayModal, JobDrawer, CatchUpInterview), so blocked jobs just paint Admin-grey.
`WeeklySummaryModal.jsx:29` does `job.bench || 'Admin'`. `src/utils/googleCalendar.js:178,204` would
write a literal `Bench: null` into Google Calendar events.

**3. Two rules for "is this job blocked?", and they disagree on screen.**
`blockedReason()` ([jobs.js:136](../../src/data/jobs.js#L136)) and `needsBench()`
([jobs.js:152](../../src/data/jobs.js#L152)) are **called by nothing**. `blockedPile()` is called only
by `inferBench` (and the tests). Sidebar / Jobs / shelf still run the old `deriveJobStatusFlags` rule
via [src/hooks/useSupabase.js:36](../../src/hooks/useSupabase.js#L36). Result: jobs **393 and 693**
lose their bench as "planning" under the new rule while the old rule still lists them under
ACTIVE/BACKLOG. Two screens, one job, opposite answers — the exact bug Brief E set out to close.
**Council amendment A** (active/backlog must subtract `blockedPile`) was never built.

---

## Decision — SETTLED, Trevor answered 27 July

**Should a blocked job be draggable at all? NO.** Trevor's words: *"blocked jobs should never be dnd
until not blocked then normal."*

- A blocked job is **not draggable at all** — the card does not pick up, so nothing can be dropped on
  the calendar and the misleading "Save failed, try again" toast never fires.
- The moment the job stops being blocked, drag behaves **exactly as it does today**. No new mode, no
  half-state, no separate "blocked drag" path — the block is the only thing that gates it.
- Give the card a tooltip / cursor so it's obvious *why* it won't pick up, not just dead to the touch.

Do **not** loosen the `bench TEXT NOT NULL` column to let bench-less jobs be scheduled. That was the
rejected alternative: more work, worse outcome, and it keeps the behaviour Brief E is trying to remove.

---

## Known error in the plan file — fix the code, not just the doc

The plan ([docs/superpowers/plans/2026-07-27-job-blocking-implementation.md](../superpowers/plans/2026-07-27-job-blocking-implementation.md))
says job 1175 should read **"waiting on the customer"** once the corrected CSV is uploaded. The code
returns **"on hold"** — `blockedReason` checks `status === 'On Hold'` before it considers `CI` outside
of `Waiting` ([jobs.js:145](../../src/data/jobs.js#L145)). Verified by hand; the verifier was right.
Recommendation: **change the code** so `CI` is checked ahead of status. "On hold" merely restates the
status column; "waiting on the customer" tells Trevor who to chase.

---

## Next steps

1. ~~Get Trevor's yes/no on the non-draggable decision.~~ **Answered — see the settled decision above.
   Nothing is waiting on him; start at step 2.**
2. **Write a brief amendment** into `.claude/pending-brief.md` covering round 3 — this is
   blast-radius work and CLAUDE.md forbids a commit without a brief entry.
3. **Round 3 build**, scoped to exactly:
   - blocked cards non-draggable (kills blocker 1 at the source, rather than patching the DB)
   - swap the ~17 `|| BENCH_COLORS.Admin` fallbacks to `benchColors(job.bench)`
   - stop `Bench: null` reaching Google Calendar (`src/utils/googleCalendar.js:178,204`)
   - make Sidebar / Jobs / shelf subtract `blockedPile` so both rules agree (council amendment A)
   - move the `CI` check ahead of the status check in `blockedReason`
   - tests for all of the above — the current 84 tests cover **none** of the new behaviour
4. **Re-run the independent verifier** (a fresh agent, never the builder).
5. **Browser test on the Vercel preview** — including uploading the corrected `jobs.csv` via 📂.
   Expect 1175 to show as blocked, no bench chip, reason "waiting on the customer" (after the code fix).
6. **Trevor's "yp" → merge to main.**

---

## Files to open (read these, don't re-derive)

- [.claude/pending-brief.md](../../.claude/pending-brief.md) — Brief E as approved. Scope is locked;
  round 3 needs an amendment appended here before any commit.
- [docs/superpowers/plans/2026-07-27-job-blocking-implementation.md](../superpowers/plans/2026-07-27-job-blocking-implementation.md)
  — the build plan. Decision 2 already carries the corrected 1175 premise; the "waiting on the
  customer" expectation in it is the known error above.
- [src/data/jobs.js](../../src/data/jobs.js) — where `blockedPile`, `blockedReason`, `needsBench`,
  `inferBench`, `NO_BENCH_COLORS` and `benchColors` all live. **Do not touch
  `DEFAULT_BENCH_KEYWORDS` or the manufacturer lists, and do not rewrite `inferBench`** — months of
  hand-tuning, binned once already by a previous agent.
- [src/hooks/useSupabase.js](../../src/hooks/useSupabase.js) — line 36 is where the *old* blocked rule
  still lives. Blocker 3 is fixed here or nowhere.
- [src/components/JobCard.jsx](../../src/components/JobCard.jsx) — the `useDraggable` call with no
  `disabled` flag (blocker 1).
- [docs/supabase-schema.sql](../supabase-schema.sql) — line 40, the `bench TEXT NOT NULL` constraint.
- [docs/supabase-job-blocking-migration.sql](../supabase-job-blocking-migration.sql) — **already run
  by Trevor on 27 July. Do not ask him to run it again.** Verified live: `job_status_since` exists and
  is empty, `jobs.days` exists and is null everywhere.
- [docs/briefs/handoff-pdf-import-truncation-incident.md](handoff-pdf-import-truncation-incident.md)
  — the pipeline is half-migrated and both watchers are dead on purpose. Recovery steps 5–7 are still
  outstanding. Read before touching anything CSV-shaped.
- [SCHEDULER-ARCHITECTURE.md](../../SCHEDULER-ARCHITECTURE.md) — tech stack, CSV pipeline, file
  ownership boundaries.

---

## Carried-over data — the corrected CSV

`~/Library/Mobile Documents/com~apple~CloudDocs/Desktop/SCHEDULER_old/jobs.csv` was **edited on
27 July and is not yet uploaded to Supabase.** Three stale cells were fixed after a read-only
Sheet-vs-CSV diff:

- **1175** Action `GTS` → `CI` (the job is in dispute; the Sheet was right, the CSV was a stale
  snapshot from 26 July 17:39)
- **1708** Tag `''` → `M`, Action `''` → `GTS`
- **1710** Tag `''` → `EZ`, Action `''` → `GTS`

Backup: `jobs.csv.bak-2026-07-27-pre-action-fix` alongside it.
**Supabase still holds the old `GTS` for 1175** until Trevor presses 📂 in the app — do that as part
of the browser test, not before.

**Consequence for testing: there are now ZERO live `On Hold + BL=Y + GTS` jobs.** Do not test the
`backlog` parameter against job 1175 — that premise was wrong and is already corrected in the plan.

---

## Avoid repeating

- **Don't re-run the Supabase migration.** Already applied. Its last line is not idempotent and
  throws `relation "job_status_since" is already member of publication "supabase_realtime"`.
- **Don't drop a Multitrack PDF, and don't restart the pipeline watcher.** The parser is still
  unfixed; a bad PDF re-truncates `jobs.csv`. Watcher PIDs 6236/6241/9189/9194 were killed
  deliberately and must stay dead.
- **Don't trust `scripts/sheet_to_csv.command`'s name.** It is CSV-authoritative — any Google Sheet
  row missing from `jobs.csv` gets deleted, with no sanity floor.
- **Don't delete `~/Library/Mobile Documents/.../SCHEDULER_old/pipeline.log`** (2.5 MB). It is the
  only record of the 33 jobs wiped on 26 July. Different file from the repo-root one the housekeeping
  brief mentions.
- **Don't run SQL against Supabase.** One production database, no sandbox. Read-only PostgREST probes
  are fine; migrations get pasted into the SQL editor by Trevor himself.
- **Don't re-litigate the scope lock.** The verifier already confirmed it holds:
  `DEFAULT_BENCH_KEYWORDS` fingerprint identical on main and branch (`9ca3c82…`), manufacturer regexes
  character-for-character unchanged.

---

## Non-blocking loose ends (don't let these expand round 3)

- Live action code `parts` (job 1671) appears in no spec table.
- `To Be Inv` jobs get three different answers from three components.
- `JobShelf.jsx:97` sorts blank Days as `?? 0` while `parseCSV` at `jobs.js:360` uses `?? -1`
  (affects 1708/1710).
- Splitting a blocked job would lose its sub-cards — no live case today.
- Open question from the council: re-tag jobs 393/693 in Multitrack from `Booked In` to
  `Waiting`/`On Hold`?

## After Brief E merges

- **Raised, unanswered:** the whole Supabase schema is open. All 57 job rows — customer names,
  descriptions — are readable *and writable* using only the anon key that ships in the public
  JavaScript bundle. Offered to write RLS lockdown up as its own brief, ranked above the
  board-meeting work. Trevor hasn't answered.
- Re-check [docs/briefs/re-fresh-repo-housekeeping.md](re-fresh-repo-housekeeping.md) against the
  tree — four of its items (`ce797d6`, `87499d7`, `36a0896`, `75820ea`) are already done on this
  branch, so a fresh session would go hunting for files that no longer exist.
- Supabase holds **57** rows against the CSV's 45 — 12 stale closed jobs the upsert-only import never
  removes. Not urgent, but it's why row counts never match.

## Skills to run

- `/code-review` before the merge (mandatory per the repo's own rule).
