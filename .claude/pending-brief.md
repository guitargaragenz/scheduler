doc_status: live

# Blocked work goes to Admin — and a board to see it all on

Raised by Trevor 2026-08-04, during the Sunday board meeting (run on a Tuesday). Two builds.
Build 1 is a correction to a rule that was changed away from what he asked for. Build 2 is the
new page that made the problem visible. **Build 1 does not depend on Build 2 and should ship
first.**

---

## How this surfaced

Trevor was looking at a mock-up of a board view and said: *"those jobs without a bench is
genuinely a bug — if you look inside the card you'll see they all have the same bench, Luthier,
but on the outside is nothing, and for the record only a handful of those jobs are luthier
based."*

He was right on every count, and the cause is two separate things stacked on each other.

**Cause 1 — blocked jobs are stripped of their bench.** `inferBench()` (`src/data/jobs.js:19`)
opens with:

```js
if (blockedPile({ status, action, backlog: backlog === true })) return null;
```

Nine live jobs come back `null`. Every one of them is On Hold, Waiting or in planning, and every
one would otherwise classify fine — 112 and 341 are Electronics by the manufacturer rules, 1706
is Setup, and so on. Nothing is unclassifiable; the bench is being thrown away.

**Cause 2 — the drawer shows Luthier for those jobs.** `JobDrawer.jsx:223` renders
`<select value={row.bench}>` against `ALL_BENCHES`, which begins `['Luthier', ...]`. A `<select>`
whose value matches no option displays the first one. So a bench-less job opens showing Luthier
— and **if Trevor saves that drawer, Luthier is written for real.** This is not cosmetic; it is
a silent mis-file waiting on any save.

**Trevor's ruling:** blocked work should carry the **Admin** bench, not a blank. That is what the
app did before Supabase and what he asked for at the time. His reasoning, in his words: *"if
something's blocked and hits a bench then that's falsely saying it's GTS."* A bench is a promise
you can work the job; Admin is the honest answer for work that is his to sort out rather than
his to build.

The current code went the other way, deliberately:

```js
// Couldn't classify it. Returns null, not 'Admin' — Admin is a real bench for
// real admin work, not the bin for "nothing else matched".
```

That comment is the record of the decision being made against the request. It needs replacing,
not just overriding, so the next session doesn't re-argue it.

---

## Build 1 — blocked work carries Admin

### In scope

1. **`inferBench()` returns `'Admin'` instead of `null`** for anything `blockedPile()` matches.
   Replace the "Returns null, not 'Admin'" comment with the reasoning above, naming Trevor and
   the date, so this doesn't get reverted by a future reader acting on the old comment.

2. **Widen the blocked set**, per Trevor 2026-08-04:
   - **`DG` (To be Diagnosed)** joins `INC` / `RS` / `RS-C` in `blockedPile()`'s planning branch.
     This is already an inconsistency, not just an addition: `ProjectsPage.jsx:6` groups
     `INC · RS · RS-C · DG` together under "Needs Thinking", but `blockedPile()` lists only the
     first three. The two screens disagree today.
   - **`VB` (Virtual Booking)** blocks. The customer still has the instrument, so the job cannot
     be worked whatever else it says. This needs `blockedPile()` to receive `vb`, which it is not
     currently passed. **Council narrowed this for you:** `JobCard.jsx:13` and `JobShelf.jsx`
     (×4) already pass the whole job object, and `vb` is already on it (`useSupabase.js:135`,
     `jobsSheet.js:118`) — those sites need no change. Only three sites build a *partial*
     object and will silently no-op if missed: `jobs.js:25` (the call **inside** `inferBench`
     itself — the easy one to overlook), `useSupabase.js:87`, and `pdfImportPlan.js:70`
     (leave that one at `vb: false`; the PDF never carries VB, same as its hardcoded action).
     Threading `vb` into `inferBench` means an 8th positional parameter — `jobs.test.js:190-205`
     calls it positionally (`inferBench(...setupJob, {})`), so check the test call sites, don't
     wait for a failure to find them.
   - **`BL` (Backlog)** blocks. **Verified no-op on today's data**: all 10 live `BL=Y` jobs are
     already blocked by their action or status, so nothing moves. It is a belt-and-braces rule.

3. **Delete `readyToStart`.** It exists solely for `On Hold + BL=Y + GTS` ("parts arrived, good
   to start"). Trevor, 2026-08-04: *"that would never happen."* It is dead logic modelling an
   impossible case, and it is the single exemption that would otherwise fight rule 2's `BL`
   clause. Remove it from `deriveJobStatusFlags()` and from `blockedPile()`, and remove the
   `readyToStart` flag from the export shape — check `board_meeting_export.mjs`, which reports it.

   **Both reviewers independently found this rule under-scoped — here is the full list.** The
   brief named three places; there are six, and `Sidebar.jsx` was not in the file list at all:
   - `src/data/jobs.js:113,212,217` — `blockedPile`'s exemption, the flag itself, and
     `schedulable` (which currently reads `schedulable || readyToStart`).
   - `src/components/Sidebar.jsx:77-79, 113, 126, 300-308` — a whole rendered **"✅ READY TO
     START"** bucket, plus `readyToStart` used to *build* the `active` and `backlog` filters.
     Deleting the flag without touching this file leaves a permanently-empty section and dead
     variables, and checklist item 5 cannot pass.
   - `scripts/board_meeting_export.mjs:123,143`.
   - `.claude/workflows/sunday-board-meeting.js:98` — unlisted anywhere in the brief. Harmless
     today (`schedulable || readyToStart` degrades cleanly) but it is a touch point.
   - Tests asserting on it: `src/data/jobs.test.js:100,104-105`,
     `src/data/jobsSheet.test.js:183-185`, `src/components/Sidebar.test.jsx:37,99`.

4. **A bench that isn't set must never look set.** In `JobDrawer.jsx`, add an explicit
   "Needs a bench" option that is selected when `row.bench` is empty, and refuse to save a row
   still on it. Ship this **even though rule 1 should mean no job reaches the drawer bench-less** —
   the display bug is independent of what fills the field, and it is the half that silently
   corrupts data. Council confirmed rule 1 does **not** close this on its own: `inferBench`'s
   final fallback (`jobs.js:60`) still returns `null` for a genuinely unclassifiable job that
   isn't blocked. Both reviewers judged the sentinel the right fix and simpler than reordering
   `ALL_BENCHES`. Concretely: add the sentinel to the options only when `!row.bench`, select it
   in `initRows()` when `job.bench` is empty, and gate `handleSave()` (`JobDrawer.jsx:139-142`)
   before it calls `onSave`.

5. **Backfill — ships as its own commit, after rule 1 is verified. Not in the same write.**
   The corrected list, re-derived against live Supabase on **2026-08-05**, is **nine** jobs:
   **1604, 842, 919, 1175, 1706, 112, 182, 341, 1448.** The brief previously listed eleven;
   **393 and 693 already carry a stored bench** and must not be touched. Re-derive again at
   build time — it moves with each import. Set them to Admin, listed in the PR body by number.

   **Why separate:** `useSupabase.js:97` reads `bench` verbatim and never re-infers it, so the
   backfill is a one-way write while the code change is a revert away. Backfilled first (or in
   the same commit), a later revert leaves nine rows reading `Admin` with nothing to tell them
   apart from real Admin work. Code change → verify on staging → then backfill.

6. `needsBench()` (`jobs.js:171`) is exported and called nowhere — council confirmed zero
   callers, and the "amber needs-a-bench chip" its comment describes does not exist. Delete it.

7. **Keep `blockedPile()` as the discriminator — do not invent a second bench value.** Council
   raised the obvious objection to Trevor's ruling: once blocked work carries Admin, a bench
   filter mixes parked jobs with real admin tasks. It does not need solving, because the app
   already answers it everywhere — `JobShelf.jsx:119,124` gate every bench count and list on
   `blockedPile(j) == null`, `JobCard.jsx:13` keys drag-disable off it, and `useSupabase.js:139`
   computes `schedulable` independently of `bench`. **Verified non-risk:** null → `'Admin'`
   makes a blocked job read as workable nowhere. Build 2's greyed Admin cards must read
   `blockedPile()` for the same reason, not the bench string.

### Out of scope

- Any change to what Multitrack owns. `status` stays read-only.
- Any change to the Action codes themselves, or to the Jobs Sheet's editable six.
- Any change to bench *keywords* or to `createSubtasks()` splitting.
- The tag/hours relationship. Recorded in `SCHEDULER-ARCHITECTURE.md` as deliberate — 29 of 36
  live jobs differ from their tag default. **Do not build anything that flags it.**

### Checklist for the verifier

1. A job that is On Hold / Waiting / `INC` / `RS` / `RS-C` / `DG` / `VB` / `BL` gets `Admin`.
2. A job that is Active or Booked In with `GTS` keeps its real inferred bench.
3. `DG` behaves identically to `INC` everywhere, including on the Projects page.
4. A `VB` job is blocked regardless of status and action.
5. `readyToStart` appears nowhere in `src/`, `scripts/` or `.claude/workflows/` — including the
   Sidebar's "✅ READY TO START" bucket, which is gone rather than left rendering empty, and the
   `active`/`backlog` filters it fed.
6. The export script runs and does not reference `readyToStart`.
7. Opening a bench-less job in the drawer shows "Needs a bench", not Luthier.
8. Saving a drawer row still on "Needs a bench" is refused, with a message that says why.
9. The backfilled jobs read `Admin` in Supabase, and the backfill is its own commit landing
   after the code change — jobs 393 and 693 were not touched.
10. `needsBench` is gone, and nothing imports it.
11. Existing splits are untouched — 1632, 1635, 1679, 1703, 1520 and 1621 keep their bench cards
    and hours exactly as they are. **This is the one that matters most:** Trevor rebuilt those
    splits by hand on 2026-08-04.
12. Scheduled slots for this week are untouched.
13. Full test suite passes. Expect edits — not just a green run — in `jobs.test.js:100,104-105`,
    `jobsSheet.test.js:183-185`, `Sidebar.test.jsx:37,99` (all assert on `readyToStart`) and
    `jobs.test.js:190-205` (positional `inferBench` calls, now an 8th parameter).
14. A blocked job carrying `Admin` still reads as blocked, not workable: it stays out of the
    Admin bench count and list on the shelf, and stays undraggable.

### Council rulings — 2026-08-05, two independent reviewers, both "ship with changes"

Folded into the text above. Recorded here so the builder can see what changed and why.

1. **Rule 3 was under-scoped, and both reviewers found it independently.** `Sidebar.jsx` was
   not in the brief's file list, yet it renders a whole "✅ READY TO START" bucket and uses the
   flag to build two more. `.claude/workflows/sunday-board-meeting.js:98` was unlisted too.
2. **Rule 5 must be its own commit, after the code change.** The backfill is a one-way write
   (`useSupabase.js:97` never re-infers `bench`); shipping it atomically with a revertible code
   change leaves nine rows unrecoverable if rule 1 is backed out.
3. **The backfill list was wrong.** Eleven names, of which 393 and 693 already have a bench.
   Corrected to nine against live data on 2026-08-05.
4. **The VB threading is smaller than "check every call site" implies** — three partial-object
   sites, not eight — but includes the call inside `inferBench` itself and an 8th positional
   parameter that `jobs.test.js` calls positionally.
5. **The Admin-collision objection was raised and answered, not waved away.** `blockedPile()`
   is already the discriminator everywhere; null → `'Admin'` makes a blocked job read as
   workable nowhere. Written in as rule 7 so Build 2 doesn't re-derive it from the bench string.
6. **Rule 4 still needed even after rule 1** — `inferBench`'s final fallback can still return
   `null` for an unclassifiable non-blocked job.

Both reviewers confirmed the brief's account of `inferBench`, `blockedPile`,
`deriveJobStatusFlags`, the `JobDrawer` `<select>` bug and the `DG`/`ProjectsPage` inconsistency
matches the live code. Live-data re-check on 2026-08-05: `DG` matches zero jobs today, `VB=Y`
matches one (1676), and all ten `BL=Y` jobs are already blocked — so rules 2's `DG` and `BL`
clauses are correct rules that move nothing today.

---

## Build 2 — a board view

**Do not start until Build 1 has merged.** The board's whole value is the bench cut, and that
reads wrong until blocked work carries Admin.

### Why Trevor wants it

In his words: *"if I fall behind on the calendar I start getting PTSD... the way that I work
successfully right up until we started doing this was with my Bullet Journal."*

The calendar asks him to promise *when*, and a missed slot reads as failure. A board asks only
what is stopping a job, and nothing on it can be late. This is an accessibility requirement
dressed as a feature request — treat it as one.

Mock-up, built from live data and reviewed with him:
https://claude.ai/code/artifact/df22fbeb-ae04-45c4-af62-44eb0f9ef113

### In scope

- **A new page.** Beside the Jobs page, not instead of it. It must be ignorable.
- **Read-only.** It renders; it does not write. No dragging in this build — dragging means
  writing to live job state and gets its own brief.
- **Built from bench cards, not jobs.** This is the point, and it is the second real gap Trevor
  found: *"when checking benches it only shows the job as the main bench so miss fretwork jobs
  under luthier."* Six live jobs span more than one bench — 1632 reads as Fretwork while hiding
  3.5h of Luthier and Setup; 1635 reads as Luthier while hiding Fretwork, Wiring and Setup. Any
  bench filter reading the parent misses all of it. 36 jobs expand to 52 cards.
- **Two cuts, one toggle:**
  - *What's stopping it* — Ready to start · On the bench · Still working it out · Waiting on a
    part · Waiting on customer · Parked. Every card lands in exactly one column (verified against
    live data).
  - *By bench* — Electronics · Fretwork · Setup · Luthier · Wiring · Admin. This is the batching
    view: *"if I'm planning to work just one bench I can't see all those things at a glance."*
    Admin cards render greyed, so a bench column reads as workable hours at a glance.
- **Hours per column**, in the column header and as a totals strip.
- **A cap on "On the bench"** — 3 or 4 cards. Without it the board becomes a second backlog and
  reproduces the crowding the calendar already causes. The cap is what makes it calming.

### Open questions for council

- Column names are Claude's guess at Trevor's vocabulary. He should rename them.
- No "Done" column is proposed — finished work leaves the board when it leaves the printout. Is
  that right, or does he want to see the week's finished work?
- Does the board replace the Sidebar's filtering, or coexist with it?

### Explicitly parked, not in Build 2

**Parallel / unattended work.** Trevor: *"some jobs work in parallel, like soak testing an
amplifier."* A soak test is elapsed time, not bench time — the same shape as the glue rule now in
CLAUDE.md. Booking it as a session is modelling it wrong. Proposed direction, for a later brief:
a passive flag on a bench card so it shows on the calendar without consuming the day's hours.
Not this build.

---

## Also parked this session (in the Supabase parking lot, needing council)

- Sidebar search doesn't match customer name
- Sidebar search doesn't match bench ("no biggie", lower priority)
- Day view card doesn't show its scheduled days

---

## Protocol

Blast-radius: `inferBench` / `blockedPile` feed the `jobs[]` shape and every screen's idea of
what is workable, and Build 1 rule 5 writes to live rows. Full agent-team protocol both builds:
brief → council ×2 → `ggnz-builder` on a staging branch → `ggnz-verifier` → browser test on the
Vercel preview → Trevor's "yp" → merge.

**Awaiting Trevor's approval.**
