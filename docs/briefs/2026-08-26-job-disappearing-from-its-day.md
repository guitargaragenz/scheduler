---
doc_status: live
---

# A job disappears from its day in the Daily Log — again

Reported by Trevor 2026-08-26, right after the Daily Log UI work shipped
(PR #51). His words: "job disappearing from same day back again".

## What is known

- It has happened before. On 2026-08-25 job 1679 vanished from its day and
  was traced to the closed-job / departure path; that fix shipped as PR #46.
  It is back, so either that fix does not cover this case or the cause was
  never the same one.
- Which job, and which day, is NOT recorded yet. Get that first — it decides
  everything below.

## Check these first, against the LIVE code

Documents describe the past. Verify every claim here before acting on it.

1. `DailyLogPanel.jsx` — `dayJobBlocks` (~:647). A row whose job is no longer
   in `jobs[]` still has a stored day row, but `jobById.get(row.id)` answers
   undefined. Follow what renders in that case.
2. `dayJobs` / `bookedOnDay()` — what drops a row that IS stored on the day.
3. `latestDayMarks()` + the picker filter shipped in PR #49: a row crossed off
   is no longer OFFERED, but must still SHOW on the day it is on. Confirm the
   filter has not leaked into what is displayed.
4. Whether the job went `done`, closed, or left the Multitrack CSV that day —
   the 1679 shape.

## Rules that bind any fix

- A day is a record of what happened. A finished or closed job must keep its
  row on the day it was worked; hiding it erases the record.
- The picker filters. `bookedOnDay()` deliberately does not.
- `useSupabase.js`, `scheduledSlots`, `calendarSlot` and the `jobs[]` shape are
  blast-radius: full agent-team protocol, brief approved before any commit.

## Shipped just before this, for context

- PR #47 `Task ▾` picker · PR #49 crossed rows stop being offered
- PR #51 Daily Log look: white bold job name, bench chips on the pieces
