---
doc_status: closed
---
# The Daily Log's job picker — rebuilt

**Shipped 2026-08-22, `0be24bd` (PR #35).** Started as a bug Trevor found on the
Build 2 preview and turned into a rebuild of the control. Four things worth
keeping.

## The card's rule was not the rule I assumed

1632 offered **7** pieces where the job card showed **4**. The obvious reading —
the card hides finished pieces — was wrong. `Sidebar.jsx:20` keeps only
**unscheduled** sub-tasks, so the three it hid were **booked**, not done.
Filtering on `pieceDone` therefore changed nothing on 1632, and the mismatch
survived a whole build round.

The picker now skips a piece that is booked **or** ticked off. A booked piece
already turns up on its own day through `bookedOnDay()`, so offering it was a
second way to put it somewhere it already is.

**Only the picker filters.** `bookedOnDay()` deliberately does not: a booked
split is booked whether or not it is done, and hiding a finished piece there
would erase the day's record of the work.

The trade, stated to Trevor and accepted: a piece booked on one day can no
longer be added to a second day from the picker.

## A native dropdown cannot be styled, so it had to go

Trevor asked for a job heading he could follow down a long list. Grouping the
`<select>` with `<optgroup>` was right in shape and impossible in fact — macOS
and iOS paint native menus themselves and discard the heading colour. Two
rounds went into colouring something that cannot be coloured.

The picker is now a search box over a list we render. Headings in the amber this
panel already uses, pieces underneath as buttons. **If a control's whole value
is how it looks, a native control is the wrong control.**

## What it does now

- The list stays **hidden until something is typed** — an always-open list is
  the chip row Trevor turned down, in a different shape: it fills the page.
- The search **stays put after a pick**, and the piece just placed drops out of
  the list on its own. One search, then tap down the job's pieces. Clearing it
  after each pick meant re-typing the job number once per bench: *"way too much
  typing… I can only choose 1 at a time."*
- Matching is deliberately dumb substring matching over job number, make, model,
  bench and the split's own note. Every typed word has to appear somewhere, in
  any order, so `1632 fret` and `fret 1632` both find it.
- The option shows just the bench, because the heading already carries the job.
  `label` is untouched — that is what gets **stored** on the placed row, and the
  placed row has no heading above it.

## The tests read the screen, not the helper

Every picker test renders the panel and clicks. The Remove bug fixed earlier the
same day (`54ce790`) shipped green because no test had ever rendered the button
and clicked it — the helpers all passed. Same failure shape as the Weekly Log
day columns before it.
