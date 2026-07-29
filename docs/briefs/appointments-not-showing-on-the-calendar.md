doc_status: parked

# Appointments aren't showing up on the calendar

Reported by Trevor 2026-07-29, at the end of the Build 1b session, as an aside. **Nothing
has been changed** — this is a read-only investigation written up so that whenever this is
picked up, it starts with the suspects rather than the search.

**Parked 2026-07-29 by Trevor:** *"Appointments and UI can wait until everything's rock
solid."*

**Sequencing made firm the same day, after Build 1b merged (`f2ee449`)** — his words:
*"save all UI changes until after PDF drop implemented successfully and CSV pipeline gone"*.
So this waits on **Build 1c** (the JBA drop, importing successfully) and then **Build 2**
(the CSV pipeline retired) — in that order, then his go-ahead. It is not a judgement call
for a future session and it is not a quick win to slot in while 1c waits for council.

When he does say go, it is a fresh brief at protocol step 1, because
`useGoogleCalendar.js` is a blast-radius file.

**Two suspects were killed before it was parked**, so don't re-tread them. Trevor's words:
*"I already know that as I have been running the app for quite a while now. No all day
appointments either."*

- **Suspect 1 (signed out after every reload) — ruled out.** He has been running the app
  connected. The underlying gap is still real (no silent re-auth on startup, token is
  memory-only) and worth fixing on its own merits, but it is not what he is seeing.
- **Suspect 4 (all-day events landing at midday) — ruled out.** He has no all-day events.
- **Suspect 2 (hidden calendars) — ruled out earlier**, the calendar is ticked and visible.

That leaves **3** (per-calendar failures swallowed silently), **5** (only the visible week
is fetched), and one thing not written up as a suspect below: the `#\d+` title filter at
`CalendarGrid.jsx:203`, which drops any event whose title starts with a hash and a number.

**Stop reasoning from the code and get real data.** Three code-reading rounds have
produced three suspects and killed all three. The next move is the console snippet in
"How to check it live" — see what `listEvents()` actually returns while an appointment is
missing from the grid.

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
3. ~~**Are they all-day events, or timed?**~~ **Answered: none are all-day.** Rules out
   suspect 4.
4. ~~**Is the app still signed in to Google?**~~ **Answered: yes, he runs it connected.**
   Rules out suspect 1. Don't ask him this again — he pushed back on it once already,
   fairly, because he'd been running the app for weeks.
5. **Were they ever showing, and did they stop?** If they stopped, when — and did it line
   up with anything?

## Suspects, most likely first

### 1. The app is signed out of Google after every page load — **ruled out 2026-07-29**

**Trevor runs the app connected and has done for weeks, so this is not the cause.** Kept
because the gap it describes is real and cheap to close while the file is open — but it is
not the bug, and the "one-second check" below has already been done.

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

That is why it looked like the best fit. It isn't: Trevor is connected and the
appointments are still missing.

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

### 4. All-day events land at midday, and multi-day events only show on day one — **ruled out 2026-07-29**

Trevor has no all-day events, so the first half of this can't be it. **The second half —
multi-day matching on the start day only — is not ruled out** and stays live.

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

If the missing appointment **is** in that array, the problem is in `CalendarGrid.jsx` —
the `#\d+` title filter at line 203, the start-day-only match, or the week window. If it
is **not**, the problem is in the fetch (suspect 3) — then check what
`calendarList.list()` returns and whether the appointment's calendar is in it, and log the
rejected entries from `Promise.allSettled` instead of dropping them.

## Constraints

- **Parked.** Nothing starts here until Brief G Build 1b is merged and Trevor says go.
- Read-only investigation. **No fix on the Build 1b branch.**
- `useGoogleCalendar.js` is a blast-radius file — brief, council, builder, verifier.
- Do not touch the bump-and-persist path while chasing a display bug. Whatever the fix,
  it should not change which jobs get moved.
