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
2. ~~**In Google Calendar itself, is that calendar's checkbox ticked?**~~
   **Answered 2026-07-29: yes, ticked and visible.** Rules out the hidden-calendar suspect.
3. **Are they all-day events, or timed?** Suspect 4 only affects all-day.
4. **Is the app still signed in to Google — is there a blue "Connect Google" button in
   the top bar?** This is now the decisive question. See suspect 1.
5. **Were they ever showing, and did they stop?** If they stopped, when — and did it line
   up with anything?

## Suspects, most likely first

### 1. The app is signed out of Google after every page load

**Trevor confirmed 2026-07-29 that the calendar is ticked and visible in Google Calendar,
which rules out the previous number 1 (kept below as number 2). This replaced it.**

The Google access token lives **only in memory**. `googleCalendar.js` has no
`localStorage` or `sessionStorage` — nothing is written, nothing is read back. On load,
`initGoogleApi()` runs and then `setSignedIn(isSignedIn())`, and `isSignedIn()` just asks
`gapi.client.getToken()?.access_token`, which on a fresh page is empty because no token
was ever set in this page's memory.

`requestAuth()` — the only thing that gets a token — is called from exactly one place:
`handleSignIn()` at `useGoogleCalendar.js:481`, wired to the **Connect Google** button.
**There is no automatic silent re-auth on startup**, even though `requestAuth()` already
supports the silent `prompt: ''` path and would need no consent popup to use it.

The consequence: the poller's first line is `if (!signedIn) return;`
(`useGoogleCalendar.js:78`), so after every reload **no events are fetched at all** until
Trevor clicks Connect. Tokens also expire after about an hour, and the 401 handler clears
them (`clearStaleTokenIfAuthError`), so a long-open tab goes dead mid-session too.

**This fits the report better than anything else** — the calendar is fine, Google is fine,
the app simply isn't asking.

**One-second check, and it decides this:** look at the top bar. A blue **Connect Google**
button means signed out (`App.jsx:449`). If the button is there, this is the answer. If
he is showing as connected and the appointments are still missing, this is ruled out and
it is one of the suspects below.

**The fix, if confirmed:** on startup, after `initGoogleApi()` succeeds, attempt a silent
`requestAuth()` — `prompt: ''` — and only fall back to the button if it fails. That is a
real behaviour change on a blast-radius file (a token appearing on load makes the poller
start writing bumps), so it goes through the protocol, and it needs deciding whether
auto-reconnect is even wanted or whether Trevor prefers to connect deliberately.

### 2. Hidden calendars are silently excluded — **ruled out 2026-07-29**

Trevor confirmed the calendar is ticked and visible, so it is neither hidden nor
unselected and `showHidden` is not the problem. Kept because the underlying gap is still
real and cheap to close while the file is open.

`listEvents()` in `src/utils/googleCalendar.js:121` calls
`calendar.calendarList.list()` with no parameters. Google's default is
`showHidden: false` — **any calendar Trevor has unticked or hidden in the Google Calendar
UI is left out of that list entirely**, so its events are never fetched.

The reason it was first pick: the whole point of that code walking every calendar instead
of just the main one is to pick up Calendly appointments on a separate calendar, and a
separate calendar is the kind that gets hidden by accident. Trevor's answer says his
isn't.

Fix, whenever the file is next open: pass `showHidden: true` (and consider `minAccessRole: 'reader'`). One
line, but it changes what the poller sees, so it goes through the protocol.

### 3. Every failure looks identical to "no appointments"

Two places swallow errors:

- `Promise.allSettled` over the calendars (`googleCalendar.js:126`) drops any rejected
  calendar with `if (r.status !== 'fulfilled') return;` — **no log, no counter, no
  banner**. One calendar 403-ing looks exactly like it having no events.
- The outer `catch` returns `[]` after logging to the console.

So if a single calendar is failing, nothing on screen would ever say so. Worth adding a
count of failed calendars to the sync status regardless of what the root cause turns out
to be — this is why the problem went unnoticed long enough to become an aside.

### 4. All-day events land at midday, and multi-day events only show on day one

`CalendarGrid.jsx:204` does `new Date(ev.start?.dateTime || ev.start?.date)`. An all-day
event has no `dateTime`, only a date string like `2026-07-30`, and JavaScript parses that
as **UTC midnight** — which in New Zealand is midday the same day. So an all-day
appointment renders as a lunchtime block instead of covering the day.

Related, same line: `weekDays.find(d => d.toDateString() === start.toDateString())` matches
on the event's **start** day only. An event that began yesterday and runs into today shows
nothing today.

### 5. Only the visible week is fetched

The poller asks for `weekDays[0]` 00:00 to `weekDays[6]` 23:59
(`useGoogleCalendar.js:80-83`). Appointments outside the week on screen are not fetched
at all. Expected behaviour, not a bug — but if Trevor was looking at next week's booking
on this week's grid, that alone explains it.

### 6. The poller never clears

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
(suspect 4 or 5). If it is not, the problem is in the fetch (suspect 1 or 3) — then check
what `calendarList.list()` returns and whether the appointment's calendar is in it.

## Constraints

- Read-only investigation until Trevor has answered the questions above. **No fix on the
  Build 1b branch.**
- `useGoogleCalendar.js` is a blast-radius file — brief, council, builder, verifier.
- Do not touch the bump-and-persist path while chasing a display bug. Whatever the fix,
  it should not change which jobs get moved.
