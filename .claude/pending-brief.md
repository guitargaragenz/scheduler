---
doc_status: live
---

# Scope lock — Header: two toggle buttons (Board, Log) replace four page buttons

## Why
Saving header room. Trevor approved the design from a tappable mockup, 2026-10-04.

## Build
In `src/App.jsx` header, replace the "W Log", "D Log", "Day View/Week View" and "Board"
buttons with two:
- **Board** — label "Board · Day" or "Board · Week" (from `showWeekView`).
- **Log** — label "Log · W" or "Log · D" (new state: last-used log, default W).
- Tap the one you're NOT on → opens that page in its last-used view.
- Tap the one you ARE on → flips Day↔Week (Board) or W↔D (Log).
- Lit up exactly as the current buttons are (`onBoard`, `showWeekPage || showDayPage`).
- App still opens on the Weekly Log.

## Out of scope
The pages themselves (Board, Weekly Log, Daily Log, Day/Week views) — kept as they are.
Other header buttons (Sync, Google, Jobs, Bench, etc.). Any saved data. `scheduledSlots`,
`calendarSlot`, `useGoogleCalendar.js`, `useSupabase.js`, `utils/supabase.js`, `jobs[]` shape.

## Binding rules
- Not blast-radius: header UI only, no Supabase call, no write. Built in the main
  conversation (one-file edit, not delegated).
- Reuse `selectPage()` and `setShowWeekView`; no new page flags.
- Files: `src/App.jsx` only.
- Browser test on phone: header shows two buttons, no wrap; each tap rule above works;
  reload opens on Log · W.
