---
doc_status: parked
---

# Parked — tick off WP (and other Sheet marks) from the job card

Written 2026-09-14. **Not scoped, not approved.** A handoff so the idea isn't lost.

## The idea
Trevor wants to clear WP from the job card itself (e.g. parts arrived) instead of
going to the Jobs Sheet. He also asked what else on the Sheet could be tapped off
the same way.

## What is true in the code today (checked 2026-09-14 — re-check before acting)
- WP is not its own field. It is one value of the single `action` field on a job
  (`ACTION_OPTIONS` in `src/data/jobsSheet.js:51`: GTS, INC, CI, RS, RS-C, DG, WP, FB).
- `src/data/jobs.js:224-241` already reads WP to spot jobs Multitrack no longer
  calls stuck; `PartsArrivedBanner` surfaces them.
- The Sheet also has VB / BL / PJ tick boxes.
- Job card component: `src/components/JobCard.jsx`.

## Why this is blast-radius
Clearing a mark from the card writes job state (the `jobs[]` shape, saved through
the Supabase layer). Full protocol applies: brief → council → builder → verifier →
browser test → "yp".

## Trevor's answers (2026-09-14)
1. Ticking off just clears the mark (WP → blank `action`).
2. Only marks that hold a job up: WP, CI, INC, RS-C, DG, VB, BL (confirmed).
   Not GTS, RS, FB or PJ.
3. Ticking off WP never touches BL.
4. Yes — the Parts Arrived banner should clear once WP is cleared. Verify it does.

Next step: write the scope lock from these answers, get "yp", run the protocol.
