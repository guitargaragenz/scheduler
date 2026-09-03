---
doc_status: live
---

# Handoff — mobile top bar overflows at phone width

Written 2026-09-04. One small display job, approved, not started.

## The job

On an iPhone the top bar runs off the right edge: the week date range shows as
"31 Aug – 6 Se…" and the arrows beside it get cut off. Trevor said yes to fixing
this on 2026-09-03, but flagged it explicitly as *not* the bug he was reporting
that day — it is a leftover follow-up, nothing depends on it.

Display only. No job data, no scheduled slots, no bench logic. It does not need
the full agent-team protocol.

## Where to look

The bar is rendered in `src/App.jsx`. Check it at 375px wide before changing
anything — reproduce first, then fix. Likely a fixed-width or non-wrapping row
that needs to shrink or wrap on narrow screens; verify against the live code
rather than assuming, the layout has moved since.

Check the fix on the Vercel preview at phone width, not just in a desktop
browser narrowed down.

## What shipped just before this, so it isn't re-diagnosed

- `33aaaa8` (2026-09-04) — Board page split rows read the wrong fields, so every
  row rendered as a bare "Electronics · h". Fixed; job 1520 now shows hours, the
  session number, and the note. **Done — do not revisit.**
- `0a0cc56` — a job with only a sub-bench (Wiring, Finishing) now shows under its
  primary bench in the Weekly Log.
- `b79b035` — Daily Log no longer makes a second heading for tasks booked via the
  Weekly Log.
- `0173d8f` — gear-type words removed from the Electronics keyword list.
- Job 1741 was showing 2 tasks instead of 3: one piece had `piece_done` set in
  Supabase. Cleared by hand, Trevor confirmed. No code change was needed.

## Binned, do not reinstate

A previous session left seven uncommitted edits reordering the bench lists to
add Finishing beside Wiring. Trevor binned them: *"I didn't really ask for that
in the first place."* The handoff describing them has been deleted. Bench
auto-allocation is correct as it stands, and Finishing and Wiring are set by
hand on purpose.

## Still open, nobody has picked it up

- Eight separate hardcoded bench lists, no single source of truth. Real, but a
  build of its own — not part of this job.
- Three test files error on a missing `jsdom` module. Environment only; the 676
  tests all pass.
