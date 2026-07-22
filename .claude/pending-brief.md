# Pending Brief — Calendar Drag Never Persists (NOT NULL `job` on state writes)

**Status:** SHIPPED 2026-07-23. Council → Builder (`29dec7c`) → Independent Verifier → live test
passed ("everything 100%") → confirmed in production Supabase: `scheduled_slots` 0 → 4 rows,
`jobs` with `scheduled = true` 0 → 3, covering both a top-level job (`1682`) and derived auto-split
cards (`1689_Luthier_0/1`). Merged to `main` with Trevor's "yp".

**Still untested against production:** un-split / re-split (`deleteChildJobs()`). Real DELETE, no
undo, never run for real. Needs its own supervised round before use.
**Session:** 2026-07-22
**Supersedes:** the auto-split regeneration brief (SHIPPED — auto-splits verified working live on
branch `fix/supabase-auto-split-regen`; that branch is unmerged and blocked on this bug).

---

## Plain-English summary

Dragging a job onto the calendar never saves. The card snaps back and you get
"⚠ Save failed — snapped back". This is not a regression from the auto-split branch — calendar
scheduling has **never** persisted since the Supabase migration. The calendar has been running
entirely on in-browser state.

## Root cause — CONFIRMED against live production Supabase, not by code review

A drag writes in two steps: the job's state row first, then the calendar slot row.

`jobsStateFieldsFor()` (`src/data/joinJobs.js:111`) builds the job half. For a **top-level** job it
returns `pickTopLevelState(job)` — an allowlist of app-owned state fields that deliberately excludes
`job` (the job number), because `job` is CSV-owned.

`batchWriteJobsState()` (`src/utils/supabase.js:794`) sends that as a PostgREST **upsert**
(`POST ... on_conflict=id`, `resolution=merge-duplicates`), not a PATCH. Postgres validates NOT NULL
on the *proposed insert row* before conflict resolution, so a row with no `job` value is rejected
outright — even though the row already exists.

Reproduced live against production, sending the exact column set a top-level drag sends for real
job `842`:

```
POST /rest/v1/jobs?on_conflict=id  →  400
{"code":"23502","message":"null value in column \"job\" of relation \"jobs\" violates not-null constraint"}
```

`persistMove()` sees the failed jobs write, returns `'reverted'`, never attempts the slots write, and
the UI rolls back. That is the exact observed behaviour.

### Why the other paths work

- **Manual split children** — the `job.parentId` branch returns the whole record, `job` included.
- **Derived auto-split cards** — the `job.isDerived` branch explicitly sets `out.job = job.job`, with
  a comment naming this exact NOT NULL constraint as the reason. The same treatment was simply never
  applied to the top-level branch.

### Corroborating live evidence (read-only)

- `scheduled_slots` — **0 rows**.
- `jobs` where `scheduled = true` — **0 rows**.
- `jobs` — 51 rows, 2 with a `parent_id` (manual splits, both persisted fine), 0 with `is_derived`.
- No RLS policies exist on any table; every column the drag writes exists; FK enforcement works;
  no stored job has a null `bench` or `hours`. All eliminated as causes.

## Scope (locked)

One change, in `jobsStateFieldsFor()`'s top-level branch only:

```js
return { ...pickTopLevelState(job), job: job.job };
```

**Do NOT add `job` to `JOBS_STATE_TOP_LEVEL_FIELDS`.** That constant is also consumed by the read
path and by `NON_MASTER_FIELDS` (joinJobs.js:49), which strips its members out of CSV-owned
`jobsMaster` rows. Adding `job` there would stop the job number being written to master rows — a
much worse bug. The fix must stay inside the write helper.

## Out of scope

- No schema changes. No migration. `job` already exists and is already populated on all 51 rows.
- No changes to `batchWriteJobsState`, `persistMove`, or the slots write path — they behave correctly
  given a valid row.
- No changes to the derived or `parentId` branches — both already correct.
- Not fixed here (separate briefs, already agreed): the missing `label` column for manual split
  children; the orphaned `is_derived` row sweep; re-expanding `jobs[]` on bench-hours change.
- The bullet-journal write firing before a failed save and not being rolled back (`useScheduler.js`
  ~line 200) is **real but separate** — log it, don't fix it here.

## Blast radius

`scheduledSlots`, `calendarSlot`, and the `jobs[]` write shape — full Agent-Team Protocol required.
Builder works on a branch off `fix/supabase-auto-split-regen` (that branch's auto-split fix is
verified working and this bug is what blocks its live test).

## Council outcome (2026-07-22)

**Council A (design) — APPROVE, no changes.** `job.job` is present at all 12 call sites (every one
passes a joined job or a `{...job, ...patch}` spread of one). `job` is in `JOB_PASSTHROUGH_FIELDS`
so it survives `toJobRow()` verbatim. `id` and `job` are the ONLY NOT NULL columns on `jobs`, so the
fix is complete. No stale-overwrite risk (`job` is immutable identity for a given `id`). Confirmed
the brief's `JOBS_STATE_TOP_LEVEL_FIELDS` warning is correct — adding it there would strip the job
number from every jobsMaster row via `NON_MASTER_FIELDS`. Extend the comment block above
`jobsStateFieldsFor()` to cover the top-level branch, not just the derived one.

**Council B (risk) — APPROVE WITH CHANGES.** Grouping traced clean: the three branches are disjoint
by `parent_id`/`is_derived` presence, so adding `job` cannot merge groups or NULL-fill. No CSV column
becomes newly clobberable. The real risk is what the fix **un-gates** — code gated on
`batchWriteJobsState` succeeding has never once run against production:

- `deleteChildJobs()` (`useJobs.js:139/223`, un-split/re-split) — real `DELETE ... WHERE parent_id`,
  cascading to `scheduled_slots`. **Highest risk, unrecoverable, no backups.**
- `deleteGcalEvents()` (`useScheduler.js:469`, drag-to-sidebar) — irreversible on the real calendar.
- `handleSync` (`useGoogleCalendar.js:189`) — historical `gcalEventIds` were never stored, so the
  first post-fix sync may duplicate rather than update.
- The 30s GCal bump poller mutates state and never persists — can silently diverge the UI from the DB.
- `subscribeToScheduledSlots` has no echo suppression; both subscriptions only propagate non-empty
  results, so clearing the last slot never propagates.

**Required change (folded into scope):** in the top-level branch, if `job.job == null`, `console.error`
and skip the write rather than send `undefined` — otherwise one malformed object aborts a whole
grouped batch with an illegible NOT NULL error.

**Must-do pre-merge safety steps (Trevor, before the live test):**
1. Export `jobs` and `scheduled_slots` to CSV from the Supabase dashboard. Only rollback that exists.
2. Run the first live drag test signed OUT of Google Calendar.
3. Do NOT touch un-split/re-split during drag verification — it gets its own supervised round.

**Logged, not fixed here (separate briefs):** GCal poller never persists bumps; slots subscription
echo/non-empty gaps; bullet-journal write firing before a failed save.

## Verifier checklist

1. Unit test in `joinJobs.test.js`: `jobsStateFieldsFor()` on a top-level job includes `job`, and
   still excludes CSV-owned fields (`customer`, `mfr`, `model`, `desc`, `bench`, `hours`, `status`).
2. `pickMasterFields()` still returns `job` on a top-level job (proves `NON_MASTER_FIELDS` untouched).
3. Existing `joinJobs.test.js` + `useScheduler` suites still green.
4. **Live**, on the Vercel preview: drag a job to a calendar slot → no "⚠ Save failed" toast → hard
   refresh → the job is still in the slot.
5. **Live DB check after step 4**: `scheduled_slots` has a row, and that job has `scheduled = true`.
   This is the check that has been missing every previous round.
6. No regression: manual splits still persist; auto-split bench cards still appear.
