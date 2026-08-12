---
doc_status: live
---

# Scope lock — bench view: week page + day page

Replaces the scheduler's automatic day-planning as the main way Trevor works. Background and
the design conversation are in [docs/briefs/bench-view.md](../docs/briefs/bench-view.md) —
**background only, do not open it to start the build.**

Trevor picks the jobs. The app never decides a schedule.

## In scope

**Week page** — this week's jobs, grouped by bench, showing **just the job name** (eg
`1714 Fender Strat`). Columns across the top: M T W T F S S, then a final `>` column.
Each cell holds one bullet-journal marker — `·` booked, `/` worked that day, `>` not worked
so move to the next available day, `×` done. The trailing `>` column takes `×` (finished this
week) or `>` (carry to next week).

An `×` in any day column **automatically** puts an `×` in the trailing column too, and draws
a line joining the two — striking the row through from that day to the end. Trevor never
marks the last column by hand for a finished job.

**Day page** — tomorrow, containing:
- **Appointments**, pulled **read-only** from Google Calendar. The app must never create,
  edit or delete a calendar event.
- **Tasks** — free text, typed by Trevor.
- **Jobs** — Trevor types a job number, the app shows that job's existing splits, he picks
  which ones go on the day. 3–5 typical, no cap enforced.

**Ticking a job session done feeds the existing done/revenue path unchanged.**

Mobile: one page at a time, week and day switched between — not side by side.

## Out of scope

Automatic scheduling or slot-filling of any kind · deleting or ripping out the existing
scheduling code (it stays in place, switched off) · writing to Google Calendar · new revenue
logic · invoice capture · any change to how a job's splits are defined.

## Rules that bind

- **Nothing is deleted.** The scheduling side is parked and reversible, not removed.
- Google Calendar access is **read-only**. No writes, ever.
- A job number reappearing is live work by definition — a completed job never comes back.
- Glue-ups need 12 hours before dependent work on the same guitar; the day page must not
  present a glue session and its follow-on for the same day.
- Full protocol: council → staging branch → `ggnz-verifier` → browser test → Trevor
  approves the merge.
