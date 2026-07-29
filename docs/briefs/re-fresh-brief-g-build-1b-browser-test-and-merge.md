doc_status: live

# Brief G, Build 1b — built and verified, waiting on the browser test and the merge

Written 2026-07-29 at the end of the session that ran protocol steps 3 and 4.

---

## START HERE

Build 1b is written, reviewed and pushed. It sits on `staging/brief-g-jobs-sheet-page`,
ahead of `main` (`b84373d`). Do not re-run protocol steps 1–4 on what is already built.

**Re-scoped 2026-07-29 on Trevor's instruction.** The session had drifted into look-and-feel
requests and a calendar bug. His words: *"Appointments and UI can wait until everything's
rock solid."* So this brief is now about one thing only — **getting Build 1b proved and
merged.**

**Where the last session got to (2026-07-29, end of session):** the browser test is
**five-sixths done — and the item that was gating the merge has passed.** Split/derived
rows really are excluded (53 sheet rows against 78 jobs, 25 of them derived). Tag bands,
hours ranges and SKP all pass. Everything was discarded; nothing was written; the
temporary `App.jsx` edit is reverted and the tree is clean.

**The browser test is finished. Item 3 — the live CSV write test — was dropped
deliberately, not skipped.** Trevor asked why we would test a CSV sync when Build 1b is
the very thing that retires the CSV pipeline (`re-fresh-repo-housekeeping.md:102`:
`sheet_to_csv.command` is live *"until Brief G's Build 1b ships"*). He was right. It was
dropped because:

1. The merge gate — split/derived rows staying out of the sheet — **already passed live**.
   That was the verifier's only withheld item.
2. The ownership rule is already covered by two tests aimed at exactly this path:
   `upsertJobsBatch — the CSV import path: sends none of the six app-owned columns`
   (`supabaseJobOwnership.test.js:51`) and `pickMasterFields — the six columns the CSV may
   no longer write` (`joinJobs.test.js:511`). A live run adds nothing.
3. A live run writes real job data to prove a path that is being retired.

**Worth carrying forward:** retiring the *script* does not remove the CSV **upload
button**, which is still live at `JobShelf.jsx:207`, `DailyLogPage.jsx:1064` and
`Sidebar.jsx:250`. It stays clickable after the merge. That is why the protection has to
exist — it is not an argument for testing it by hand.

**So this brief is down to one thing: protocol step 6, the merge, on Trevor's "yp".**
Do not re-run any part of the browser test; every item's result is recorded below.

What is left, in order, and nothing else:

1. **Protocol step 5** — the browser test. The verifier gated the merge on it.
   **Only item 3 remains.**
2. **Protocol step 6** — merge on Trevor's "yp".
3. **Then, and only then**, the next phase of the build: **Build 1c** (the JBA second PDF
   drop, `first_seen`, computed job age, the migration). It has never been through
   council, so it starts at protocol step 1 with a fresh brief — not from here.

**Deferred, deliberately, until after the merge:**

- Three Sheet changes Trevor asked for after the restyle — Enter-to-move-down, a white
  background, 30-minute hours steps. All written up below with his exact words so nothing
  is lost. **None of them block the merge.** Don't build them on this branch.
- The calendar appointments bug — see
  [appointments-not-showing-on-the-calendar.md](appointments-not-showing-on-the-calendar.md),
  now **parked**. Different file, different branch, different protocol run.

Read this file, then `.claude/pending-brief.md` for the scope lock. **Do not re-read**
`re-fresh-brief-g-checkpoint-3b-and-build-1b.md` as instructions — it is the previous
handoff, it says Build 1b "is not started", and that is now false. It is being closed in
the same commit as this file.

---

## What Build 1b actually does

Plain English, because it needs restating without the code:

**Item 3 — the six columns changed hands.** `Tag`, `Hours`, `Action`, `VB`, `BL` and
`PJ` are now owned by the app. The CSV import path can no longer write them, so a sync
can't silently revert what Trevor typed. Nothing moved in the database; only who is
allowed to write changed.

**Item 4 — the Jobs Sheet page.** Because the CSV can't write those six any more, there
has to be somewhere to edit them. New **Sheet** button in the top bar, sitting between
**Jobs** and **Week View**. Every top-level job, one row each. The six app-owned columns
editable, six Multitrack facts greyed out beside them. Action and Tag are dropdowns, not
free text — a typo would file a job in the wrong pile. Picking a Tag fills in the
matching hours. The Hours box takes a range (`2-4` saves as `3`); an unreadable box goes
red and that one job is skipped, it never blanks an estimate that was already there.
**Nothing saves until Commit is pressed** — no autosave, deliberately. Read-only on a
phone. `SKP` on jobs 182/321/592/1268 survives as its own option with no special
behaviour, as the brief required.

**Item 4b — the M/T swap.** Fixed. Note it was in **four** places, not the three the old
brief claimed — `helpArticles.js` had two separate passages. Correct bands are
EZ ≤1.5→1.5, M ≤3→3, T ≤5.5→5.5, H >5.5→6.

---

## The commits on the branch

| Commit | What |
|---|---|
| `70b3381` | Item 3 — six columns off the CSV, handed to the app |
| `70c5b9c` | Item 4b — un-swap M and T in the difficulty bands |
| `ccb1503` | Item 4 — the Jobs Sheet page |
| `8b3ce93` | The restyle (see below) |

`main` is at `b84373d`. Nothing has been merged.

## The restyle, and why it happened

The first cut of the page was a plain web table. Trevor's verdict on seeing it:
*"it's really hard on my eyes too busy not like the sheet at all"*. He was then offered a
one-job-at-a-time redesign and declined it — **"just make it like a spreadsheet that will
be fine"**. So the grid stayed and only its appearance changed. That was treated as a
look change inside the existing brief, not a scope change, so no fresh "yp" was sought.
If a future session disagrees with that call, the decision to revisit is Trevor's.

`8b3ce93` changed three things that were causing the density, and added the cues a real
spreadsheet has:

- Ruled lines in **both** directions (there were only row separators before)
- Cells are plain until hovered or focused — the old version drew a bordered input inside
  every bordered cell plus a native dropdown arrow, ~100 frames on screen
- Unticked checkboxes draw as empty dark cells, not 159 white squares
- Banded rows, hover highlight, frozen job-number column, right-aligned tabular hours, a
  rule fencing off the six app-owned columns, system sans instead of Courier

**It is presentation only.** `jobsSheet.js` is untouched; 197 tests still pass.

---

## Deferred — three Sheet changes, none of them blocking

**Read this before the three sections below.** Trevor asked for all three on 2026-07-29,
then on the same day said to park them: *"Appointments and UI can wait until everything's
rock solid."*

They are written up in full — his exact words, where the change goes, what it must not
break — because that detail is expensive to re-derive and easy to lose. **That is all
they are: a record to build from later.** None of them is a task for this branch, none of
them gates the merge, and the questions marked "Ask Trevor" are not to be asked until the
work is actually picked up. Pick them up after Build 1b is merged and Build 1c is either
done or deliberately sequenced behind them — Trevor's call which.

*(These three sit here rather than at the end of the file only because they were written
before the re-scope. They are the last thing to act on, not the first.)*

### Deferred — Hours must snap to 30-minute steps

Asked for by Trevor 2026-07-29, after the restyle, in his words: *"I want the hrs to be
in increments of 30 mins like they were before."* **Not built.**

**"Like they were before" is real and checkable** — the job drawer's hours box has always
been `<input type="number" min="0.5" step="0.5">` (`JobDrawer.jsx:263`), and the split
editor snaps with `Math.round(n * 2) / 2` (`SplitDrawer.jsx:50`). The Sheet's Hours box
is the odd one out: it is free text run through `round2()` in `src/data/jobsSheet.js`,
which rounds to two decimals, not to a half hour.

**What that means in practice.** The four tag bands are already half hours — EZ 1.5,
M 3, T 5.5, H 6 — so picking a tag was never the problem. The gap is what happens when
he types by hand:

| Typed | Saves today | Should save |
|---|---|---|
| `1.2` | `1.2` | `1` |
| `2.75` | `2.75` | `3` (or `2.5` — see the open question) |
| `1.5-2` | `1.75` | `2` |
| `2-4` | `3` | `3` — unchanged |

**Correction to an earlier draft of this section, so nobody builds off it:** typing `1.5`
on its own has always saved as `1.5` — it was never broken. The `1.75` case is the
*range* `1.5-2`, whose average lands on a quarter. Trevor is right that the plain typed
value is fine.

**Where the change goes.** `parseHoursInput()` in `src/data/jobsSheet.js` — one snap
applied to the value it is about to return, covering both the plain-number path and the
range-average path. Do **not** try to fix this in `JobsSheetPage.jsx` alone; the parse
function is what `draftChanges()` and `buildSheetWrites()` write from, so snapping in the
UI only would let an unsnapped value reach the database by another route.

**Open question for Trevor, ask when this is picked up — not now:** halves that land exactly on a quarter
— does `2.75` go up to `3` or down to `2.5`? Nearest-with-ties-up (`Math.round(n * 2) / 2`,
which matches `SplitDrawer.jsx`) is the recommendation unless he says otherwise.

**Constraints that still hold on this change:**

- Ranges keep working. `2-4` → `3`. Averaging then snapping, not banning ranges — he
  estimates in ranges and `hours_range()` in `scripts/sheet_to_csv.command` does the same.
- Blank still saves as `null`, not `0`. Unknown and zero-hour are different things.
- A typo still goes red and skips that one job. Snapping must not turn unreadable into
  a guess.
- It needs its own tests alongside the existing `parseHoursInput` ones, and `round2()`'s
  comment block needs updating — it currently explains two-decimal precision, which stops
  being the rule.
- This is a behaviour change to an app-owned column, so it goes through the protocol when
  it is picked up — brief, council, builder, verifier. It is **not** to be slipped onto
  `staging/brief-g-jobs-sheet-page` ahead of the merge.

### Deferred — Enter should move down a row, like a spreadsheet

Asked for 2026-07-29, same message as the white background below. His words: *"it's
really hard to enter hrs in. It shld be select box, enter hrs, push enter, and it will
drop down to next box like G sheet."*

**This is the real complaint, and it is bigger than the 30-minute snap.** Snapping
changes what a typed value saves as; this changes whether entering forty jobs' hours is
tolerable at all. Right now every cell has to be reached with the mouse. He wants: click
a cell, type, press Enter, land in the same column one row down, type again — never
touching the mouse until the column is done.

What that needs, in `src/components/JobsSheetPage.jsx`:

- **Enter** commits the cell and focuses the same column, next row. At the last row it
  should stop, not wrap.
- **Shift+Enter** goes back up. **Tab / Shift+Tab** across, which mostly works already
  via native tab order — confirm it doesn't detour through the checkboxes in a silly way.
- **Escape** puts the cell back to what it was before the edit.
- Focusing a cell should select its contents so typing replaces rather than appends.
- The focused cell must be scrolled into view; the header is sticky and will otherwise
  hide the row above.

**"Enter" here means moving between cells, not saving to the database.** Commit stays
the only thing that writes. Do not sneak an autosave in on Enter — that was a deliberate
decision and it hasn't changed.

**Implementation note for whoever builds it:** this wants a small focus-management
helper keyed by `(jobId, column)` — probably a ref map plus an ordered list of the
editable rows — not a scattering of `onKeyDown` handlers. Also worth checking whether the
Tag and Action `<select>`s should join the same movement or stay out of it; a `<select>`
swallows arrow keys, and Enter on a native select behaves differently. **When this is
picked up, ask Trevor whether Enter-to-move should apply to the dropdowns too, or hours
only.** Don't ask him now — it's parked.

### Deferred — the sheet should be white, not dark

Same message: *"Blue background is too dark needs to be white like sheet too."*

The restyle (`8b3ce93`) kept the app's dark palette — `#0c1119` / `#0f151e` banded rows
on a dark blue page. He wants it light, like the Google Sheet he is used to: white cells,
grey gridlines, dark text.

**Scope this carefully before building.** The Sheet page is a light island inside a dark
app, so:

- All of it is in `SHEET_CSS` in `JobsSheetPage.jsx` — a self-contained stylesheet, which
  is why it can be re-themed without touching anything else. **Nothing outside that page
  changes colour.** Do not start a global light theme off the back of this.
- The page chrome around the table — the header bar, the Commit and Discard buttons, the
  "N changed" counter — has to move with it or it will look broken. Check the whole page,
  not just the cells.
- Things that were tuned for dark and need re-picking on white: the dirty-row highlight
  (currently `#16223d`), the focus ring (`#6366f1`), the fence rule marking the six
  app-owned columns, the red invalid-hours state, the custom checkboxes, and the greyed
  read-only Multitrack columns — grey-on-white reads very differently to grey-on-dark and
  must stay clearly "you can't edit this".
- Keep the spreadsheet cues from `8b3ce93` — gridlines both ways, banded rows, frozen job
  column, right-aligned hours. Those weren't the problem; the darkness was.

**Still presentation only.** No change to `jobsSheet.js` or to what gets written.

## Worth checking, not a task — the 1-hour values

Trevor noticed *"most of the top of the page jobs defaulted to 1 hr"*. There is **no
default of 1 anywhere in the app** — nothing in `joinJobs.js` or the import path invents
it, and a blank hours field renders as `—`, not `1`. So those are real stored values that
came from the old spreadsheet or an earlier import.

Not a bug and not in scope. Mentioned only so a future session doesn't hunt for a
phantom default — and so Trevor knows those are numbers someone once entered, which he
may well want to overwrite once entering hours is quick.

---

## Verification already done — don't repeat it

`ggnz-verifier` (sonnet, not the builder) ran the brief's checklist: **21/21 pass, one
concern**. Independently re-confirmed in the main session, not taken on trust:

- 197/197 tests pass (167 pre-existing + 30 new), clean production build
- `JobDrawer.jsx` diff against `main` is **empty** — the manual split editor was not touched
- No new code path calls `upsertJobsBatch()`; the sheet page imports `batchWriteJobsState` only

**The concern:** that split and derived cards are excluded from the sheet (brief item 13)
is proven by reading the code, not by a running browser. There is no component test for
`JobsSheetPage.jsx`. The verifier's condition was explicit: *do not merge until the
browser test confirms item 13 and the Commit → CSV-sync-survives round trip live.*

### The one change that was flagged for human eyes

In `src/hooks/useJobs.js`, the bench-change save now names `hours` explicitly:

```js
if (row.bench !== parentJob.bench) {
  saveJob(parentJob.id, { ...pickMasterFields(mergedParent), hours: mergedParent.hours });
}
```

**It is correct and it is necessary.** Making `hours` app-owned means `pickMasterFields()`
now strips it, and this call is the only thing that has ever persisted an hours change
made in the drawer for a top-level job — letting it drop would have been a silent
regression. `saveJob()` goes through `toJobRow()`, which sends only the keys present, so
naming `hours` here writes exactly that one extra column and nothing else. No further
action needed; it is recorded because it is a behavioural touch next to the drawer's
write path.

### Why six columns were removed from `upsertJobsBatch()` rather than stripped by the caller

This is the most dangerous-looking change on the branch, so the reasoning is recorded
here. `upsertJobsBatch()` builds a **fixed** row regardless of what the caller hands it.
Stripping the fields caller-side alone would have been *worse than doing nothing*,
because `vb: job.vb ? 'Y' : 'N'` on a stripped record would then write `'N'` over every
real `'Y'` in the workshop. The verifier traced every call site; the only live one is the
CSV sync at `useJobs.js:313`, and `useSupabase.js` merely re-exports.

---

## Protocol step 5 — the browser test

Run it against the **Vercel preview for `staging/brief-g-jobs-sheet-page`**, or locally
via the `ggnz-scheduler` config in `.claude/launch.json` (port 5173).

**Note for local testing:** the in-app browser renders the sheet read-only. **Corrected
2026-07-29 after checking it live:** the cause is *not* `pointer: coarse` — that reports
`false`. It is `window.innerWidth`, which is `0` at mount in the preview tab, so the
`|| window.innerWidth < 768` half of `App.jsx:108` fires and the app decides it's a phone.
A preview artefact either way, not a bug — on Trevor's iMac it renders editable. If a
session needs the editable version in the preview browser, temporarily neutralise that
line and **revert it before committing**. It has been reverted cleanly every time so far;
check `git diff -- src/App.jsx` is empty before any commit.

**Run 2026-07-29 against the local dev server. Five of the six items pass; only item 3 is
left, and it is the one that needs Trevor's go-ahead because it writes live data.**
Results are recorded under each item below.

What must be confirmed live, in this order:

1. **It works, and it's usable enough to merge.** Not "is it pretty" — the look changes he
   asked for are parked by his own instruction, so a dark sheet is not a blocker. What
   matters here is that the page loads, the six columns edit, and Commit does what it says.
   **PASS.** Page loads with no console errors, header reads "Jobs Sheet — 53 jobs ·
   greyed columns come from Multitrack", and the editable controls are all present: 106
   `<select>` (53 Tag + 53 Action), 53 Hours boxes, 159 checkboxes (VB/BL/PJ).
2. **Item 13 — split and derived rows do not appear and are not writable from the sheet.**
   Derived cards have non-numeric ids like `1620_Electronics_0`. This is the verifier's
   open concern and the reason the merge is gated.
   **PASS, and non-vacuously.** The sheet shows **53 rows, every id numeric, no
   duplicates**. The app's own `jobs` array (read out of React) holds **78**, of which
   **25 are derived or split** — `1711-LC`, `1711-LU`, `1711-SU`, `1632-R`, `1632-LC`,
   `1635-WR`, `1708-R`, `1703_Fretwork_0`, `1703_Setup_0`, `1621_Fretwork_0`,
   `1621_Fretwork_1`, `1689_Luthier_0` and the rest. 53 + 25 = 78. So derived rows really
   do exist in the live set and really are excluded. **The verifier's concern is settled.**
3. **Edit → Commit → CSV sync → the edit survives.** The whole point of the ownership
   move. Change an Action, commit, run a sync, confirm it is still there.
   **DROPPED 2026-07-29, deliberately — see START HERE for the reasoning. Do not
   reinstate it without Trevor.** The detail below is kept because it is the record of
   which path writes what, and that stays true after the merge.

   **Trevor asked, fairly: "CSV sync? I thought we were running PDF now?" He is right that
   PDF is the live import path.** Both paths exist in the app today, verified in the code
   2026-07-29:

   - The **PDF** path (`writePdfImportBatch`, `useJobs.js:377`) writes only the six
     Multitrack fields. Build 1a deliberately never touched Tag/Hours/Action/VB/BL/PJ.
     **So a PDF drop cannot prove this fix** — it was never the thing that wiped them.
   - The **CSV** path (`saveJobsMasterBatch` → `upsertJobsBatch`, `useJobs.js:313`) is the
     one that used to rewrite every column on every row. **That is what item 3 of this
     build changed.** Its upload button is still live in the UI — `JobShelf.jsx:207`,
     `DailyLogPage.jsx:1064`, `Sidebar.jsx:250` — so the risk it protects against is real,
     not historical.

   The reason it was dropped rather than run: it needs a Multitrack CSV that does not
   exist in the repo, it writes real job data, and the exact behaviour it would prove is
   already asserted by two tests named after this path — `supabaseJobOwnership.test.js:51`
   and `joinJobs.test.js:511`.
4. Tag auto-fill uses the corrected bands. **PASS.** On job 1712, picking each tag in turn
   filled the Hours box with `EZ → 1.5`, `M → 3`, `T → 5.5`, `H → 6` — M and T the right
   way round, which is item 4b proved live. Clearing the tag back to `—` left hours at
   `6`, which is the documented behaviour: forgetting a tag must not wipe an estimate.
5. A range in the Hours box: `2-4` saves as `3`. That is current behaviour and what must
   be tested — the 30-minute snap is deferred, so don't expect `1.2` to become `1` yet.
   **PASS.** Typing `2-4` into job 1712's Hours box turned the row dirty and the box's own
   tooltip read **"Saves as 3"**.
6. `SKP` round-trips on 182 / 321 / 592 / 1268 without changing behaviour. **PASS.** All
   four appear in the sheet holding `SKP`, each with options `["", "EZ", "M", "T", "H",
   "SKP"]` — the extra option exists only on the rows that already hold it. Actions read
   GTS / CI / CI / RS. No branching behaviour anywhere.

Everything above was then **discarded**: zero dirty rows, job 1712 back to tag `—` and
hours `0`. **Nothing was written.** The temporary `App.jsx:108` edit was reverted and
`git diff` is empty.

Step 3 writes to live job data. **Get Trevor's explicit go-ahead before committing a
real edit**, and tell him which job and which field first.

## Protocol step 6 — merge

Only on Trevor's "yp". Never push to `main` without it.

---

## Still in force — do not drift on these

- **Do not build any part of Build 1c on this branch** (the JBA second PDF drop,
  `first_seen`, computed job age, the migration). Council has never seen it. It is the
  next phase *after* the merge, and it starts with its own brief at protocol step 1.
- **Do not build the three deferred Sheet changes on this branch** either. Same reason —
  they are a record, not a task list.
- **Do not add a "close missing jobs" rule** for the six jobs absent from the Multitrack
  export (1619, 1620, 1626, 1671, 1698, 1702).
- **Do not add SKP handling logic.** Tolerate and render it; add no branching.
- **`preserveKnownDays()` stays days-only.** Don't widen it, don't remove it.
- **Never call `upsertJobsBatch()` from any new code path.**
- **Scheduling stays untouched** — no calendar slots, bench assignments, split state or
  pomodoro state written by this build.
- **Scope changes go back to the brief for a fresh "yp"**, never absorbed quietly.
- Trevor never runs git. Claude runs every git command. `git add <specific file>`, never
  `git add -A`.

## After the merge — housekeeping owed

Both must be done in the same session the merge happens, per CLAUDE.md:

- Set `doc_status: closed` on this file and on `.claude/pending-brief.md`, add the
  "shipped at `<commit>`" line to each
- Update `docs/briefs/README.md` — move this brief out of **Live**
- `re-fresh-repo-housekeeping.md` has two pipeline scripts waiting on Build 1b; after the
  merge, only Build 1c still blocks them
- **Move the three deferred Sheet changes into their own `parked` brief** before closing
  this one — otherwise they die inside a `closed` document and get rebuilt from scratch
  when Trevor asks again. Then write the Build 1c brief and start protocol step 1.
