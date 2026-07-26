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
admin task Trevor can action himself. Where it lives is settled below.

### Admin stops being the catch-all

Admin fills up because the word does two unrelated jobs: a real **bench** (invoicing,
chasing a supplier — hands, hours, bookable time) and a **dumping ground** (can't be worked
on, or couldn't classify). A job waiting on a customer is not Admin work, it is *not work*,
so it should have no bench at all.

Sub-benches were considered and rejected: they subdivide the mess rather than removing it,
and more rows is the density failure mode.

| What | Bench today | Where it goes |
|------|-------------|---------------|
| To Be Invoiced | Admin | **Admin bench** — real bookable work |
| Waiting (parts, customer) | Admin | no bench — Waiting pile |
| In Transit | Admin | no bench — Waiting pile |
| On Hold / BL | Admin | no bench — Waiting pile |
| Needs a plan (`INC`) | Admin | no bench — Needs-a-plan pile |
| Couldn't classify | Admin | **Needs a bench** — see below |

Admin then holds only genuine admin tasks, and empties on its own without any
reorganisation.

**"Needs a bench" — the unclassified pile.** `inferBench` ends in `return 'Admin'`
([src/data/jobs.js:34](../../../src/data/jobs.js)) for anything no keyword matched. Those
jobs are not Admin work; nothing recognised them. Today they are invisible among real Admin
jobs. They get their own flagged pile so Trevor can see and correct them — which also
surfaces the missing keywords. Trevor approved this. Scoped here, low priority, may ship
after the main change.

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
**"waiting on parts: <description>"** — the parts list is Scheduler-native data, so this
duplicates nothing.

### No detailed reason field — the meeting is the reason

An earlier draft proposed a free-text "why is this stuck" field in the Scheduler, then a
route to import MT's `Comments` box so the app could show the detail itself. **Both are
cut.** Trevor's own correction, and it is the right one:

> "Waiting and on hold jobs etc are sorted once a week in upcoming meetings."

Blocked jobs are already reviewed weekly, face to face. Building machinery to explain a
blocked job mid-week answers a question that is already answered on Sunday. This is the
scope line for the whole design:

- **Between meetings** the app's only job is to get blocked work *out of the way*, so
  nothing unworkable competes for attention on a Tuesday. That is the Admin routing and the
  two counted Sidebar lines.
- **At the meeting** the app's only job is to *hand over the list* — what is blocked, and
  how long it has been blocked. The detail is one click away in mTrack.

Consequently these are all out of scope: a Scheduler-side reason field, importing
`Comments`, a second PDF source, hunting for extra export columns, and the `#CM`-style
comment tagging scheme Trevor was experimenting with. The plain-English label above plus
the stuck age is the whole reason display.

Note this lands on the **Board Meeting screen already in the backlog** — the two piles are
that meeting's agenda, not a feature of their own. Worth building them with that in mind.

### Deep link to the mTrack job

Instead of copying MT's fields, link to them. mTrack job pages are addressable:

```
https://www.multitrack.co.nz/guitarg/vw_job.php?sw=1&jb=<job number>
```

Confirmed from Trevor's address bar. An "open in mTrack" link on the job card gives the
full live picture — Comments, Priority, Date Created, time and parts — in one click, always
current, duplicated nowhere. It opens in his already-signed-in browser.

Smallest item in this design and arguably the highest value per line of code.

### Parts talk to jobs

`parts_to_order.needed_for_job` already exists but nothing reads it against a job. Two
additions:

1. A blocked job with a matching unresolved part shows that part as its reason.
2. Marking a part resolved (`markPartResolved`) raises a nudge on its job: *"Gotoh tuners
   arrived — job 1042 may be ready."* It does **not** change the job's status. Status is
   MT's, and Trevor clears it there or via the Action field in-app.

## Data — how long has this been stuck

Two different clocks, and they are not interchangeable:

- **Job age** — how long since the job came in. Earlier drafts of this spec treated this as
  missing, because `FirstSeen` is always blank. **It is not missing. The `Days` column is
  already populated and already crosses the bridge.**

  ```
  Job, Customer, Mfr, Model, Status, FirstSeen, Days, Tag, Hours, Action, Desc, VB, BL, PJ
  ```

  Verified against MT: job 1582 shows `Days = 274`, and its MT `Date Created` is 25/10/2025
  — exactly 274 days before 2026-07-26.

  So job age needs no join, no manual typing, and no export change. **Use `Days`.**

  **This also kills the job-number fallback.** An earlier draft recommended sorting by job
  number as an age proxy, on the assumption that numbers are handed out in order. A handful
  of rows break that assumption — job 592 reads 2502 days against job 341's 2363, and job
  1582 reads 274 against job 1544's 242. Both look like bad data and neither is.

  The cause is **rebooking**. Trevor's description: a job waits a long time for customer
  input or parts, he gets what he needs and finishes that work, then finds something else is
  needed. Rather than close the job and open a fresh one, he rebooks it — **a new job number
  carrying the original history, including the date the instrument first arrived.** The
  result is a late job number sitting on an early date. (Closing the old job first is the
  protocol now, so this is a legacy pattern, not an ongoing one.)

  This points the opposite way from how it first looks:

  - `Days` is **not** the suspect field. It is reporting those jobs honestly — and it is
    answering the more useful question, *how long has this instrument been in the shop*,
    rather than *how long since I raised this ticket*. That is the meeting number.
  - **The job number is the suspect field** for age purposes, and is unusable as an
    ordering.

  So: sort by `Days`, always. Do not fall back to job number when a value looks odd — an
  odd-looking value is more likely to be a genuine rebooked job than an error.

  **One caveat the build must handle:** `Days` is blank on the newest jobs (1708, 1710 in
  the current file). A blank age must render as blank, never as zero — a brand-new job
  reading "0 days" and an unknown-age job reading "0 days" are different facts. Blank rows
  sort to the newest end.

  **A populated `Days` must never be overwritten by a blank from an import.**
  `handleCsvUpload` is upsert-only, so an unguarded import would silently erase a good
  value — the same blank-beats-good shape as the PDF truncation incident. The importer must
  leave a populated value alone when the incoming one is empty. Hard requirement.
- **Stuck age** — how long since this job entered its current blocked status. This is the
  number the red count needs, and MT does not provide it. A job entered in January that
  only went to Waiting last week must not read as six months stuck.

**Stuck age is the only thing in this design that needs new plumbing.** Everything else —
the Admin routing, the two piles, the deep link, job age — reads data that already exists.
It earns the table because "this has been waiting eleven weeks" is the fact that makes a
Sunday meeting actually decide something, and nothing else in the system knows it.

It needs one small table, following the `focus_list` precedent of living outside the `jobs`
array so a Multitrack import cannot wipe it:

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
blocked), `JobCard`, `JobDrawer`, `MobileJobSheet` (blocked label, stuck age, mTrack link),
`CalendarGrid` (tag on scheduled blocked jobs), `PartsDrawer` (resolve nudge), the importer
in `useJobs.js` for the status-change stamp and the blank-date guard, and `inferBench` in
`src/data/jobs.js` for the Admin routing and the unclassified flag. The build brief confirms
the exact filter sites — this design does not assume it has found them all.

The mTrack deep link is a pure URL template and touches no data.

## Blast radius

This changes `jobs[]` filtering across most job-rendering components and touches the CSV
import path. It is blast-radius work under CLAUDE.md. Before any commit: a brief in
`.claude/pending-brief.md` approved by Trevor, two council agents, a builder on a staging
branch, an independent verifier, and a browser test on the Vercel preview.

`inferBench` now also changes what bench a job gets, which affects every bench-filtered
view. That widens the blast radius rather than narrowing it — treat the Admin routing as
part of the same protocol run, not a tidy-up commit alongside it.

**Already checked:** nothing in the app sorts by job number. Three places already sort on
`days` descending — `src/data/jobs.js:235`, `JobShelf.jsx:97`, `DailyLogPage.jsx:824` — so
age ordering is wired correctly today and needs no change.

One small bug found while looking: `jobs.js:235` sorts with `b.days - a.days` and no null
guard, so the blank-`Days` rows (1708, 1710) produce `NaN` and land in an undefined
position. The other two sites use `(b.days ?? 0)` and are fine. Worth fixing in the same
pass — one-line change, same file the Admin routing already touches.

## Follow-on work (not this spec)

1. **Steps within a job** — a short per-job stage checklist (strip → fret level → finish →
   setup) so a card shows the *next step*, not the whole job. Trevor confirmed he wants
   this. The most focus-window-shaped of the three ideas; deserves its own design.
2. **The closed-jobs archive is reference data, not app data.**
   `SCHEDULER_old/Closed Jobs.pdf` holds 1,654 closed jobs (numbers 1–1704, March 2010
   onward) in the med-search layout, with no dates.

   **Trevor's decision: it is never imported into the Scheduler's job list.** It becomes a
   standalone database for board meetings, CRM and future use — fifteen years of who
   brought what in, and what was wrong with it. The Scheduler's job list stays a picture of
   live work only.

   **It needs cleaning first.** Trevor's assessment: a few empty jobs and a large number of
   cancelled ones. The Status column carries both `Closed` and `Cancelled` (e.g. job 15)
   and these must not be collapsed — a cancelled job is not completed work, a distinction
   `usePendingRevenueReview` already makes. Cleanup pass: drop empty rows, keep Closed and
   Cancelled as distinct outcomes.

   Consequence: **the archive is not the fix for jobs that vanish from Multitrack and stay
   open forever.** That problem keeps its own open decision — ask in the import preview, or
   auto-mark done but never delete. Not this spec.
3. **Real job-to-job links** — no evidence yet that A-before-B bites weekly on a one-bench
   workshop. Revisit only if it does.
