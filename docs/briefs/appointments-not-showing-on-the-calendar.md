doc_status: live

# Appointments aren't showing up on the calendar

Reported by Trevor 2026-07-29, at the end of the Build 1b session, as an aside. **Nothing
has been changed** — this is a read-only investigation written up so the next session
starts with the suspects rather than the search.

**This is not part of Brief G Build 1b.** It touches `useGoogleCalendar.js`, which is a
blast-radius file. Do not fold a fix into `staging/brief-g-jobs-sheet-page`; it needs its
own branch and its own protocol run.

---

## What "appointments" means here

Google Calendar events that are **not** jobs the app scheduled. The app fetches them so
they block out slots and show as green `📅` blocks on the week grid. Customer bookings
made through Calendly are the main case — the fetch code says so in its own comment.

The app's own job events are filtered out on purpose: `CalendarGrid.jsx:203` skips any
event whose title starts with `#` and a number, because those are the ones it created.

## Ask Trevor first — these change which suspect is right

1. **Which appointments, and on which calendar?** Calendly ones, or ones he made by hand
   on the main `guitargaragenz@gmail.com` calendar?
2. **In Google Calendar itself, is that calendar's checkbox ticked?** Suspect 1 below
   turns on this answer alone.
3. **Are they all-day events, or timed?** Suspect 3 only affects all-day.
4. **Is the app still signed in to Google?** Suspect 2 hides everything and says nothing.
5. **Were they ever showing, and did they stop?** If they stopped, when — and did it line
   up with anything?

## Suspects, most likely first

### 1. Hidden calendars are silently excluded

`listEvents()` in `src/utils/googleCalendar.js:121` calls
`calendar.calendarList.list()` with no parameters. Google's default is
`showHidden: false` — **any calendar Trevor has unticked or hidden in the Google Calendar
UI is left out of that list entirely**, so its events are never fetched.

This is the best fit for the report: the whole reason that code walks every calendar
instead of just the main one is to pick up Calendly appointments living on a separate
calendar, and a separate calendar is exactly the kind that gets hidden by accident.

Fix, if confirmed: pass `showHidden: true` (and consider `minAccessRole: 'reader'`). One
line, but it changes what the poller sees, so it goes through the protocol.

### 2. Every failure looks identical to "no appointments"

Two places swallow errors:

- `Promise.allSettled` over the calendars (`googleCalendar.js:126`) drops any rejected
  calendar with `if (r.status !== 'fulfilled') return;` — **no log, no counter, no
  banner**. One calendar 403-ing looks exactly like it having no events.
- The outer `catch` returns `[]` after logging to the console.

So if a single calendar is failing, nothing on screen would ever say so. Worth adding a
count of failed calendars to the sync status regardless of what the root cause turns out
to be — this is why the problem went unnoticed long enough to become an aside.

### 3. All-day events land at midday, and multi-day events only show on day one

`CalendarGrid.jsx:204` does `new Date(ev.start?.dateTime || ev.start?.date)`. An all-day
event has no `dateTime`, only a date string like `2026-07-30`, and JavaScript parses that
as **UTC midnight** — which in New Zealand is midday the same day. So an all-day
appointment renders as a lunchtime block instead of covering the day.

Related, same line: `weekDays.find(d => d.toDateString() === start.toDateString())` matches
on the event's **start** day only. An event that began yesterday and runs into today shows
nothing today.

### 4. Only the visible week is fetched

The poller asks for `weekDays[0]` 00:00 to `weekDays[6]` 23:59
(`useGoogleCalendar.js:80-83`). Appointments outside the week on screen are not fetched
at all. Expected behaviour, not a bug — but if Trevor was looking at next week's booking
on this week's grid, that alone explains it.

### 5. The poller never clears

`useGoogleCalendar.js:89` only updates state when `events.length > 0`. A calendar that
genuinely empties leaves the last non-empty set on screen. That is the *opposite* of the
reported symptom, so it is not the cause — noted because anyone rewriting this block will
trip over it, and because a stale-looking grid is its own confusion.

## How to check it live

Signed in to the app, in the browser console:

```js
await (await import('/src/utils/googleCalendar.js')).listEvents(
  new Date(Date.now() - 864e5), new Date(Date.now() + 7 * 864e5)
)
```

If the missing appointment is in that array, the problem is in `CalendarGrid.jsx`
(suspect 3 or 4). If it is not, the problem is in the fetch (suspect 1 or 2) — then check
what `calendarList.list()` returns and whether the appointment's calendar is in it.

## Constraints

- Read-only investigation until Trevor has answered the questions above. **No fix on the
  Build 1b branch.**
- `useGoogleCalendar.js` is a blast-radius file — brief, council, builder, verifier.
- Do not touch the bump-and-persist path while chasing a display bug. Whatever the fix,
  it should not change which jobs get moved.
