---
doc_status: parked
---

# Follow-up Brief — the Sidebar's three buckets don't match `blockedPile()`'s four piles

**Status:** BACKLOG. Not started. Raised by Council during Brief F, 2026-07-27.
**Re-checked against live code 2026-07-29 — most of it was already fixed. Scope cut accordingly.**

---

## What's already been fixed since this was written

Three of this brief's four original findings no longer reproduce. Verified 2026-07-29:

- **The wording is aligned.** The Sidebar reads `📞 WAITING` (`Sidebar.jsx:285`), not
  `AWAITING`. Trevor's "Waiting, not Awaiting" call has landed.
- **Membership no longer diverges between screens.** `useSupabase.js:43` now folds
  `blockedPile()` into `schedulable` itself, with a comment at `:37-41` saying exactly why. So
  the Sidebar, the Jobs page and the bench row all inherit one rule — the original complaint
  that "three screens give one job three different answers" is closed.
- **The worked example is dead.** This brief used to claim a `Waiting` + CI job shows as
  *Waiting* on the bench row but *AWAITING* in the Sidebar. Both now say Waiting, and
  `deriveJobStatusFlags` at `jobs.js:203` puts exactly that case in `awaiting` anyway.

The old line reference `jobs.js:116-127` has also drifted — `blockedPile()` is at
**`src/data/jobs.js:123`**.

---

## What's actually left — one real mismatch

`blockedPile()` returns **four** piles (`jobs.js:126-135`):

| Pile | Rule |
|---|---|
| `planning` | action is INC / RS / RS-C — regardless of status |
| `hold` | status `On Hold` |
| `transit` | status `In Transit` |
| `waiting` | status `Waiting` |

The Sidebar shows **three** sections (`Sidebar.jsx:73-75`), and they run on the older
`deriveJobStatusFlags` booleans, not on `blockedPile()`:

| Section | Rule |
|---|---|
| `📞 WAITING` | `j.awaiting` — status `Waiting` **and** action INC or CI |
| `📦 IN TRANSIT` | `j.inTransit` |
| `🔒 ON HOLD` | everything else not schedulable — the catch-all |

**The consequence:** `ON HOLD` is a bin, not a category. A `Booked In` + `INC` job is
**Planning** on the bench row and lands under **🔒 ON HOLD** in the Sidebar. So does a
`Waiting` + `GTS` job — which is `waiting` to `blockedPile()` but fails the Sidebar's stricter
`awaiting` test because GTS isn't INC or CI. Jobs 1268, 1679 and 1705 are all in that state
right now. Nothing is *wrong* on screen; jobs are just filed under a heading that doesn't
describe them.

`JobsPage.jsx:150` sidesteps this entirely by lumping everything into one **"Waiting / On
Hold"** row. That reads fine and is arguably the honest answer — worth deciding whether the
Sidebar should follow it rather than the other way round.

---

## Rough scope when picked up

- Decide the question this really turns on: **does the Sidebar need a Planning section, or
  should it collapse to the Jobs page's single blocked list?** Everything else follows.
- Whichever way that goes, migrate `Sidebar.jsx:73-75` onto `blockedPile()` so the sub-split
  stops being a second rule.
- Decide whether In Transit stays as its own section or folds into Waiting.

**Blast radius:** changes what jobs appear under which heading in the Sidebar. Full agent-team
protocol, not a patch.

**Dependency note:** the Brief F dependency at the top of the old version is spent — Brief F
shipped. There is no build blocking this one.
