# Handoff — Brief F, "Waiting" chip on the bench-picker row

**Date:** 2026-07-27
**Status:** Brief drafted, awaiting Trevor's "yp" to approve. Nothing built, nothing committed.
**Where the brief lives:** [.claude/pending-brief.md](../../.claude/pending-brief.md)

---

## Where this session left off

Brief E (job blocking) shipped and merged to `main` this session — rounds 1–3 complete, all six
round-3 items built, verified, browser-tested, merged with Trevor's "yp".

After merge, Trevor looked at the live app and pointed out a real gap: the main bench-picker screen
(`JobShelf.jsx` — the chip row showing Setup/Luthier/Electronics/Fretwork/Wiring/Finishing/Admin
counts) has no way to see blocked jobs at all. Brief E moved blocked jobs into Waiting/Planning piles
visible in the Sidebar and Jobs page, but never surfaced them on this screen — the one Trevor actually
uses to decide what to work on next.

Trevor's first instinct was to repurpose Admin for this. Talked it through — repurposing Admin
would undo the thing Brief E just fixed (Admin becoming a dumping ground). Landed on a smaller idea
instead: add a **"Waiting" chip** (possibly a second "Planning" chip) to the same row as the real
bench chips — same interaction, click to filter, but read-only and not a real bench.

**Brief F is now drafted** in `.claude/pending-brief.md`, replacing Brief E's now-shipped content.

## Next session should

1. Get Trevor's answer on the one open question: **one chip ("Waiting") or two (split Waiting/Planning
   to match the Sidebar's two piles)?**
2. Once decided, run the rest of the agent-team protocol from Council onward — brief is drafted,
   nothing else has started.

## Key facts for the builder (from this session's research pass)

- Chip row lives in `src/components/JobShelf.jsx:185-204`, driven by `benchCounts` (`JobShelf.jsx:68-71`),
  filtering `topLevel` (already-filtered job list, `JobShelf.jsx:58-66`) by `job.bench === bench`.
- `blockedPile` is **not currently imported** into `JobShelf.jsx` — will need adding from `../data/jobs.js`.
- The new chip must NOT be added to `BENCH_ORDER` or treated as a real bench anywhere downstream —
  it's a separate, parallel count sourced from `blockedPile()`, not `job.bench`.
- Cards reached via this chip should already be non-draggable (built in Brief E round 3 at the
  card level) — this chip is just a new entry point to existing card behavior, not new card logic.

## Full context

See [.claude/pending-brief.md](../../.claude/pending-brief.md) for the full drafted brief (scope,
out-of-scope list, why it needs the protocol, method).
