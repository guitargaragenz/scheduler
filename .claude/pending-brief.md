doc_status: live

# Pending Brief — Workshop Projects: a planner for non-paying shop work

**Status: approved by Trevor ("yp", 2026-08-03), including the tab-strip shape. Next step is
council — two `ggnz-council` reviewers — before `ggnz-builder` starts.**

> Previous occupant of this file — "Tell him parts have arrived, don't make him find it" —
> shipped 2026-08-03 at `aa6dc0b`, merged `b2cf93c`, and is closed. Its record is in git
> history and in `docs/briefs/README.md`.
>
> Still open and still approved, untouched by this brief:
> **Merge B (the `#PL` tag)** in
> [docs/briefs/one-parking-lot-fed-from-bujo.md](../docs/briefs/one-parking-lot-fed-from-bujo.md).
> Council amendment F remains binding there.

## The problem, in Trevor's words

> "I have a lot of jobs that I want to do in the workshop that aren't paying work. Things like
> maintenance work such as making shelves, rearranging the cutting room and similar."

And, on what he wants it to be:

> "It's not a tracker as such, it's more of a planner."

Today that work has nowhere to live. The three candidate homes all fail for the same reason —
none of them is a place to *think*:

- **The Daily Log** holds it for one day, then it's gone from view.
- **The Parking Lot** is a flat idea list. Shelving isn't an idea, it's a job with steps and
  parts, and a flat list can't hold that.
- **A job on the board** is bookable work, which is the opposite of a planner — it demands a
  date before he's finished thinking.

The consequence is that shop work gets re-thought from scratch every time it surfaces, and
mostly doesn't get done.

## The name collision — checked against the code 2026-08-03, not from memory

`src/components/ProjectsPage.jsx` already owns the word "Projects", and the top nav already has
a **Projects** button (`src/App.jsx`, `selectPage('projects')`).

**What that page actually is:** it filters `jobs.filter(j => j.project && !j.parentId && !j.done)`
(`ProjectsPage.jsx:137`) — jobs Multitrack has flagged as projects — and groups them into three
age-banded sections by what they're waiting on: Needs Input (CI, WP), Needs Thinking (INC, RS,
RS-C, DG), Ready to Schedule (GTS, FB). It is a **customer multi-job overview**, aged, with an
action filter.

So there are two different things wanting one word:

| | What it is | Whose work |
|---|---|---|
| Existing Projects page | Multitrack-flagged customer jobs, by action age | Paying |
| Workshop Projects (this brief) | Shelving, cutting room, jigs | Not paying |

Both are legitimate. They cannot share a name in the nav.

## Scope — two merges

### Merge A — two tabs behind one nav button

**Decided by Trevor 2026-08-03, replacing an earlier "move it into Settings" plan.** Settings
is a modal (`SettingsModal.jsx`) and would have cramped a full-width aged chart, and burying it
there meant hunting for it. Tabs are better: one nav button, both views behind it.

1. The **Projects** top-nav button stays exactly where it is. It now opens a page with a
   browser-style tab strip across the top — **one tab per workshop project**, in the order
   they were created, plus a **`+`** at the end of the projects that starts a new one.
2. **Project Jobs** is a further tab, pinned at the **far right** of the strip and separated
   from the projects by a divider, so it reads as a different kind of thing. "Jobs" is the
   honest distinguisher: those are customer jobs, the planner's aren't.
3. `ProjectsPage.jsx` becomes the Project Jobs tab's content, **unchanged** — same sections,
   same age bands, same action filter, same computation. It is moved and renamed, not edited.
4. The first project opens by default. Which tab was last open does not need to persist.
5. The strip scrolls sideways when there are more projects than fit. It must never wrap to a
   second row and must never make the page itself scroll sideways.

### Merge B — the Workshop Projects planner

A new page. Visual reference: the mockup approved 2026-08-03
(`claude.ai/code/artifact/d6e561a7-89f3-4517-b6ab-8896f96fa2ba`).

**Layout:** no list. The open project fills the page, and you move between projects with the
tab strip described in Merge A.

**A project holds exactly four things:**

- **Title** — one line.
- **Notes** — free text. The brain-dump. This is the point of the feature.
- **Steps** — a plain checklist. Add, tick, reorder. No dates, no assignment.
- **Parts** — description plus quantity. Free text, deliberately *not* wired to PartsBox or
  Parts to Order in this build.

**What a project deliberately does NOT have:** status, due date, priority, percentage
complete, or any notion of "overdue". Trevor asked for a planner, not a tracker. Anything that
can nag him is out of scope by design — it's the thing that would make him stop opening it.

**Creating one:** the `+` at the end of the tab strip, and — if and only if Merge B of the Parking
Lot brief has shipped first — a `#PRJ` tag on a Daily Log bullet that opens a project with the
bullet text as its title. The `#PRJ` half **depends on `#PL` landing first** and reuses its
tag-matching (case-insensitive, word-boundary, must not fire on near-misses). If `#PL` has not
shipped when this is built, ship the `+` tab alone and leave `#PRJ` for a follow-up.

**Doing one:** out of scope. When Trevor actually wants to do a project he books it as an
Admin bench job by hand, and the project page stays as the plan behind it. No automatic job
creation, no link between the two records in this build.

## Storage

A new Supabase table, following the pattern the Parking Lot already established
(`src/utils/supabase.js`). Two tables or one with a nested list is a builder call, but:

- Reads must **fail safe**. This is the exact bug Merge A of the Parking Lot brief existed to
  fix: a failed read wrote a seed list over real data. A failed read here shows an error and
  writes nothing.
- No seed data, no starter examples. An empty planner is empty.

## Not in scope — say no to these

- **Any change to `scheduledSlots`, `calendarSlot`, the `jobs[]` shape, `useGoogleCalendar.js`,
  `useSupabase.js` or `src/utils/supabase.js`'s existing functions.** Nothing here needs them.
  New table access is additive only.
- **Any change to what the existing Project Jobs page computes or displays.** Merge A renames
  it and moves it into a tab. It does not edit it.
- **Linking projects to jobs, parts inventory, the calendar, or the board.**
- **Status, dates, reminders, or notifications on projects.** See above — this is the design.
- **The Parking Lot `#PL` build.** Separate brief, still live, unaffected by this one.

## Checklist for the verifier

Merge A:
1. The Projects nav button opens a page with a tab strip: one tab per project, a `+` after
   them, and Project Jobs pinned at the far right.
2. Clicking between tabs switches cleanly, and the first project is open on arrival.
3. With enough projects to overflow, the strip scrolls sideways — it does not wrap, and the
   page body does not scroll sideways.
4. The Project Jobs tab's sections, age bands, action filter and job counts are unchanged
   from `5c89d26`.

Merge B:
5. A new project can be created, named, and reopened after a page reload.
6. Notes, steps and parts all persist.
7. A step can be ticked and unticked; nothing anywhere shows a date or a status.
8. A failed Supabase read shows an error and does not write.
9. If `#PRJ` is in the build: `#PRJ` in a Daily Log bullet creates a project and the bullet
   stays in the day; near-miss tags do not fire it.
10. Full test suite passes.
11. Nothing in `git diff` touches the blast-radius files listed above.

