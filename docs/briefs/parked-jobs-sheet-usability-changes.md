doc_status: parked

# Parked — three changes Trevor asked for on the Jobs Sheet page

Split out of [re-fresh-brief-g-build-1b-browser-test-and-merge.md](re-fresh-brief-g-build-1b-browser-test-and-merge.md)
on 2026-07-29, the day Build 1b merged (`f2ee449`), so they don't die inside a closed brief and
get re-derived from scratch when Trevor asks again.

**Status: not approved, not scoped, not started.** Trevor asked for all three on 2026-07-29 after
seeing the restyled Sheet page live, then the same day said to park them: *"Appointments and UI
can wait until everything's rock solid."*

**Waiting on — decided by Trevor 2026-07-29, after the 1b merge, and this is now firm:**
*"save all UI changes until after PDF drop implemented successfully and CSV pipeline gone"*.

So the queue is fixed, and it is not a judgement call for a future session:

1. **Build 1c** — the JBA drop, `first_seen`, computed job age (scope-locked in
   `.claude/pending-brief.md`), imported successfully against a real PDF.
2. **Build 2** — the DropBox/watcher/CSV pipeline retired, the `days` column and
   `preserveKnownDays()` removed, the CSV upload buttons gone from the UI.
3. **Then** these three, and not before.

**Do not offer these as "a quick win while 1c waits for council".** That is exactly the
sequencing Trevor just ruled out. The data pipeline gets finished first; look-and-feel comes after
the plumbing is rock solid. Same ruling covers
[appointments-not-showing-on-the-calendar.md](appointments-not-showing-on-the-calendar.md).

**The order these should be built in, if all three go together:** Enter-to-move-down first (it is
the actual pain), then the 30-minute snap, then the white theme. The first two touch behaviour and
go through the full protocol; the third is presentation only.

The questions marked "Ask Trevor" below are **not to be asked until the work is picked up.**

---

## 1 — Enter should move down a row, like a spreadsheet

Asked for 2026-07-29. His words: *"it's really hard to enter hrs in. It shld be select box, enter
hrs, push enter, and it will drop down to next box like G sheet."*

**This is the real complaint, and it is bigger than the 30-minute snap.** Snapping changes what a
typed value saves as; this changes whether entering forty jobs' hours is tolerable at all. Right
now every cell has to be reached with the mouse. He wants: click a cell, type, press Enter, land
in the same column one row down, type again — never touching the mouse until the column is done.

What that needs, in `src/components/JobsSheetPage.jsx`:

- **Enter** commits the cell and focuses the same column, next row. At the last row it should stop,
  not wrap.
- **Shift+Enter** goes back up. **Tab / Shift+Tab** across, which mostly works already via native
  tab order — confirm it doesn't detour through the checkboxes in a silly way.
- **Escape** puts the cell back to what it was before the edit.
- Focusing a cell should select its contents so typing replaces rather than appends.
- The focused cell must be scrolled into view; the header is sticky and will otherwise hide the row
  above.

**"Enter" here means moving between cells, not saving to the database.** Commit stays the only
thing that writes. Do not sneak an autosave in on Enter — that was a deliberate decision in Build
1b and it hasn't changed.

**Implementation note:** this wants a small focus-management helper keyed by `(jobId, column)` —
probably a ref map plus an ordered list of the editable rows — not a scattering of `onKeyDown`
handlers. Also worth checking whether the Tag and Action `<select>`s should join the same movement
or stay out of it; a `<select>` swallows arrow keys, and Enter on a native select behaves
differently.

**Ask Trevor when this is picked up:** should Enter-to-move apply to the dropdowns too, or hours
only?

---

## 2 — Hours must snap to 30-minute steps

Asked for 2026-07-29, after the restyle, in his words: *"I want the hrs to be in increments of 30
mins like they were before."*

**"Like they were before" is real and checkable** — the job drawer's hours box has always been
`<input type="number" min="0.5" step="0.5">` (`JobDrawer.jsx:263`), and the split editor snaps with
`Math.round(n * 2) / 2` (`SplitDrawer.jsx:50`). The Sheet's Hours box is the odd one out: it is
free text run through `round2()` in `src/data/jobsSheet.js`, which rounds to two decimals, not to
a half hour.

**What that means in practice.** The four tag bands are already half hours — EZ 1.5, M 3, T 5.5,
H 6 — so picking a tag was never the problem. The gap is what happens when he types by hand:

| Typed | Saves today | Should save |
|---|---|---|
| `1.2` | `1.2` | `1` |
| `2.75` | `2.75` | `3` (or `2.5` — see the open question) |
| `1.5-2` | `1.75` | `2` |
| `2-4` | `3` | `3` — unchanged |

**Don't build off an earlier draft that said `1.5` was broken:** typing `1.5` on its own has always
saved as `1.5`. The `1.75` case is the *range* `1.5-2`, whose average lands on a quarter.

**Where the change goes.** `parseHoursInput()` in `src/data/jobsSheet.js` — one snap applied to the
value it is about to return, covering both the plain-number path and the range-average path. Do
**not** try to fix this in `JobsSheetPage.jsx` alone; the parse function is what `draftChanges()`
and `buildSheetWrites()` write from, so snapping in the UI only would let an unsnapped value reach
the database by another route.

**Ask Trevor when this is picked up:** halves that land exactly on a quarter — does `2.75` go up to
`3` or down to `2.5`? Nearest-with-ties-up (`Math.round(n * 2) / 2`, which matches
`SplitDrawer.jsx`) is the recommendation unless he says otherwise.

**Constraints that still hold:**

- Ranges keep working. `2-4` → `3`. Averaging then snapping, not banning ranges — he estimates in
  ranges and `hours_range()` in `scripts/sheet_to_csv.command` does the same.
- Blank still saves as `null`, not `0`. Unknown and zero-hour are different things.
- A typo still goes red and skips that one job. Snapping must not turn unreadable into a guess.
- It needs its own tests alongside the existing `parseHoursInput` ones, and `round2()`'s comment
  block needs updating — it currently explains two-decimal precision, which stops being the rule.
- This is a behaviour change to an app-owned column, so it goes through the full protocol when it
  is picked up — brief, council, builder, verifier.

---

## 3 — The sheet should be white, not dark

Same message, 2026-07-29: *"Blue background is too dark needs to be white like sheet too."*

The Build 1b restyle (`8b3ce93`) kept the app's dark palette — `#0c1119` / `#0f151e` banded rows on
a dark blue page. He wants it light, like the Google Sheet he is used to: white cells, grey
gridlines, dark text.

**Scope this carefully.** The Sheet page would become a light island inside a dark app, so:

- All of it is in `SHEET_CSS` in `JobsSheetPage.jsx` — a self-contained stylesheet, which is why it
  can be re-themed without touching anything else. **Nothing outside that page changes colour.** Do
  not start a global light theme off the back of this.
- The page chrome around the table — the header bar, the Commit and Discard buttons, the "N changed"
  counter — has to move with it or it will look broken. Check the whole page, not just the cells.
- Things that were tuned for dark and need re-picking on white: the dirty-row highlight (currently
  `#16223d`), the focus ring (`#6366f1`), the fence rule marking the six app-owned columns, the red
  invalid-hours state, the custom checkboxes, and the greyed read-only Multitrack columns —
  grey-on-white reads very differently to grey-on-dark and must stay clearly "you can't edit this".
- Keep the spreadsheet cues from `8b3ce93` — gridlines both ways, banded rows, frozen job column,
  right-aligned hours. Those weren't the problem; the darkness was.

**Presentation only.** No change to `jobsSheet.js` or to what gets written.

---

## Background, so this isn't re-derived

**Why the page is a grid at all.** The first cut of the Sheet page was a plain web table. Trevor's
verdict on seeing it: *"it's really hard on my eyes too busy not like the sheet at all"*. He was
then offered a one-job-at-a-time redesign and **declined it** — *"just make it like a spreadsheet
that will be fine"*. So the grid stays. This is the documented exception to the
`trevor-needs-focus-windows` rule: he asked for the grid explicitly and has used one daily for
years.

**Not a task — the 1-hour values.** Trevor noticed *"most of the top of the page jobs defaulted to
1 hr"*. There is **no default of 1 anywhere in the app** — nothing in `joinJobs.js` or the import
path invents it, and a blank hours field renders as `—`, not `1`. Those are real stored values from
the old spreadsheet or an earlier import. Mentioned only so nobody hunts for a phantom default, and
so Trevor knows they are numbers someone once entered — which he may well want to overwrite once
entering hours is quick.
