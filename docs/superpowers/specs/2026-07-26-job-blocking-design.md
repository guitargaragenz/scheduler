# Design — Why isn't this job moving?

Date: 2026-07-26
Status: design in review, not built. Requires the full agent-team protocol before any commit.

Supersedes the first draft of this file (commit 6737454), which proposed a new `job_blocks`
table. That was wrong — see "What the first draft got wrong."

## The problem in one line

Jobs sit in the list that Trevor cannot work on, and nothing on screen says why or for how
long. He wanted "the way ClickUp handles dependencies," but rejected ClickUp itself for
density.

## What the first draft got wrong

The first draft invented a `job_blocks` table to record that a job was blocked and why.
That duplicated Multitrack. MT already carries the blocked state in its status tag, the
app already derives it in `deriveJobStatusFlags` ([src/data/jobs.js:63](../../../src/data/jobs.js)),
and a second store would have been a rival source of truth — exactly what the
"MT + Scheduler, nothing else" rule exists to prevent.

**MT owns whether a job is blocked. The app owns how that is presented and how long it has
been true.** Nothing in this design changes a job's status.

## What already exists

The six MT status tags, and what the app does with each today:

| MT status       | App behaviour today                                            |
|-----------------|----------------------------------------------------------------|
| Active          | Schedulable, main queue                                          |
| Booked In       | Schedulable, main queue                                          |
| Waiting         | + Action `INC`/`CI` → 📞 AWAITING section, locked                |
| In Transit      | 📦 IN TRANSIT section, locked                                    |
| On Hold         | 🔒 ON HOLD section, locked. + `BL=Y` + `GTS` → back to schedulable |
| To Be Invoiced  | Accepted, not schedulable                                        |

So "this job is blocked and can't be scheduled" is already built and already correct. What
is missing is why, how long, and the fact that it takes up three separate piles of screen.

## What we are deliberately not building

ClickUp's dependency feature is a **flag** plus a **Gantt chart**. We take the flag —
which MT already gives us — and permanently reject the chart. Arrows between bars on a
timeline is the wall-of-rows density that made Trevor abandon ClickUp with it fully
populated. Also out: the four formal dependency types, auto-rescheduling of calendar
slots, and real job-to-job dependency records.

## The shape

Three piles replace the current three locked Sidebar sections, split by **who owes what**:

### 1. Waiting (n) — someone else owes you

Parts on order, customer input, instruments in transit. MT statuses `Waiting` (Action
`CI`), `In Transit`, and `On Hold`.

- One Sidebar line with a live count.
- Each row shows a plain-English reason and **how long it has been stuck** ("waiting 12
  days").
- Over 14 days the count turns **red**. This is the safety net for the real failure mode:
  not "I forgot this job exists" but "that part order died three weeks ago and nobody
  chased it."

### 2. Needs a plan — you owe yourself a decision

MT status `Waiting` with Action `INC`. Trevor's own definition: *"a job I'm trying to get
my head around."*

This is not a flavour of waiting. Nobody owes Trevor anything; the next action is
**thinking, not bench work**. Chasing it is meaningless, and a 60-day-old INC job is not
automatically a failure.

- Its own Sidebar line, **no red count, no chase pressure**.
- Still carries an age, quietly.
- Anything here over 90 days surfaces at the Sunday board meeting. "Get my head around one
  job" is a genuine agenda item — one job, one question, no bench. Not nagging; the
  meeting doing its job.

Keeping INC out of Waiting is load-bearing. Mixing unchaseable items into the chase pile
makes the count and the red warning meaningless, and the count is the entire safety net.

### 3. Ready — the normal queue, unchanged

`Active`, `Booked In`, and `On Hold + BL=Y + GTS`. No change.

`To Be Invoiced` stays outside all three: it is not blocked and nobody is owed — it is an
admin task Trevor can action himself. **Open question for the build brief:** it currently
has no home of its own. Out of scope here.

### Visibility

Waiting and Needs-a-plan jobs are **hidden** from the lists that answer "what can I touch
right now" (Jobs page, Sidebar work sections, job shelf), collapsed into their two Sidebar
lines. They remain visible on **the calendar** if already scheduled into a day — hiding
work out of a day Trevor planned would be worse than the noise it removes.

This replaces today's greyed-and-locked sections. Trevor initially chose grey-out, then
reversed to hiding once the auto-return and the always-visible count made it safe.

### Reasons in plain English

The Action codes are cryptic and the status alone does not say what is pending. Mapping
shown to Trevor, not the raw codes:

| Status + Action        | Shown as                |
|------------------------|-------------------------|
| Waiting + `CI`         | waiting on the customer |
| Waiting + `INC`        | needs a plan            |
| In Transit             | in transit              |
| On Hold                | on hold                 |
| On Hold + `BL=Y` + `GTS` | (not blocked — ready) |

Parts are not a distinct MT status. A job waiting on parts shows as `On Hold` or `Waiting`.
Where a `parts_to_order` row has `needed_for_job` matching the job, the reason becomes
**"waiting on parts: <description>"** — the parts list supplies the detail MT cannot.

### Parts talk to jobs

`parts_to_order.needed_for_job` already exists but nothing reads it against a job. Two
additions:

1. A blocked job with a matching unresolved part shows that part as its reason.
2. Marking a part resolved (`markPartResolved`) raises a nudge on its job: *"Gotoh tuners
   arrived — job 1042 may be ready."* It does **not** change the job's status. Status is
   MT's, and Trevor clears it there or via the Action field in-app.

## Data — how long has this been stuck

Two different clocks, and they are not interchangeable:

- **Job age** — how long since the job came in. Multitrack's two exports each hold half of
  this and neither is complete on its own:

  | Export | Job entered date | Customer name |
  |--------|------------------|---------------|
  | Jobs by age (old input) | yes | no |
  | Med search (current weekly input) | no | yes |

  Trevor currently types the add-date in by hand each week to bridge the gap.

  **Recommended: don't solve this. Sort by job number.** Multitrack numbers jobs
  sequentially — job 1 is March 2010, job 1704 is mid-2026 — so the job number is already a
  faithful age ordering, available on every export, needing no data entry and no join.
  Anywhere this feature wants "oldest first," the job number is sufficient.

  A real date is only needed to render an absolute figure ("47 days") rather than a
  position in a queue. This design does not need one, so job age is descoped: **use the job
  number.**

  If an absolute date is wanted later, the route is to join the two exports on job number
  (jobs-by-age supplies the date, med search the customer). A job's entered date never
  changes, so first sighting wins and it is never re-read — meaning jobs-by-age would only
  need dropping when there are new jobs. The field should be editable in the Scheduler for
  corrections either way. Out of scope here.

  **A manually entered date must never be overwritten by a blank from an import.**
  `handleCsvUpload` is upsert-only, and the med search PDF has no date column, so an
  unguarded import would silently erase what Trevor typed last Sunday — the same
  blank-beats-good shape as the PDF truncation incident. The importer must leave a
  populated date alone when the incoming value is empty. This is a hard requirement, not
  a nicety.
- **Stuck age** — how long since this job entered its current blocked status. This is the
  number the red count needs, and MT does not provide it. A job entered in January that
  only went to Waiting last week must not read as six months stuck.

Stuck age needs one small table, following the `focus_list` precedent of living outside
the `jobs` array so a Multitrack import cannot wipe it:

```
job_status_since
  job_id      text primary key
  status      text not null    -- the MT status this timestamp belongs to
  action      text             -- the Action code at the time, for INC vs CI
  since       timestamptz not null
```

Written on import and on load: if a job's status differs from the stored row, replace the
row with the new status and now. If it matches, leave it. If there is no row, insert with
now — a first sighting is the best available estimate.

This is not a second source of truth for *whether* a job is blocked. It stores only a
timestamp MT does not give us.

**Write strategy: per-row upsert and delete.** Do not copy `focus_list`'s
clear-the-table-and-rewrite pattern; its snapshot-and-restore guard exists because a bad
read could destroy everything, and a per-row table has no such failure mode.

Jobs that reach done have their row deleted.

## Components

A `useJobStatusSince` hook mirroring `useFocusList`'s load / subscribe / ready structure,
plus supabase.js functions (`loadStatusSince`, `upsertStatusSince`, `clearStatusSince`,
`subscribeToStatusSince`).

Touched: `Sidebar` (collapse three sections into two lines), `JobsPage`, `JobShelf` (hide
blocked), `JobCard`, `JobDrawer`, `MobileJobSheet` (show reason and stuck age),
`CalendarGrid` (tag on scheduled blocked jobs), `PartsDrawer` (resolve nudge), and the
importer in `useJobs.js` for the status-change stamp and the blank-date guard. The build
brief confirms the exact filter sites — this design does not assume it has found them all.

## Blast radius

This changes `jobs[]` filtering across most job-rendering components and touches the CSV
import path. It is blast-radius work under CLAUDE.md. Before any commit: a brief in
`.claude/pending-brief.md` approved by Trevor, two council agents, a builder on a staging
branch, an independent verifier, and a browser test on the Vercel preview.

**Confirm before building:** where `To Be Invoiced` jobs should live.

## Follow-on work (not this spec)

1. **Steps within a job** — a short per-job stage checklist (strip → fret level → finish →
   setup) so a card shows the *next step*, not the whole job. Trevor confirmed he wants
   this. The most focus-window-shaped of the three ideas; deserves its own design.
2. **Import the closed-jobs archive.** `SCHEDULER_old/Closed Jobs.pdf` holds 1,654 closed
   jobs (numbers 1–1704, March 2010 onward) in the med-search layout. It has no dates, so
   it cannot backfill entered dates — but it is the direct answer to the upsert-only
   import leaving finished jobs open forever, which is why two closed jobs lingered.
   Feeds the unbuilt `pendingRevenueReview` UI.

   **It is not clean.** Trevor's assessment: a few empty jobs and a large number of
   cancelled ones. The Status column carries both `Closed` and `Cancelled` (e.g. job 15),
   and these must not be collapsed — `usePendingRevenueReview` already distinguishes a
   Done+invoiced call from a Cancelled one, and a cancelled job is not completed work.
   Any import needs a cleanup pass: drop empty rows, and carry Closed vs Cancelled through
   as distinct outcomes rather than "not open."
3. **Customer history.** The same archive is fifteen years of who brought what in. Showing
   a customer's previous jobs when they return is a real feature and now clearly possible.
4. **Real job-to-job links** — no evidence yet that A-before-B bites weekly on a one-bench
   workshop. Revisit only if it does.
