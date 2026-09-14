---
doc_status: live
---

# Tag dropdown on the Jobs Sheet

Trevor asked for this on 2026-09-14, straight after browser-testing the search
box: he typed EZ, saw it work, and asked for a way to pick a tag rather than
type it.

**The build is scope-locked in `.claude/pending-brief.md`.** Build from that,
not from this file. This one only records where the idea came from and what was
already true when it was written.

## What was already there
The search box shipped the same day at `09f12df` (PR #67). It already matches
the Tag and Action columns, off the draft value, so typing EZ works today. The
dropdown is not new capability — it is picking from a list instead of typing,
and it removes the one rough edge of the text search: "EZ" typed in the box
also matches a description containing "ez".

## Where it plugs in
- `TAG_OPTIONS` and `ACTION_OPTIONS` in `src/data/jobsSheet.js` are the same
  lists the row dropdowns already use. The filter must read those, never a
  second hand-written list.
- `visibleRows` in `src/components/JobsSheetPage.jsx` is the one place rows are
  narrowed. The tag filter joins it; it does not get its own filtering path.
- The rule that made the search safe still holds and still binds this: `rows`
  stays the full list, because `dirty`, `invalidCount`, `commit` and `discard`
  all iterate it.

## Open question for Trevor, answered before the build starts
Should picking a tag and typing in the box at the same time narrow to jobs
matching **both**, or should picking a tag replace whatever is typed? The scope
lock assumes both, as an "and" — that is how every other filter he uses behaves.
