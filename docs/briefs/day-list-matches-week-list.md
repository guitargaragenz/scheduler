---
doc_status: closed
---

# Board day list matches the week list — background

Scope lock: [.claude/pending-brief.md](../../.claude/pending-brief.md). Background only.

## Why (found 2026-10-12)
Trevor saw different numbers for the same jobs on the Board day list and the Board week list. The
week list is right. While chasing DG jobs he could not see as free, the cause turned out to be
that the two lists sort jobs by different rules:

- **Week list** (`Sidebar.jsx`): bench chip = every job saved on that bench (`matchBench` ~127),
  held-up ones included; groups built from `schedulable`/`awaiting`/`inTransit`/`backlog`
  (~90–101); search covers job, customer, make, model, bench, description, status, action (~123).
- **Day list** (`JobShelf.jsx`): bench chip drops anything `blockedPile()` calls blocked (~115,
  ~156); blocked jobs only appear under Waiting/Planning/Hold/In Transit piles (~12–17, ~120);
  search covers customer, make, model only (~150).

So a DG job saved on Electronics shows under Electronics in week, but only under "Planning" in day.

## Paused work
`staging/dg-ready` holds the DG ready-to-start brief and a half-built change (tests not updated).
Once this ships, re-check whether DG still needs its own rule change or the 🔍 To Diagnose chip.

## Verifier checklist
1. Every bench chip's count equals the number of cards it lists, and equals the week list's
   bench filter result (unscheduled, not done, top-level).
2. A held-up job (e.g. DG, On Hold, Waiting) saved on Electronics appears under the Electronics chip.
3. Wiring/Finishing chips include parents with a sub-part on that bench, as in the week list.
4. Group chips are Backlog, 🔧 Parts Arrived, Waiting, In Transit, On hold; each matches the week
   list's group exactly; hidden at zero. The old Planning pile is gone.
5. Inside a bench list, cards sit under the week list's headings in the week list's order.
6. Search for a description word, a status and an action code finds the same jobs as the week list.
7. Hours filter and Focus pill give the same result as the week list.
8. An old saved `pile:*` chip value on reload is cleared, the list opens clean.
9. No diff outside `JobShelf.jsx` and its test (plus the two brief files). Full test suite passes.
10. Browser: Board day vs Board week, same bench → same jobs, same counts.

Closed 2026-10-12. Search fix shipped at `049b7e9` (PR #94); chips/DG difference moved to dg-ready-to-start.md.
