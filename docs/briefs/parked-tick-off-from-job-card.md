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

## Questions for Trevor before a brief
1. Ticking off WP clears `action` to blank — or sets it to something else?
2. Which other marks belong on the card: other action codes, and/or VB / BL / PJ?
3. Workshop rule: BL and WP can't coexist — should ticking WP on ever touch BL?
4. Does the Parts Arrived banner go away on its own once WP is cleared? (Check.)
