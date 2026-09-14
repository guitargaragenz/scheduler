---
doc_status: closed
---

# Searching the Jobs Sheet by tag

Trevor asked for this on 2026-09-14, straight after browser-testing the search
box: he typed EZ, saw it work, and asked for a way to pick a tag rather than
type it.

**Trevor replaced the dropdown with a `#tag` search the same day** — "instead
of DD we just use hashtag for tag search way easier". The dropdown is dead;
nothing below describing it is a task.

**Shipped on PR #68 as a `#tag` search, 2026-09-14.** The record is
[2026-09-14-jobs-sheet-tag-search.md](2026-09-14-jobs-sheet-tag-search.md).
Nothing here is a task.

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

## Why the dropdown went
The tags are `EZ`, `M`, `T`, `H`. Three of the four are single letters, so
plain text search can't find them — `M` matches half the sheet. The dropdown
existed to work around that. `#M` is an exact match and needs no new control,
so it does the same job with less on screen.

The open question the dropdown had — whether a picked tag and typed text
narrow together or replace each other — died with it. `fender #ez` is one
search box and every word still has to match.
