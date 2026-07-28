doc_status: live

# Brief G, Build 1b — built and verified, waiting on the browser test and the merge

Written 2026-07-29 at the end of the session that ran protocol steps 3 and 4.

---

## START HERE

Build 1b is written, reviewed and pushed. It sits on `staging/brief-g-jobs-sheet-page`,
ahead of `main` (`b84373d`). Do not re-run protocol steps 1–4 on what is already built.

What is left:

1. **One small code change** — Hours must snap to 30-minute steps. Asked for after the
   restyle, not yet built. See *"Still to build"* below.
2. **Protocol step 5** — the browser test.
3. **Protocol step 6** — merge on Trevor's "yp".

Read this file, then `.claude/pending-brief.md` for the scope lock. **Do not re-read**
`re-fresh-brief-g-checkpoint-3b-and-build-1b.md` as instructions — it is the previous
handoff, it says Build 1b "is not started", and that is now false. It is being closed in
the same commit as this file.

### The one open question, ask it first

Trevor's last two messages were **"no change... handoff for new session"**, sent right
after being asked to open the restyled sheet at `http://localhost:5173`. That is
ambiguous and the session ended before it was resolved. It means one of:

- **"No further changes needed"** — he's happy, go to the browser test; or
- **"I see no change on screen"** — he opened it and the restyle did not appear.

**Ask him which before doing anything else.** If it's the second, the most likely cause
is that he was looking at a stale tab or a Vercel preview built from an older commit —
the restyle is commit `8b3ce93` and was pushed. Get him to hard-reload, or check the
Vercel deployment is built from `8b3ce93` and not `ccb1503`.

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

## Still to build — Hours must snap to 30-minute steps

Asked for by Trevor 2026-07-29, after the restyle, in his words: *"I want the hrs to be
in increments of 30 mins like they were before."* **Not built yet.** This is the only
outstanding code change on Build 1b.

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

**Where the change goes.** `parseHoursInput()` in `src/data/jobsSheet.js` — one snap
applied to the value it is about to return, covering both the plain-number path and the
range-average path. Do **not** try to fix this in `JobsSheetPage.jsx` alone; the parse
function is what `draftChanges()` and `buildSheetWrites()` write from, so snapping in the
UI only would let an unsnapped value reach the database by another route.

**Open question for Trevor, ask before building:** halves that land exactly on a quarter
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
- This is a behaviour change to an app-owned column, so it goes through the protocol like
  the rest of Build 1b: it is written here, Trevor has asked for it, and it must be built
  on `staging/brief-g-jobs-sheet-page` and verified before the merge — not added after.

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

**Note for local testing:** the in-app browser reports `pointer: coarse`, so
`App.jsx:108` decides it's a phone and renders the sheet read-only. That is a preview
artefact, not a bug — on Trevor's iMac with a mouse it renders editable. If a session
needs the editable version in the preview browser, temporarily neutralise that line and
**revert it before committing**. It was reverted cleanly last session; check
`git diff -- src/App.jsx` is empty before any commit.

What must be confirmed live, in this order:

1. **The look.** Trevor's call, not an agent's. This is the item that has already failed
   once.
2. **Item 13 — split and derived rows do not appear and are not writable from the sheet.**
   Derived cards have non-numeric ids like `1620_Electronics_0`. This is the verifier's
   open concern and the reason the merge is gated.
3. **Edit → Commit → CSV sync → the edit survives.** The whole point of the ownership
   move. Change an Action, commit, run a sync, confirm it is still there.
4. Tag auto-fill uses the corrected bands. *(Already confirmed once locally: picking
   `T` on job 1711 filled hours with `5.5`, the row highlighted, the counter read
   "1 changed", Commit went live. Then discarded — nothing was written.)*
5. A range in the Hours box: `2-4` saves as `3`. Once the 30-minute snap is built, also
   check `1.2` becomes `1` and `1.5-2` becomes `2`.
6. `SKP` round-trips on 182 / 321 / 592 / 1268 without changing behaviour.

Step 3 writes to live job data. **Get Trevor's explicit go-ahead before committing a
real edit**, and tell him which job and which field first.

## Protocol step 6 — merge

Only on Trevor's "yp". Never push to `main` without it.

---

## Still in force — do not drift on these

- **Do not build any part of Build 1c** (the JBA second PDF drop, `first_seen`, computed
  job age, the migration). Council has never seen it.
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
