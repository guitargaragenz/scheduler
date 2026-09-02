doc_status: parked

# Drawer bench change is dropped on split jobs

Found 2026-09-03, diagnosing job 1727 (Hohner ST 59, Liam Jolly).

## What Trevor saw

1727 sat on the Admin bench. He opened the job drawer, changed the bench to
Setup, saved — and the main bench still showed Admin.

## What is actually happening

1727 is split into two cards. Both children (`1727_Setup_0`, `1727_Setup_1`)
carry `bench: 'Setup'`. The parent row `1727` still carries `bench: 'Admin'`,
and the parent is what the board shows.

`handleSaveDrawer` (`src/hooks/useJobs.js:135`) only ever persists a bench on
the **single-card** path — the un-split branch, which writes it to jobsMaster
explicitly as the deliberate app-side override (`useJobs.js:255`). The
multi-card branch writes the children and never touches the parent's bench.
The child branch (`isSubtask || isDerived`) persists only `sessionNote`.

So on any split job the drawer's bench dropdown looks like it worked and
silently reverts.

Why 1727 was on Admin in the first place is separate and correct-as-designed:
it was Waiting Parts when imported, `inferBench()` stamps `'Admin'` on anything
`blockedPile()` flags, and bench is excluded from `PDF_IMPORT_FIELDS` so a later
import never re-infers it.

## Workaround that works today

Collapse the job to one card in the drawer and save (that path does persist the
bench), then re-split. Confirmed working by Trevor on 1727, 2026-09-03.

## What a fix would need to decide

- On a multi-card save, should the parent's bench follow the rows? The rows can
  hold **different** benches — that is the whole point of a split — so "the
  parent's bench" may not be well defined. Likely answer: the first row's bench,
  or the bench of the row the tech actually changed.
- Should the drawer instead hide/disable the bench dropdown on a split job, so
  it cannot lie? Cheaper, and arguably more honest.
- Related, not in scope here: every job coming off a hold stays stuck on Admin
  until someone moves it by hand. That is a design hole worth its own brief.

## Blast radius

Touches `src/hooks/useJobs.js` and the `jobs[]` shape / jobsMaster writes —
full agent-team protocol.
