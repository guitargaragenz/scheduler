---
doc_status: live
---

# Scope lock — clear a hold-up mark from the job drawer (DRAFT, awaiting Trevor's "yp")

Background only (don't follow unless this page can't answer a question):
[parked-tick-off-from-job-card.md](../docs/briefs/parked-tick-off-from-job-card.md). Facts below
re-checked against live code 2026-10-04.

## Build
In the job drawer (desktop) and job sheet (phone), a **"Holding this job up"** block lists
whichever hold-up marks the job carries, each with a **Clear** button:
- Action values **WP, CI, INC, RS-C, DG** — Clear sets `action` to blank.
- **VB** and **BL** — Clear sets that flag false.

Clearing one mark never touches another (WP never touches BL). After a clear, the job's
Planning / Waiting / Ready pile re-derives at once (reuse `applySheetEdits` + `statusFlagsFor`).
The Parts Arrived banner clears when WP is cleared (verify, don't assume).

## Out of scope
GTS, RS, FB, PJ and VB/BL being *set* from the card. Tag and hours. Any Sheet change. The
PDF import. Bulk clearing. Changing what any mark means.

## Binding rules
- Writes through the existing `batchWriteJobsState` — **no new write path** (the Jobs Sheet's
  Commit already uses it with the same fields).
- A job is never Backlog and Waiting Parts at once; clearing must not create that.
- Blast-radius: touches `jobs[]` fields and the Supabase save → full agent-team protocol.
- Files expected: `JobDrawer.jsx`, `MobileJobSheet.jsx`, `App.jsx` (handler), `jobsSheet.js` (reuse).

## Open question for Trevor
Put the block in the drawer/sheet (recommended), or tap the ⚠/⭐ badge on the card itself?
