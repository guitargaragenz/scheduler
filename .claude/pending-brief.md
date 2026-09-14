---
doc_status: live
---

# Brief — Tag dropdown on the Jobs Sheet

**Not approved yet.** Waiting on Trevor's "yp".

Pick a tag from a list instead of typing it in the search box. Asked for
2026-09-14, straight after the search box shipped.

## Build
`src/components/JobsSheetPage.jsx`, plus tests.

- A dropdown in the toolbar, beside the search box. Reads "All tags" when
  nothing is picked; picking one shows only jobs on that tag.
- Options come from `TAG_OPTIONS` in `src/data/jobsSheet.js` — the same list
  the row's own Tag cell offers. Never a second hand-written list.
- It reads the row's **draft** tag, not the saved one, exactly as the search
  does. A tag picked but not yet committed filters on the new value.
- Search box and dropdown narrow together: "Fender" typed plus EZ picked shows
  Fenders on EZ, not everything Fender plus everything EZ.
- The count line already reads "12 of 53 jobs" while filtering; a tag filter
  counts as filtering the same way, with or without anything typed.
- "No jobs match that." covers a tag with no jobs on it — same empty state.
- The × already in the search box clears the box only. Clearing the tag is
  picking "All tags".

## Rules that bind it
- **`rows` stays the full list.** `dirty`, `invalidCount`, `commit` and
  `discard` keep iterating `rows`. The tag filter joins the existing
  `visibleRows` memo; it does not get a second filtering path of its own.
  Getting this wrong means an edited job filtered off screen doesn't save.
- The "(N hidden)" button must count a row hidden by the tag filter too, and
  clicking it clears BOTH the search box and the tag back to "All tags".
- Display only: writes nothing, saves nothing, resets on every visit.
- A tag filter is a lookup. It never feeds bench choice, and it is not a sort.
- Not blast-radius: no `jobs[]`, `scheduledSlots`, `calendarSlot`, Supabase or
  `useGoogleCalendar` changes. If the build finds it needs one, stop and ask.

## Out of scope
- An Action dropdown, a status dropdown, or filtering on VB/BL/PJ.
- Multi-select — one tag at a time.
- The mobile sheet (`MobileJobSheet.jsx`), and search anywhere else in the app.
- The parked Sheet items (Enter-to-move-down, 30-min snap): separate work.

## Background, not the next step
`docs/briefs/2026-09-14-jobs-sheet-tag-filter.md` — where the ask came from.
`docs/briefs/2026-09-14-jobs-sheet-search.md` — the search box record.
