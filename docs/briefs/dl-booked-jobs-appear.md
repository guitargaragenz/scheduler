---
doc_status: closed
---

# Brief — Daily Log: booked jobs appear on their day (2026-08-19)

**Shipped and merged to main at `62b760b` (PR #27), 2026-08-19.** Includes the follow-up fix
in PR #26: the build had dropped `setMark={weekMarks.setMark}` from `<BenchWeekPage>` in
`App.jsx`, which left the Weekly Log day columns silently dead. A source-level wiring test
(`src/components/BenchWeekPage.wiring.test.js`) now fails if that prop goes missing again.

Background and code references for the scope lock at `.claude/pending-brief.md`.
The lock is the thing to build from; this file is the reasoning behind it.

## Where this came from

Trevor, 2026-08-19: *"WL job appears in day booked in DL. DL has the job as the
primary with the same dropdown as the Day view board menu where I can add
benches/ splits etc, only there is no time scheduler."*

Then, after seeing that the split editor already exists on the day view:
*"leave out the edit splits and benches etc bc it's already there in day view and
we don't need duplication but can I use the day view dropdown in DL w/o the
edits/schedules?"*

So the build narrowed to: **the job turns up on its booked day, its parts are
listed, and nothing is editable here.** The editing stays on the day view.

## Code the build turns on — read live 2026-08-19

- `BenchWeekPage.jsx:254-259` — how the Weekly Log decides a job is booked on a
  day. It walks `[job, ...parts]`, takes `slotDateKey(p.calendarSlot)`, and keeps
  the keys that fall inside the week. The Daily Log should read the same field
  the same way, for one day instead of seven.
- `DailyLogPanel.jsx` → `dayJobOptions()` — already builds the per-split option
  list (`1711 Gibson Les Paul Standard — Electronics`). The parts list this build
  needs is that same list, filtered to the shown day.
- `JobDrawer.jsx` — the day view's bench/split editor. **Deliberately not reused
  here.** Saving from it writes children into `jobs[]`, which is blast-radius.
- `useDayMarks.js` → `removeItem()` — how a job comes off a day today. An
  auto-appearing job has to respect a removal, or Remove does nothing.

## The thing that surprised Trevor, worth keeping

**Splits belong to the job, not to a day.** Adding a bench to a job changes it
everywhere, including which days it shows on in the Weekly Log — "add a split on
Tuesday" can make the job appear on Thursday. That is why the editing was cut
from this build rather than moved into it.

## Not this build

The interactive status symbols on the Daily Log (`·` `/` `>` `×`, clickable like
the WL) are a separate, undecided item. A read-only dot is built and unmerged on
PR #25. Making them clickable **and saved** needs a mark field on
`bench_day_marks`, whose write lives in `utils/supabase.js` — blast-radius, so
that version is full-protocol work. Trevor has not decided whether the marks need
to persist across reload/devices.
