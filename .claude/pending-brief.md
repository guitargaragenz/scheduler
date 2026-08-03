doc_status: closed

# Workshop Projects — a planner for shop work that isn't a paying job

**Shipped 2026-08-03, merged at `947ab5a`.** 541/541 tests, verifier passed all 13 checklist
items, browser-confirmed on the Vercel preview. Everything below is the record of what was
built, not a task list.

Four decisions the builder made that the brief didn't cover, all accepted:
- Project Jobs sits outside the scrolling region, so it stays put when the project tabs overflow.
- Text fields save 0.6s after typing stops and flush on leaving the page; ticks, adds, deletes
  and reorders save immediately.
- No "started from the Daily Log" provenance line — it would have been a fifth stored field.
- A delete link for projects. The brief was silent, and a planner that only grows fills with
  dead tabs.

Checklist item 11 could not be met as written: it asked the new table's row-level security to
match `parking_lot`'s, and `parking_lot` has none. Matching therefore meant adding none, and the
reasoning is written into `docs/supabase-schema.sql` so the absence doesn't later read as an
oversight. **If RLS is ever turned on project-wide, `workshop_projects` must be included** or the
planner reads empty in production while passing locally.

Raised by Trevor on seeing it live, deliberately not built: the same planner shape would suit
**customer project jobs** too. That needs its own conversation about what planning a customer
project involves before anyone scopes it.

Noticed in passing, worth a separate tidy-up: `docs/supabase-schema.sql` has no `daily_logs`
table in it at all, though the app reads and writes one. The file has drifted from the real
database.

> Previous occupant of this file — "Tell him parts have arrived, don't make him find it" —
> shipped 2026-08-03 at `aa6dc0b`, merged `b2cf93c`, and is closed. Its record is in git
> history and in `docs/briefs/README.md`.
>
> The Parking Lot `#PL` tag — which an earlier draft of this brief listed as still open — has
> **shipped** at `dc86976`, and its brief
> ([docs/briefs/one-parking-lot-fed-from-bujo.md](../docs/briefs/one-parking-lot-fed-from-bujo.md))
> is closed. `#PRJ` therefore has nothing to wait for. Amendment F's constraint still applies to
> the tag write itself: fire-and-forget, outside the save path.

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
3. `ProjectsPage.jsx` becomes the Project Jobs tab's content. Its **computation is untouched** —
   same sections, same age bands, same action filter, same job counts.
4. **It does need one presentation edit, and the brief previously denied this.** The component
   renders its own page header (`ProjectsPage.jsx:196-227` — title, subtitle, date, count) and
   its own full-page empty state (`:172-190`). Under a tab strip both become a page inside a
   page: two headers, the word "Projects" twice. Strip the header block or fold it into the tab
   strip, and shrink the empty state to fit a tab rather than a page. Nothing else changes.
5. The first project opens by default. Which tab was last open does not need to persist.
6. The strip scrolls sideways when there are more projects than fit. It must never wrap to a
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

**Creating one:** the `+` at the end of the tab strip, or a `#PRJ` tag on a Daily Log bullet,
which opens a project with the bullet text as its title and leaves the bullet in the day.

**`#PRJ` is in scope — the dependency this brief used to hedge on is already resolved.** Council
checked: the Parking Lot `#PL` build shipped at `dc86976`, its brief is closed, and
`src/utils/parkingLotTag.js` exists with exactly the matching to copy (`#PL\b`, case-insensitive,
word boundary). Follow that file's pattern, including the constraint that governed it: the write
is **fire-and-forget, outside the Daily Log save path** — never inside `updateState`,
`performSave` or `readyRef`.

**Doing one:** out of scope. When Trevor actually wants to do a project he books it as an
Admin bench job by hand, and the project page stays as the plan behind it. No automatic job
creation, no link between the two records in this build.

## Storage

**One new table, `workshop_projects`** — council settled the shape. A row per project: title,
notes, plus `steps` and `parts` as jsonb arrays. That is not a new pattern to invent; `daily_logs`
already stores nested arrays in jsonb (`src/utils/supabase.js:1756-1757`). There is no
relationship here that splitting into two tables would serve.

Follow `loadParkingLot` / `saveParkingLot` (`src/utils/supabase.js:915-986`): fail-safe read
returning `null` rather than `[]`, and a diff-based upsert/delete rather than clear-and-reinsert.

- **A failed read must not write.** This is the exact bug Merge A of the Parking Lot brief
  existed to fix — a failed read wrote a seed list over real data.
- **Say so on screen when a read fails.** Council flagged, correctly, that the Parking Lot's
  shipped behaviour is *silent* — `applyServer` returns and there is no error message anywhere
  in `ParkingLotPage.jsx`. So this is a deliberate deviation from the precedent, not a
  copy-paste: a plain inline line of text ("Couldn't load projects — nothing has been changed"),
  no new error component. Trevor should know his planner is showing him nothing because the
  network failed, rather than because it's empty.
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
5. The Project Jobs tab shows one header, not two, and no full-page empty state inside the tab.

Merge B:
6. A new project can be created, named, and reopened after a page reload.
7. Notes, steps and parts all persist.
8. A step can be ticked and unticked; nothing anywhere shows a date or a status.
9. A failed Supabase read writes nothing and shows the inline "couldn't load" line.
10. `#PRJ` in a Daily Log bullet creates a project and the bullet stays in the day; near-miss
   tags do not fire it; the write is outside the Daily Log save path.
11. The `workshop_projects` table's row-level security and anon-key access match `parking_lot`'s.
    A misconfigured table fails silently in production and passes locally.
12. Full test suite passes.
13. Nothing in `git diff` touches the blast-radius files listed above.


## Council rulings — 2026-08-03, two independent reviewers, both "ship with changes"

Folded into the text above. Recorded here so the builder can see what changed and why.

1. **`#PRJ` is no longer conditional.** Reviewer 2 found the `#PL` dependency already
   satisfied (`dc86976`, `src/utils/parkingLotTag.js`). The old hedge would have led a builder
   to ship the fallback for no reason.
2. **Merge A does require editing `ProjectsPage.jsx` after all.** Reviewer 1 found its own page
   header and full-page empty state, which would stack under the tab strip. The old wording
   ("moved and renamed, not edited") was wrong, and the checklist would have passed a page that
   looked broken because it only checked computation.
3. **"Shows an error" had no precedent to copy.** Reviewer 1 checked: the Parking Lot fails
   silently. Kept as a deliberate improvement, now stated as such so it doesn't read as
   copy-paste or get built as something larger.
4. **One table with jsonb arrays**, matching `daily_logs` — reviewer 2 settled what the brief
   had left as a builder call.
5. **New checklist item on row-level security**, reviewer 2: a misconfigured table fails
   silently in production and passes locally.

Both reviewers confirmed the blast-radius files are untouched, and that the brief's claims about
`ProjectsPage.jsx:137` and the `App.jsx` nav wiring match the live code.
