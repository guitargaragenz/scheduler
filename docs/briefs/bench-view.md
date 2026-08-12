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

## Open at time of writing

Appointments come from Google Calendar, read-only. Whether the app already holds a usable
read path or needs one is for the builder to establish against the live code.
