---
doc_status: live
---

# Scope lock — Board day list's chips and search work the same as the Board week list

Previous lock (header toggles) shipped at `a2259e9`, in git. DG ready-to-start is paused on branch `staging/dg-ready` (commit `3346c5a` + WIP).
Background only (don't follow unless this page can't answer a question):
[day-list-matches-week-list.md](../docs/briefs/day-list-matches-week-list.md).

Trevor, 2026-10-12: "both board day and week have seperate counts. They should be the same. Atm
board week is correct. Change board days Searches chips everything the same as board week."
Keep the counts on the day list's chips.

## Build — `src/components/JobShelf.jsx` (Board day list) to follow `Sidebar.jsx` (Board week list)
1. **Bench chips:** a bench chip lists, and counts, every unscheduled, not-done, top-level job whose
   `bench` is that bench — held-up jobs included, exactly as `Sidebar.jsx` `matchBench` (~127).
   Wiring/Finishing chips also take a parent whose sub-part is on that bench (Sidebar `SUB_ONLY_BENCHES`).
   Same benches, same order as the week list. Counts stay and must equal what clicking shows.
2. **Group chips:** replace the Waiting/Planning/Hold/In Transit piles with the week list's groups,
   same names, same rules: Backlog, 🔧 Parts Arrived, Waiting (`awaiting`), In Transit, On hold —
   from `Sidebar.jsx` ~90–101. Each chip counts and lists exactly that group. Hidden at zero.
3. **Inside a bench list:** cards grouped under the same headings the week list uses (Active,
   Parts Arrived, Backlog, Waiting, In Transit, On hold), in the same order.
4. **Search:** matches the same fields as the week list — job number, customer, make, model,
   bench, description, status, action (Sidebar `matchText` ~123).
5. Hours filter and Focus pill keep working the same as the week list.
6. Saved chip choice: an old saved value that no longer exists is cleared, not a dead filter.
7. Update `JobShelf.test.jsx`; add tests that day and week give the same job set for every bench,
   every group and a search, from one shared job list.

## Not in scope
- `Sidebar.jsx` behaviour does not change (it is the reference). No DG rule change — that brief
  is paused and will be re-checked after this ships.
- No edits to `jobs.js` rules, `useSupabase.js`, `utils/supabase.js`, `useGoogleCalendar.js`,
  `scheduledSlots`, `calendarSlot` or the `jobs[]` shape. Display only, no data writes.
- No change to card look, drag rules (`JobCard.jsx`), or the split-job part list just shipped.
- Day list still shows one chip's list at a time (no all-groups-at-once view).

## Binding rules
- No "no bench" bucket. Bench picked from the work, never the brand.
- `git add` specific files only. Staging branch `staging/day-matches-week`.

## Verifier checklist
In the background doc, section "Verifier checklist".
