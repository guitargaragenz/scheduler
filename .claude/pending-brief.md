doc_status: live

# Pending Brief — Workshop Projects: a planner for non-paying shop work

**Status: drafted 2026-08-03, awaiting Trevor's approval ("yp"). Not yet reviewed by council.**

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

### Merge A — free up the name

1. Rename the existing page to **Project Jobs** (component file, nav label, page heading).
   The word "Jobs" is the honest distinguisher: those are jobs, these won't be.
2. Take **Project Jobs off the top nav** and reach it from Settings instead.

   **Judgement call, flag for Trevor:** Settings is a modal (`SettingsModal.jsx`), not a page.
   Rendering a full-width aged chart inside a modal would cramp it. So Project Jobs **stays a
   full page** and keeps its existing render path — only the entry point moves, from a top-nav
   button to a link inside the Settings modal. If Trevor meant it literally inside the modal,
   say so and this changes.
3. No change to what the page shows, filters, or computes. Rename and re-route only.

### Merge B — the Workshop Projects planner

A new page. Visual reference: the mockup approved 2026-08-03
(`claude.ai/code/artifact/d6e561a7-89f3-4517-b6ab-8896f96fa2ba`).

**Layout:** list of projects on the left, the selected one on the right.

**A project holds exactly four things:**

- **Title** — one line.
- **Notes** — free text. The brain-dump. This is the point of the feature.
- **Steps** — a plain checklist. Add, tick, reorder. No dates, no assignment.
- **Parts** — description plus quantity. Free text, deliberately *not* wired to PartsBox or
  Parts to Order in this build.

**What a project deliberately does NOT have:** status, due date, priority, percentage
complete, or any notion of "overdue". Trevor asked for a planner, not a tracker. Anything that
can nag him is out of scope by design — it's the thing that would make him stop opening it.

**Creating one:** a "+ New" button on the page, and — if and only if Merge B of the Parking
Lot brief has shipped first — a `#PRJ` tag on a Daily Log bullet that opens a project with the
bullet text as its title. The `#PRJ` half **depends on `#PL` landing first** and reuses its
tag-matching (case-insensitive, word-boundary, must not fire on near-misses). If `#PL` has not
shipped when this is built, ship the "+ New" button alone and leave `#PRJ` for a follow-up.

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
- **Any change to what the existing Project Jobs page computes or displays.** Merge A is a
  rename and a re-route.
- **Linking projects to jobs, parts inventory, the calendar, or the board.**
- **Status, dates, reminders, or notifications on projects.** See above — this is the design.
- **The Parking Lot `#PL` build.** Separate brief, still live, unaffected by this one.

## Checklist for the verifier

Merge A:
1. Top nav no longer has a "Projects" button.
2. Project Jobs is reachable from the Settings modal and renders full-page as before.
3. The page's sections, age bands, action filter and job counts are unchanged from `5c89d26`.

Merge B:
4. A new project can be created, named, and reopened after a page reload.
5. Notes, steps and parts all persist.
6. A step can be ticked and unticked; nothing anywhere shows a date or a status.
7. A failed Supabase read shows an error and does not write.
8. If `#PRJ` is in the build: `#PRJ` in a Daily Log bullet creates a project and the bullet
   stays in the day; near-miss tags do not fire it.
9. Full test suite passes.
10. Nothing in `git diff` touches the blast-radius files listed above.

## Open question for Trevor

Only one, and it doesn't block approval — the Settings entry point in Merge A, item 2. Full
page reached from Settings (recommended), or literally inside the modal?
