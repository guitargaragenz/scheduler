# Scope lock — a job taken off a day can go straight back on

doc_status: live

Built and tested, awaiting Trevor's "yp" to merge. One file, one filter.

## The problem

Taking a job off a day does not delete anything. An auto row appears BECAUSE
nothing is stored for it, so Remove stores a `hidden` "keep it off this day"
note instead. Nothing in the Daily Log has ever cleared that note — the only
clearing path is the Weekly Log (`App.jsx:867` -> `onBookedOnDay`). The picker
then filtered hidden ids out of what it offered, so the job could not be picked
to clear it either.

A job taken off a day was stuck off it from the DL's side, permanently. Against
Trevor's rule, 2026-08-23: *"if I take job off via DL or WL I should be able to
put it straight back on with no recourse"*.

## The fix

Stop filtering on `hidden` in the picker. That is the whole change.

Nothing has to delete the note: it is stored at `(date_key, item_id)` and
`addItem()` upserts on exactly that key, so picking the job REPLACES the note
with a real row. No second write, no window where both exist.

The filter is now `pickableOnDay(options, dayJobs)` — extracted so it can be
tested, and because a comment at `DailyLogPanel.jsx:323` already referred to a
`pickableOnDay()` that had stopped existing.

`hidden` is still used where it belongs: suppressing the auto row.

## Out of scope

No renaming (next job). No change to Remove, to `bookedOnDay()`, or to the
Weekly Log clearing path. Nothing written to `jobs[]`, `scheduledSlots`,
`calendarSlot` or `useSupabase.js`.

## Protocol

No blast-radius file touched — one component, display/selection only. Council
not run. 770 tests green, build clean; the regression test was confirmed to
fail on the old behaviour.
