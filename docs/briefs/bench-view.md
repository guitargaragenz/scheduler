---
doc_status: live
---

# Bench view — background

Written 2026-08-13. The scope lock is `.claude/pending-brief.md`; **that** is what binds the
build. This page is background: where the design came from, and the marker reference.

## Where this came from

Trevor plans his real week in a bullet journal using the Alistair method — a two-page spread.
Left page: the week's jobs, grouped by bench, with day columns beside them. Right page,
written the night before: appointments, tasks, and roughly 3–5 job sessions he chooses
himself depending on how long each takes. Jobs are split out the same way the app already
splits them.

The pivot is **not** dropping planning. It is dropping the *app* deciding the schedule.
Trevor picks; the app records and remembers. Scheduling code is parked in place, switched
off and reversible — nothing is deleted.

He confirmed a photo of a real Alistair-method week page as the target layout: one list of
items with M-through-F columns, marked per day.

## Marker reference

| Marker | Meaning |
|---|---|
| `·` | booked for that day |
| `/` | worked that day |
| `>` | not worked — move to next available day |
| `×` | done |

Day columns run M T W T F S S, then a final `>` column. That last column takes `×` (finished
this week) or `>` (carry to next week).

## Reused, not rebuilt

The jobs list, the benches, job splitting, the done tick and the revenue pipeline all stay as
they are. `BenchBoardPage.jsx` and `JobShelf.jsx` already exist and are the starting point —
the builder should read them before proposing anything new.

## Split into two builds (2026-08-13)

Trevor's call, after council: the week page and the day page ship as two builds in two
sessions. The week page is independently useful and is Build 1.

### Revised order (2026-08-13): 1b, then 2

Build 1 shipped a week page that draws correctly but **cannot be filled by hand** — a job only
appears if it already had a calendar slot that week (`BenchWeekPage.jsx:93`) or already carried
a mark. Council missed this on Build 1: the brief described the layout and the markers, never
the act of putting a job on the page, and old scheduler slots made the page look populated.

Trevor's flow, stated plainly: **the week is planned on Sunday as the week ahead; each night he
picks from that week onto tomorrow's day page.** So the week page must stand alone — on Sunday
there are no day pages yet. That makes "add a job to the week" its own small build, **Build 1b**,
before the day page.

Standing council question added because of this miss: *how does a thing get created, changed and
removed?* — asked of every build.

### Build 1b — add a job to the week (scope-locked)

Per-bench dropdown. Trevor opens a bench, picks a job, it drops in as a row in that bench group
and he marks the days. Chosen over a type-to-search box (job number / manufacturer) because the
page is already grouped by bench and that is how he thinks on Sunday. No search field — two ways
to do one thing, and the list wins once it is in front of him.

### Build 2 — the day page (parked)

Tomorrow's page: appointments read-only from Google Calendar (`listEvents()` is already a pure
read), free-text tasks, and jobs. After 1b the day page picks from **what is already on the
week**, not from a fresh job-number hunt. Splits are marked done there and only there; the
final split opens the existing PomoDrawer invoice prompt. The agreed detail, parked until 1b
ships:

- **Appointments** read-only via `listEvents()`. **Tasks** free text, no status, no job links.
  **Jobs** — pick this job's existing splits onto the day. 3–5 typical, no cap.
- **Superseded 2026-08-13 by Trevor:** closing a job is the `×` in the final `>` column and
  nothing else — that is the only invoice-amount prompt, and it needs no day page or split tick.
  A day-column `×` is a plain "worked and finished that day" mark: no money question, no
  `done`, no strikethrough. No Cancel button on the amount prompt — closing is now a deliberate
  manual cross, not an automatic consequence of finishing a split, so the mistap risk that
  motivated Cancel is gone. The earlier plan (close via the last split tick, week `×` read-only)
  is dead. A marked job also stays on the week until it is closed — never dropped by a filter
  change.
- **The two pages are the Weekly Log and the Daily Log** (Trevor, 2026-08-13). The Daily Log is
  a full peer, not a read-only view of the week: he marks there as well, and adds free-text
  extra tasks the same way Admin typed rows work on the week page (Build 1c). On the nav pills
  they read **"W Log"** and **"D Log"** — the pills are too small for the full words.
- **A done split stays done.** The tick stores the split's own text at that moment, never a live
  pointer to a re-derived card. A finished week is read-only.
- **The saved log is a file, not an in-app archive.** A finished week exports as one readable
  document — plain English, paragraphs, no code or jargon; job name, status, work performed. No
  grid.
- Day picks and tasks live in their own table keyed by date. No second write path into `jobs[]`,
  `scheduledSlots` or `calendarSlot` — the existing done/revenue call is the one allowed write.
- Mobile: one page at a time, week and day switched between, never side by side.

## Build 2 — verifier checklist (2026-08-13)

Lives here, not in the scope lock, to keep that page a lock. The verifier is pointed at this
list explicitly.

1. Appointments render from `listEvents()`; no calendar write anywhere in the new code.
2. Free-text tasks save and reload; no status field, no job link.
3. Job picker offers only jobs already on the current bench week.
4. Closing a job happens **only** via the `×` in the final `>` column, and routes through
   PomoDrawer's amount prompt; no path sets `done: true` without an amount. Closing does not
   require the day page or any split tick.
5. Day-column `×` is a plain mark: no money prompt, no `done`, no strikethrough, and it does
   not fill the final column. A marked job stays on the week until it is closed — it never
   drops off because its source list or a filter changed.
6. A ticked split stores its own text; re-render or reimport doesn't unstick it.
6a. The final `>` column has its own stored value and its own tap handler — it is derived from
   the day cells today (`trailing()`, `BenchWeekPage.jsx` ~305). Strikethrough follows that
   stored value, not `doneIndex` over the day cells. `PomoDrawer` is unchanged — no Cancel.
6b. Headings and titles say "Weekly Log" / "Daily Log"; nav pills say "W Log" / "D Log".
7. Day picks and tasks live in a new date-keyed table; no writes to `scheduledSlots` or
   `calendarSlot`.
8. `AUTO_BUMP_ENABLED` still `false`.
9. Mobile shows one page at a time.
10. Full test suite passes; new tests cover items 4, 5 and 6.

## Council record — 2026-08-13, two independent reviewers

Both returned **GO WITH CHANGES**. Nothing blocking. What they found, and what was done:

1. **The calendar hook is not read-only today.** `useGoogleCalendar.js` runs a 30-second poll
   that reads the calendar and then *writes* — bumping conflicting jobs to new slots via
   `persistMove`. It starts as soon as `signedIn` is true. "The app never decides a schedule"
   breaks on day one unless that poll is disabled. → Now a binding rule in the scope lock.
2. **Marker state had nowhere to live.** No existing table or column fits. Overloading
   `jobs[]` or `scheduledSlots` would collide with the parked scheduler and the GCal sync.
   → Own table, keyed by job and date. Binding rule.
3. **Marker granularity.** Reviewer 1 argued marks should attach to each bench card, since
   `joinJobs.js` gives a job several split cards per week. **Trevor overruled this:** the week
   page is one row per job. Splits are marked on the day page only; the week row shows `/`
   while parts are worked and `×` on the day the final part lands. Recorded because the
   council reasoning reads convincingly and should not be re-litigated next session.
4. **The glue rule is unenforceable.** Nothing in the splits data flags a glue step, so the
   app cannot police the 12-hour gap. Trevor maintains it himself. → Stated plainly in the
   scope lock so no builder invents a fake check.
5. **Day-page picks could balloon into new persisted state.** → Build 2 must say where they
   live before that build starts.
6. **Blast radius is low.** (Build 1) `BenchBoardPage.jsx` writes nothing today; mobile single-page is
   an existing pattern (`MobileJobSheet.jsx`, `JobsPage.jsx`, `DailyLogPage.jsx`), not new
   architecture. Backing the whole thing out is deleting or hiding a route.

## Council record — Build 2 (the day page), 2026-08-13, two independent reviewers

Both returned **GO WITH CHANGES**. Nothing blocking. What they found, and Trevor's calls:

1. **Marking done is a two-step flow, not a silent write.** `handleMarkDone(job, amount)`
   (`src/hooks/useJobs.js:326`) is only ever reached via `PomoDrawer`, which asks for the
   invoice amount (`src/App.jsx:344-346, 366-368`). A builder who missed that would either
   write `done: true` with no figure — a silent revenue bug the code's own comments warn
   against — or build a second invoicing UI. → Scope lock now names PomoDrawer explicitly.
2. **The "nothing is written to `jobs[]`" rule contradicted the feature.** `handleMarkDone`
   writes `done: true` into `jobs[]` by design. The rule means *no second parallel write
   path*, not *never touch it*. → Reworded in the scope lock.
3. **Auto-derived split ids can rot.** Auto-split cards get ids like `1635-S`, regenerated
   each render from the job's current description text (`src/data/jobs.js:275-277`,
   `src/data/joinJobs.js:387-393`). A Multitrack reimport that changes the wording can make a
   saved day page point at a split that no longer exists. Manual (stored) splits are safe.
   → **Trevor's call:** a done split stays done. The day page stores the split's own text at
   tick time, never a live pointer. A finished week is read-only.
4. **"Searchable" was doing quiet work** — it read as an in-app history/search screen nobody
   had scoped. → **Trevor's call:** it is an exported readable document, not an in-app
   archive; an in-app log would bog the page down over time. Plain English, proper paragraphs,
   job name / status / work performed, no grid.
5. **The calendar is genuinely read-only now.** `AUTO_BUMP_ENABLED = false`
   (`src/hooks/useGoogleCalendar.js:26`); the 30s poll still runs but only reads.
6. **`bench_week_marks` is already its own table** (`src/utils/supabase.js:1849` on). A second
   table keyed by date follows the same pattern and collides with nothing.
7. **The final `>` column is not a control today — it is a mirror of the day cells.** Both
   reviewers landed on this as the one real blocker. `trailing()` (`BenchWeekPage.jsx` ~305)
   scans the day cells for a `'cross'`; any day `×` makes the final column show `×` and strikes
   the whole row (`doneIndex`, ~684-685, 700-736). The trailing div is commented "derived, never
   tapped" (~729) and has no click handler; day cells cycle through `CYCLE`
   (`BenchWeekPage.jsx:42`). So Build 2 must pull the two apart: the final column gets its own
   stored value and a real tap target routing to `PomoDrawer` → `handleMarkDone`, and
   strikethrough follows that value. This is a change to Build 1's shipped behaviour, not just
   new Build 2 code.
8. **Already working, don't rebuild it:** a marked or hand-added row survives source-list and
   filter changes (`weekRows()` ~233-237); only `job.done` drops a row (~222).
