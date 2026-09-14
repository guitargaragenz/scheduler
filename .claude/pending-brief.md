---
doc_status: live
---

# Brief — `#tag` search on the Jobs Sheet

**Not approved yet.** Waiting on Trevor's "yp".

Typing `#EZ` in the search box means "this job's tag is EZ", not "the letters
EZ appear somewhere in the row". Trevor's call, 2026-09-14, replacing the tag
dropdown briefed earlier the same day — no new control on screen, and it fixes
what the dropdown was working around.

The tags are `EZ`, `M`, `T`, `H` — typing `M` or `T` as free text matches most
of the sheet, so plain search is useless for three of the four.

## Build
`src/data/jobsSheet.js` (the matcher) and `src/components/JobsSheetPage.jsx`
(placeholder and Key panel), plus tests.

- A word starting with `#` is an exact, case-insensitive match against the
  row's Tag **or** Action. `#ez` finds EZ; `#wp` finds WP.
- Tag and Action both, because he won't be sorting out which code is which
  while typing. `#` means "this is a code", nothing finer.
- It reads the DRAFT tag and action, same as the rest of the search already
  does. A WP picked but not committed answers `#WP`.
- Exact means exact: `#M` matches the tag M, never the M inside "Marshall",
  and `#RS` never matches `RS-C`.
- A `#` word mixes with plain words: `fender #ez` is Fenders on EZ. Every word
  still has to match, same rule as now.
- A bare `#`, or `#` plus no real code, matches nothing — it never falls back
  to a text search.
- Placeholder becomes "Search jobs or #tag", and the Key panel gains a line
  saying `#EZ` searches by code — findable without being told.

## Rules that bind it
- **`rows` stays the full list.** This only changes what `matchesSearch` in
  `jobsSheet.js` counts as a match — no change to `visibleRows`, `dirty`,
  `invalidCount`, `commit` or `discard`. Nothing new narrows what saves.
- Display only: writes nothing, saves nothing, resets on every visit.
- A code search is a lookup. It never feeds bench choice, and it is not a sort.
- Not blast-radius: no `jobs[]`, `scheduledSlots`, `calendarSlot`, Supabase or
  `useGoogleCalendar` changes. If the build finds it needs one, stop and ask.

## Out of scope
- The tag dropdown. This replaces it; the earlier brief is dead.
- `#` searching VB/BL/PJ, status, or anything but Tag and Action.
- Autocomplete on `#`. Two codes at once (`#EZ #M`) correctly matches nothing.
- The mobile sheet, and search anywhere else in the app.

## Background, not the next step
`docs/briefs/2026-09-14-jobs-sheet-tag-filter.md` — where the ask came from.
