---
doc_status: parked
---

# Follow-up Brief — align blocked-job naming and rules across all three screens

**Status:** BACKLOG. Not started, not scoped in detail. Raised by Council during Brief F, 2026-07-27.
**Depends on:** Brief F ("Waiting"/"Planning" chips on the bench-picker row) shipping first.

---

## Plain-English summary

The same stuck job gets called three different things depending on which screen you're looking at,
and the three screens don't even agree on *which* jobs are stuck. Brief F adds the words "Waiting"
and "Planning" to the bench row. That's the first time those words appear anywhere in the app — so
after Brief F ships, the mismatch is visible rather than just latent.

**Trevor's decision (2026-07-27): the label is "Waiting", not "Awaiting".** Everything aligns to
"Waiting".

## The three variants as they stand today

| Screen | Sections shown | Rule it runs on |
|---|---|---|
| Sidebar (`Sidebar.jsx:73-75`) | `📞 AWAITING` / `📦 IN TRANSIT` / `🔒 ON HOLD` (`:285,295,305`) | old `deriveJobStatusFlags` booleans — `j.awaiting`, `j.inTransit`, `!j.schedulable` |
| Jobs page (`JobsPage.jsx:35-36`) | one lumped **"Waiting / On Hold"** (`:150`) | `j.schedulable` |
| Bench row (Brief F) | **Waiting** / **Planning** | `blockedPile()` (`jobs.js:116-127`) |

None of Sidebar or JobsPage calls `blockedPile()`.

## Why it matters

Membership diverges, not just wording. A `Booked In + INC` job is **Planning** on the bench row but
lands in the Sidebar's **ON HOLD** bucket. A `Waiting`-status job with CI is **Waiting** on the bench
row but **AWAITING** in the Sidebar. Two screens, one job, different answers — the exact class of bug
the comment at `jobs.js:22-26` says Brief E existed to kill.

## Rough scope when picked up

- Settle the canonical pile set and names — starting point: `blockedPile()`'s `waiting` / `planning`,
  with **"Waiting"** as the user-facing word (Trevor's call, above).
- Migrate Sidebar and JobsPage onto `blockedPile()` so all three screens share one rule.
- Decide whether the Sidebar's In Transit / On Hold detail is worth keeping as a sub-split or folds
  into Waiting.

**Blast radius:** touches `Sidebar.jsx` and `JobsPage.jsx` and changes what jobs appear where — this
one needs the full agent-team protocol, not a patch.
