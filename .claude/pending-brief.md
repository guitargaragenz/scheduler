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
     currently passed — check every call site.
   - **`BL` (Backlog)** blocks. **Verified no-op on today's data**: all 10 live `BL=Y` jobs are
     already blocked by their action or status, so nothing moves. It is a belt-and-braces rule.

3. **Delete `readyToStart`.** It exists solely for `On Hold + BL=Y + GTS` ("parts arrived, good
   to start"). Trevor, 2026-08-04: *"that would never happen."* It is dead logic modelling an
   impossible case, and it is the single exemption that would otherwise fight rule 2's `BL`
   clause. Remove it from `deriveJobStatusFlags()` and from `blockedPile()`, and remove the
   `readyToStart` flag from the export shape — check `board_meeting_export.mjs`, which reports it.

4. **A bench that isn't set must never look set.** In `JobDrawer.jsx`, add an explicit
   "Needs a bench" option that is selected when `row.bench` is empty, and refuse to save a row
   still on it. Ship this **even though rule 1 should mean no job reaches the drawer bench-less** —
   the display bug is independent of what fills the field, and it is the half that silently
   corrupts data.

5. **Backfill.** Nine live jobs currently sit at `bench = null` (393, 693, 842, 919, 1175, 1706,
   112, 182, 341, 1448, 1604 — verify the list against live data at build time, it moves). Set
   them to Admin in one write, listed in the PR body by job number.

6. `needsBench()` (`jobs.js:171`) is exported and called nowhere. With rule 1 it can never return
   true. Delete it.

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
5. `readyToStart` appears nowhere in `src/` or `scripts/`.
6. The export script runs and does not reference `readyToStart`.
7. Opening a bench-less job in the drawer shows "Needs a bench", not Luthier.
8. Saving a drawer row still on "Needs a bench" is refused, with a message that says why.
9. The backfilled jobs read `Admin` in Supabase.
10. `needsBench` is gone, and nothing imports it.
11. Existing splits are untouched — 1632, 1635, 1679, 1703, 1520 and 1621 keep their bench cards
    and hours exactly as they are. **This is the one that matters most:** Trevor rebuilt those
    splits by hand on 2026-08-04.
12. Scheduled slots for this week are untouched.
13. Full test suite passes (543 at time of writing).

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
