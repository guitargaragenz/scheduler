# Pending Brief E — "Why isn't this job moving?" (job blocking)

**Status:** **APPROVED by Trevor 2026-07-27 ("yp").** Council pass in progress. Nothing built, nothing committed.
**Date:** 2026-07-27
**Repo state:** `main` @ `eae89f3` (three doc-only commits on top of the `d0e3a2c` this brief was written against — no code moved)
**Spec:** [docs/superpowers/specs/2026-07-26-job-blocking-design.md](../docs/superpowers/specs/2026-07-26-job-blocking-design.md)
**Plan:** [docs/superpowers/plans/2026-07-27-job-blocking-implementation.md](../docs/superpowers/plans/2026-07-27-job-blocking-implementation.md) — the ten tasks, in full, with file and line references checked against the working tree.
**Supersedes:** Brief D's slot in this file. Brief D shipped and merged at `da1d9af` 2026-07-25; its complete record is archived at [docs/briefs/brief-d-board-meeting-full-record.md](../docs/briefs/brief-d-board-meeting-full-record.md).

---

## Plain-English summary

Right now every job in the shop competes for attention equally, whether it can be worked
on or not. A guitar sitting in a courier van and a guitar on the bench both show up in the
same lists. Jobs that are blocked get dumped on the Admin bench, so Admin has become a
bin for "nothing else fits" rather than a real bench.

This change sorts the blocked work into two quiet piles — **Waiting** (customer, courier,
on hold: nothing Trevor can do today) and **Planning** (jobs that need a quote or a plan
written before they can start) — and takes them out of the lists that answer "what can I
pick up right now." Each blocked job shows a plain reason ("waiting on the customer",
"in transit") and how long it's been stuck. If anything in Waiting has been stuck two
weeks or more, the count turns red. That's the only alarm.

Blocked jobs stop being given a bench at all. Admin goes back to holding only real Admin
work. Any job the app can't classify gets an amber "needs a bench" flag instead of being
silently filed under Admin.

Two small extras: job age stops disappearing on every page reload, and every job card gets
a link straight through to its Multitrack page.

---

## Scope — locked

Ten tasks, detailed in the plan file. Summary:

1. **Job age survives a reload, and blanks stay blank.** New `days` column, written on
   import, read back on load. Blank ages render blank, never "0d". An import with a blank
   age never overwrites a good one.
2. **New `job_status_since` table** plus four Supabase functions — per-row upsert and
   delete, explicitly *not* focus_list's clear-and-rewrite.
3. **New `useJobStatusSince` hook** — owns the stuck clock. Three non-negotiable guards
   (never write before a successful read, never treat the empty first render as "all jobs
   gone", top-level jobs only).
4. **Blocked jobs get no bench.** `inferBench` returns `null` instead of `'Admin'`.
   Hand-tuned keyword and manufacturer lists are not to be touched.
5. **Two piles in the Sidebar** — Waiting and Planning — replacing today's three locked
   sections. One shared helper `blockedPile(job)` in `src/data/jobs.js`, so every screen
   reads the same rule.
6. **Blocked work hidden** from the Jobs page and the Job Shelf. **Not** hidden from the
   calendar — a job already planned into a day stays visible, with a small tag.
7. **Plain-English reason labels** — pure function, no data access.
8. **Stuck age on the cards.**
9. **Multitrack deep link** on every job card.
10. **"Needs a bench" chip** — amber, low priority, cuttable if the build runs long.

**Out of scope — do not build:**
- A Scheduler-side "why is this stuck" text field. The meeting is the reason.
- Importing MT's `Comments` box or adding a second PDF source.
- Gantt charts, dependency arrows, job-to-job dependency records, auto-rescheduling,
  sub-benches.
- **The two parts features** from the spec (part as the reason, resolve nudge) — see
  correction 4.
- **The Multitrack PDF parser and the watcher.** Still unfixed; a bad PDF re-truncates
  `jobs.csv`. Nothing in this build goes near `SCHEDULER_old/`.

---

## Five corrections to the spec — read before approving

Found by checking the spec against the actual files. The spec was written from the design
conversation, not from the code, and five of its assumptions don't hold.

1. **Job age is never saved to the database.** No column, no write, no read-back. Age
   exists only until the page reloads. The spec's claim that stuck age is "the only thing
   that needs new plumbing" is wrong — job age needs it too. **Brief D already caught this**
   (scope item 4, third bullet: add a column or explicitly disable age reporting) and the
   Builder did neither, so the numbers have been quietly wrong since 25 July. Task 1 pays
   that back.
2. **The blank-age bug is one line earlier than the spec says** — and worse. Blanks become
   `0`, not `NaN`, so a brand-new job and an unknown-age job look identical. Jobs 1708 and
   1710 are the live examples. Root fix is at the parse, not the sort.
3. **`inferBench` already routes blocked jobs to Admin** deliberately, so the change is
   smaller than the spec implies — but `bench` becomes nullable everywhere downstream, and
   that fallout is listed in the plan.
4. ~~**`parts_to_order` is dead code.**~~ **CORRECTED 2026-07-27 — it is empty, not dead.**
   Searching `src/` for callers was the wrong test: the writer is the Sunday board meeting,
   not the app. `.claude/workflows/sunday-board-meeting.js` lines 12 and 16 name "new parts
   → `parts_to_order`" as one of its three end-of-meeting writes. Verified live: the table
   exists with all six columns and the board-meeting export runs clean. It is empty only
   because the first meeting hasn't run — Trevor is holding it until this build merges.
   `PartsDrawer.jsx` is still the unrelated PartsBox inventory drawer.
   **Recommendation still cut them, for sequencing not deadness:** the list is empty until
   the first meeting, so building the UI now ships something that displays nothing.
   Parked as [docs/briefs/parked-parts-as-a-stuck-reason.md](../docs/briefs/parked-parts-as-a-stuck-reason.md).
   **Do not delete the table or its Supabase functions.**
5. **The Planning pile as specced matches zero jobs.** `Waiting + INC` — the only two `INC`
   jobs (393, 693) are both `Booked In`, and none of the five `Waiting` jobs carry `INC`.
   It would ship empty while the two real planning jobs sat in the schedulable lists.
   **Recommendation: pile on `INC` alone.**

---

## Decisions needed before the build starts

| # | Decision | Recommendation |
|---|---|---|
| 1 | The two parts features — cut, or build the parts-to-order list first? | **Cut.** Own feature, own brief. |
| 2 | `inferBench` backlog handling — add a positional parameter, or handle `readyToStart` at the caller? | **Caller.** Leaves the signature untouched. |
| 3 | Who runs the `days` column migration, and when? | Trevor, in the Supabase SQL editor, before merge. Only production-touching step; additive, so old clients are unaffected. |
| 4 | What defines the Planning pile — `INC` alone, or `Waiting + INC`? | **`INC` alone.** Otherwise the pile ships empty. |

Council reviews these four specifically.

---

## Why this is blast-radius work

`jobs[]` shape and the filtering behind most job-rendering components, plus the CSV import
path and a schema change on the live `jobs` table. Full protocol applies.

## Risks to watch

- **The `useJobStatusSince` ready-gate is the single most destructive failure mode here.**
  A failed read plus an eager write would stamp today's date on every job in the shop and
  destroy every real stuck age at once — irreversibly. Same class of bug as Brief D item 7's
  focus-list wipe. The verifier tests this one at runtime, not by reading the code.
- One production Supabase database, no sandbox. The `days` column migration is a real write.
- Stuck age must use local-date maths. NZ is UTC+12; `toISOString()` reads a day off for half
  of every day.
- `bench` becomes nullable. Every `BENCH_COLORS[job.bench] || BENCH_COLORS.Admin` fallback
  silently paints an unclassified job as Admin unless it's changed.

---

## Method — agent-team protocol

1. **Brief** — this file. Trevor's "yp". *(← we are here)*
2. **Council** — two independent agents, on the four decisions above.
3. **Builder** — staging branch, supervised from the main conversation.
4. **Independent verifier** — separate agent, never the builder.
5. **Browser test** — Vercel preview click-through.
6. **Merge** — Trevor's "yp".

**No commits before step 1 is approved.**

---

## Amendment — Round 3 (2026-07-27)

**Status:** Awaiting Trevor's "yp" before any commit.
**Trigger:** Independent verifier returned DO NOT SHIP against the round-2 build. All three
blockers re-checked by hand and confirmed real. One root cause: `inferBench` was taught to
return `null` for blocked jobs, but nothing else in the app was taught what a bench-less job
looks like. This finishes that job — it does not reopen the locked scope above.
**Full context:** [docs/briefs/re-fresh-brief-e-round3.md](../docs/briefs/re-fresh-brief-e-round3.md)

### Scope — locked to exactly these six items

1. Blocked job cards become **non-draggable** (no `disabled` flag currently passed to
   `useDraggable` in `JobCard.jsx`). The moment a job is unblocked, drag returns to today's
   normal behaviour — no new mode, no half-state. Add a tooltip/cursor so it's visibly
   inert, not just dead to the touch. **Decision settled 2026-07-27 (Trevor): "blocked jobs
   should never be dnd until not blocked then normal."** Do not loosen the
   `scheduled_slots.bench TEXT NOT NULL` constraint — that alternative was rejected.
2. Wire up the existing `NO_BENCH_COLORS` / `benchColors()` helper (`src/data/jobs.js:417-422`)
   at all ~17 render sites currently falling back to `BENCH_COLORS[job.bench] || BENCH_COLORS.Admin`
   (JobCard, JobsPage, CalendarGrid, JobShelf, ProjectsPage, MobileJobSheet, SplitDrawer,
   PomoDrawer, DailyLogPage, WeeklySummaryModal, CloseDayModal, JobDrawer, CatchUpInterview).
3. Stop `googleCalendar.js:178,204` writing a literal `Bench: null` line into calendar events
   — omit the line when bench is null.
4. Make Sidebar/Jobs/Shelf subtract `blockedPile()` so the old status rule
   (`useSupabase.js:36`, `deriveJobStatusFlags`) and the new one agree on jobs 393/693 —
   council amendment A, never built in round 2.
5. Move the `CI` check ahead of the status check in `blockedReason()` (`jobs.js:145`) so job
   1175 reads "waiting on the customer" instead of "on hold" once the corrected CSV is
   uploaded.
6. Tests for all five items above — current 84 tests cover none of this behaviour.

**Explicitly not touched:** `DEFAULT_BENCH_KEYWORDS`, manufacturer regex lists, `inferBench`'s
core logic, the `bench NOT NULL` schema constraint, anything in `SCHEDULER_old/` or the PDF
pipeline.

### Method — same six-step protocol as the parent brief, restarting at step 3

1. Brief *(this amendment)*
2. Council — already effectively done via the round-2 verifier's findings; no new council
   pass needed unless Trevor wants one.
3. **Builder** — staging branch `staging/job-blocking`, supervised from main conversation. ← next
4. **Independent verifier** — fresh agent, never the builder.
5. **Browser test** — Vercel preview, including uploading the corrected `jobs.csv` via 📂.
6. **Merge** — Trevor's "yp".

**No commits before Trevor approves this amendment.**
