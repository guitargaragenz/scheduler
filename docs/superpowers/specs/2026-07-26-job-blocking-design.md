# Design — "Waiting on" job blocking

Date: 2026-07-26
Status: design approved, not built. Requires the full agent-team protocol before any commit.

## The problem in one line

Jobs sit in the list that Trevor cannot actually work on, and nothing on screen says
why. He wanted "the way ClickUp handles dependencies," but rejected ClickUp itself for
density.

## What we are deliberately not building

ClickUp's dependency feature is two halves: a **flag** ("this is blocked by that") and a
**Gantt chart** (arrows between bars, dates cascading downstream). We take the flag. The
chart is the exact wall-of-rows density that made Trevor abandon ClickUp with it fully
populated, so it is out of scope permanently, not deferred.

Also explicitly out of scope:

- Finish-to-Finish / Start-to-Start / Start-to-Finish dependency types. Only "B can't
  happen until A is sorted" is real here.
- Auto-rescheduling of calendar slots when a block clears. Blocks change what is
  *visible*; they never move a `scheduledSlot`.
- Steps-within-a-job checklists. Trevor wants these, but they are a separate feature on a
  separate screen (see Follow-on work).
- True job-to-job dependency records. Covered here only as free text (see Reasons).

## The shape

A job can be **blocked**. A blocked job carries a reason and an optional note, disappears
from the lists that answer "what do I work on now," and returns by itself when the block
clears.

### Reasons

Four, fixed:

| Reason     | Meaning                                   | Auto-clears?                        |
|------------|-------------------------------------------|-------------------------------------|
| `parts`    | Waiting on an ordered part                | Yes — when the linked part resolves |
| `customer` | Waiting on approval, an answer, a drop-off| No — manual                         |
| `job`      | Waiting on another job to finish          | No — manual, free text              |
| `other`    | Anything else                             | No — manual                         |

Every reason carries an optional free-text note ("Gotoh tuners, ordered the 14th").

`job` is deliberately *not* a real link to another job record. On a one-bench workshop
true A-before-B is rare, and making it a real relationship changes the shape of a job —
blast-radius, for a handful of jobs a year. It is a typed note. If Trevor finds himself
writing it weekly, that is the evidence for promoting it later.

### Visibility

Blocked jobs are **hidden** from every list that answers "what can I touch right now":

- Jobs page
- Sidebar work sections
- Job shelf

They remain visible, with the waiting tag shown, in:

- **The calendar.** If a job is already scheduled into a day it stays in that day. Hiding
  work out of a day Trevor planned would be worse than the noise it removes.
- **One new Sidebar entry: `Waiting (n)`.** Clicking it lists the blocked jobs with their
  reason, note, and how long they have been blocked.

The count is the safety net that makes hiding safe. It is always on screen.

### Staleness

A block older than **14 days** turns the `Waiting (n)` count red. The real failure mode is
not "I forgot this job exists" — it is "that part order died three weeks ago and nobody
chased it." The red count is the chase prompt.

### Scheduling a blocked job

Allowed, with a warning. Dropping a blocked job into a day shows a non-blocking nudge
naming the reason ("waiting: Gotoh tuners"). Trevor books Wednesday knowing the part lands
Tuesday; refusing outright would fight the way he actually works.

### Clearing a block

Three ways, all of which return the job to the normal lists with no further action:

1. **Manual** — unblock toggle on the job drawer / mobile sheet, and from the Waiting list.
2. **Part arrives** — `markPartResolved()` on a part whose `needed_for_job` matches the
   blocked job clears that job's `parts` block.
3. **Job closes** — a job that reaches done has its block row deleted, so a reopened job
   never comes back mysteriously blocked.

## Data

A new Supabase table, `job_blocks`, following the `focus_list` precedent — kept out of the
`jobs` array so it never touches `jobs[]` shape or the CSV drift-safety check.

```
job_blocks
  id          text primary key
  job_id      text not null unique
  reason      text not null      -- parts | customer | job | other
  note        text
  part_id     text               -- nullable, links to parts_to_order.id
  created_at  timestamptz not null
```

`job_id` is plain text, not a foreign key, matching the reasoning already documented on
`parts_to_order.needed_for_job`: a block must not fail to write because the job row was
never created or has since gone.

**Critical: this must survive a Multitrack import.** `handleCsvUpload` in
`src/hooks/useJobs.js:267` is upsert-only on `jobs`. Because blocks live in their own
table keyed by job id, an import cannot wipe them. This is the whole reason for not
putting a `blocked` field on the job record.

**Write strategy: per-row insert / update / delete.** Do *not* copy `focus_list`'s
clear-the-table-and-rewrite approach. That pattern needed an elaborate snapshot-and-restore
guard precisely because a bad read could destroy everything; a per-row table has no such
failure mode and should not inherit the complexity.

## Components

A new `useJobBlocks` hook mirroring `useFocusList`'s load / subscribe / ready structure,
plus supabase.js functions (`loadJobBlocks`, `setJobBlock`, `clearJobBlock`,
`subscribeToJobBlocks`).

Touched: `JobsPage`, `Sidebar`, `JobShelf` (filter out blocked), `JobCard`, `JobDrawer`,
`MobileJobSheet` (set/clear the block), `CalendarGrid` (show the tag), and the parts
resolve path in `PartsDrawer`. The build brief confirms the exact filter sites — this
design does not assume it has found all of them.

## Blast radius

This touches `jobs[]` filtering across most job-rendering components and adds a table. It
is blast-radius work under CLAUDE.md. Before any commit it needs: a brief in
`.claude/pending-brief.md` approved by Trevor, two council agents, a builder on a staging
branch, an independent verifier, and a browser test on the Vercel preview.

## Follow-on work (not this spec)

1. **Steps within a job** — a short per-job stage checklist (strip → fret level → finish →
   setup) so a card shows the *next step*, not the whole job. Trevor confirmed he wants
   this. It is the most focus-window-shaped of the three ideas and deserves its own design.
2. **Real job-to-job links** — only if the `job` reason gets used weekly.
