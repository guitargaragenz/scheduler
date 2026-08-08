---
doc_status: live
---

# Revenue Build 3 — council record (2026-08-08)

Two independent `ggnz-council` reviewers, protocol step 2. Background for the scope lock at
`.claude/pending-brief.md` — the scope lock is what you build from; this is the reasoning.

## Verdicts

- **Reviewer A:** approve with two named changes.
- **Reviewer B:** send back — one named fix required first.

Both landed on the same blocker independently. Verified against the live code before the
scope lock was amended.

## The blocker — error and empty look identical

`loadCompletedJobs()` (`src/utils/supabase.js:1982-1985`) catches its own errors and returns
`{ records: [], doneJobIds: [] }` — byte-for-byte what a genuinely empty week returns. The
scope lock's own rule ("a failed read must not look like an empty week") therefore cannot be
met without changing that function, which the "don't change Builds 1 or 2" line forbade.
A direct contradiction. Resolved by an explicit carve-out in the scope lock.

Reviewer B's framing: it's the exact bug this build exists to end, moved one layer down.

## The type bug

`:1981` returns `doneJobIds: (data||[]).map(d => d.job_id)` raw from the database.
`handleMarkDone` compares against `String(...)` ids. If `job_id` arrives as a number the
duplicate check misses on type — the database still refuses the write, so no double-row, but
Trevor gets the "already recorded" toast this build is meant to stop. Fix: `String(d.job_id)`.
Same applies to `id: row.job_id` at `:1971`.

## Where the load belongs

Reviewer A: `useJobs.js`, not `App.jsx`. It already owns `completedJobs`/`setCompletedJobs`
and every write to that state. Loading in `App.jsx` splits ownership across two files for no
gain. Accepted.

## Week-key staleness

`recentWeekKeys()` (`src/utils/calendar.js:48-57`) is computed once from `new Date()`. Wired
into a mount-only effect, a tab left open across Sunday midnight keeps reading last week's
rows forever while `currentWeekKey` moves on — total reads $0. Both reviewers flagged it.
Recompute as the week turns, or state it as an accepted limitation. Not silently.

## Row shape

`loadCompletedJobs` drops `bench`, which `handleMarkDone` sets. Nothing downstream reads
`bench` off a completed record — cosmetic, left alone. Every other field matches.

## Correction to the brief's own reasoning

The scope lock claimed the in-memory list is what blocks a double-tick. It isn't — the
refusal comes from the database round-trip in `appendCompletedJob` → `findCompletedJobRow`
(`src/utils/supabase.js:1876-1889`). Filling the list won't make a legitimate new tick fail
(no risk), but it isn't by itself what stops the toast either. The scope lock has been
corrected.

## Extra blast radius for the browser test

`CloseDayModal.jsx:235` and `CatchUpInterview.jsx:79` both do
`completedJobs.find(r => r.id === ...)` to decide whether a stale daily-log bullet already has
a paid/invoiced record. Today that always returns null after a reload, because the list starts
empty. Once the list is real they will start finding matches for jobs completed in an earlier
session. Probably a genuine fix — **but it is a behaviour change past "the number is right",
so check both screens in the browser test rather than assuming.**

## Standing rules

Never-delete rule already respected: no `.delete()`, `appendCompletedJob` is append-only.
Glue rule not relevant. Blast radius is `utils/supabase.js` only — does not touch
`scheduledSlots`, `calendarSlot`, `useGoogleCalendar.js` or the `jobs[]` shape.
