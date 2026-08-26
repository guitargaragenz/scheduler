---
doc_status: closed
---

# Day columns line up at any width

**Shipped 2026-08-26 at `509507e` (PR #53). Closed — this is a record, not a
task list.**

Reported by Trevor 2026-08-26, as the tail of a false alarm worth keeping.

## What actually happened

Trevor reported job 1730 disappearing from Thursday in the Daily Log. A session
went into diagnosing it — the `hidden` "keep it off this day" note, the PR #42
clearing path, `weekCellJobId()` resolution. All of it was chasing a bug that
was not there.

The truth, in his words: *"In half screen mode the days don't line up properly
so what I thought was thurs was actually wed and because I booked wed on WL and
tried to book same job on thurs DL it wouldn't of course book."*

He booked Wednesday. The app then correctly declined to show the job on
Thursday. **The app did exactly what he asked; what he asked was wrong because
the screen lied about which column was which day.**

So this is a data correctness bug, not a cosmetic one. A misread column writes a
mark to the wrong day, and nothing about the result looks wrong afterwards —
which is why it presented as a phantom bug somewhere else entirely.

## The cause, in both grids

A heading and the cell under it are separate flex items in separate rows. They
stay lined up only while they shrink at the same rate. Each grid had given one
of them a shrink floor the other did not have.

- **Weekly Log** (`BenchWeekPage.jsx`) — fixed-width columns (`nameW` + one
  `cellW` per day). The day `<select>`s and the close `<button>` had no
  `flexShrink: 0`, so they compressed under width pressure instead of letting
  the scroll container take the overflow. The heading row compressed at a
  different rate again, because it carries a trailing `flex: 1` spacer that the
  body rows do not have.
- **Day view / Week view** (`CalendarGrid.jsx`) — proportional columns
  (`flex: 1`). The slot cells set `minWidth: 0`; the headings did not. A flex
  item defaults to `min-width: auto`, which floors it at its own content, so a
  heading carrying "27 Aug" stopped shrinking while the empty cells below it
  carried on.

## Worth carrying forward

- **Day view and Week view are the same component.** `CalendarGrid.jsx` is fed
  `weekDays` — one day or seven (`App.jsx:952`). A fix to one is a fix to both.
  Day view needed it more: its container has no 700px floor
  (`minWidth: weekDays.length > 1 ? 700 : 0`), so its single heading could drift
  off its own column at any narrow width.
- **The names collide badly.** Day view, Week view (both `CalendarGrid`), Weekly
  Log (`BenchWeekPage`), Daily Log (`DailyLogPanel`). Trevor, 2026-08-26: *"Man
  these names need to change haha"*. This session lost a round to it — the
  fix could not start until he was asked which "day view" he meant. Not scoped.
- **A real bug found while chasing the phantom, NOT fixed here:** nothing in the
  Daily Log clears a `hidden` row. The only clearing path is the Weekly Log's
  `setCell()` -> `onBookedOnDay` (`App.jsx:867`). So a job taken off a day from
  the DL can never be put back on that day *from the DL picker* —
  `DailyLogPanel.jsx:685` filters it out and nothing removes the note. Trevor's
  1730 case was not this, but this is real and unscoped.

## What shipped

`flexShrink: 0` on every fixed-width WL column; `minWidth: 0` on every
proportional calendar column and its heading. No logic, no state, no data.

`src/components/dayColumnAlignment.test.js` pins both rules at source level —
jsdom has no flexbox, so layout cannot be asserted directly. Both rules were
confirmed to FAIL on the unfixed code before the test was kept. 764 tests green,
build clean.

No blast-radius file touched. Nothing written to `jobs[]`, `scheduledSlots`,
`calendarSlot` or `useSupabase.js`.
