---
doc_status: live
---

# Bench view — background

Written 2026-08-13. The scope lock is `.claude/pending-brief.md`; **that** is what binds the
build. This page is background: where the design came from, and the marker reference.

## Where this came from

Trevor plans his real week in a bullet journal using the Alistair method — a two-page spread.
Left page: the week's jobs, grouped by bench, with day columns beside them. Right page,
written the night before: appointments, tasks, and roughly 3–5 job sessions he chooses
himself depending on how long each takes. Jobs are split out the same way the app already
splits them.

The pivot is **not** dropping planning. It is dropping the *app* deciding the schedule.
Trevor picks; the app records and remembers. Scheduling code is parked in place, switched
off and reversible — nothing is deleted.

He confirmed a photo of a real Alistair-method week page as the target layout: one list of
items with M-through-F columns, marked per day.

## Marker reference

| Marker | Meaning |
|---|---|
| `·` | booked for that day |
| `/` | worked that day |
| `>` | not worked — move to next available day |
| `×` | done |

Day columns run M T W T F S S, then a final `>` column. That last column takes `×` (finished
this week) or `>` (carry to next week).

## Reused, not rebuilt

The jobs list, the benches, job splitting, the done tick and the revenue pipeline all stay as
they are. `BenchBoardPage.jsx` and `JobShelf.jsx` already exist and are the starting point —
the builder should read them before proposing anything new.

## Split into two builds (2026-08-13)

Trevor's call, after council: the week page and the day page ship as two builds in two
sessions. The week page is independently useful and is Build 1.

### Build 2 — the day page (parked, not yet scope-locked)

Tomorrow's page, containing:

- **Appointments**, read-only from Google Calendar.
- **Tasks** — free text, typed by Trevor.
- **Jobs** — Trevor types a job number, the app shows that job's existing splits, he picks
  which ones go on the day. 3–5 typical, no cap enforced. **Splits are marked done here**,
  never on the week page.
- Ticking a session done feeds the existing done/revenue path unchanged.
- Day pages are **kept and saved** — logged once the week is finished, and searchable.
- Mobile: one page at a time, week and day switched between, not side by side.

The read path exists: `listEvents()` in `src/hooks/useGoogleCalendar.js` is already a pure
read.

## Council record — 2026-08-13, two independent reviewers

Both returned **GO WITH CHANGES**. Nothing blocking. What they found, and what was done:

1. **The calendar hook is not read-only today.** `useGoogleCalendar.js` runs a 30-second poll
   that reads the calendar and then *writes* — bumping conflicting jobs to new slots via
   `persistMove`. It starts as soon as `signedIn` is true. "The app never decides a schedule"
   breaks on day one unless that poll is disabled. → Now a binding rule in the scope lock.
2. **Marker state had nowhere to live.** No existing table or column fits. Overloading
   `jobs[]` or `scheduledSlots` would collide with the parked scheduler and the GCal sync.
   → Own table, keyed by job and date. Binding rule.
3. **Marker granularity.** Reviewer 1 argued marks should attach to each bench card, since
   `joinJobs.js` gives a job several split cards per week. **Trevor overruled this:** the week
   page is one row per job. Splits are marked on the day page only; the week row shows `/`
   while parts are worked and `×` on the day the final part lands. Recorded because the
   council reasoning reads convincingly and should not be re-litigated next session.
4. **The glue rule is unenforceable.** Nothing in the splits data flags a glue step, so the
   app cannot police the 12-hour gap. Trevor maintains it himself. → Stated plainly in the
   scope lock so no builder invents a fake check.
5. **Day-page picks could balloon into new persisted state.** → Build 2 must say where they
   live before that build starts.
6. **Blast radius is low.** `BenchBoardPage.jsx` writes nothing today; mobile single-page is
   an existing pattern (`MobileJobSheet.jsx`, `JobsPage.jsx`, `DailyLogPage.jsx`), not new
   architecture. Backing the whole thing out is deleting or hiding a route.
