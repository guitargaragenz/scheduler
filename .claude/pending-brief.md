# Pending — warn before a keyword edit moves jobs

doc_status: live

Rewritten 2026-09-01. Council (step 2) waived by Trevor — facts already checked against live code.

## The problem

Changing anything in Settings → Keywords immediately re-runs bench matching over
every live job and saves the ones that changed (`App.jsx:265`). Nothing shows
Trevor what will move before it moves. He is deliberately staying out of that tab
because of it. **That is the live constraint, and it is what this build lifts.**

Fires on: adding a whole keyword, removing a chip, or "reset to defaults"
(`SettingsModal.jsx`). Not on typing.

## Do this first, before building anything

The keyword change and the job re-infer are currently one action. Prove that
cancel can leave BOTH the jobs and the keyword list untouched. If the code cannot
be split to allow that, stop and report — do not build the dialog around a cancel
that half-applies.

## Build this

A confirmation step between the edit and the save. It must:

1. Compute the new benches without writing anything.
2. Show which jobs would move, each as `job number — from bench → to bench`.
3. Offer go ahead / cancel. Cancel leaves the jobs and the keyword list as they were.
4. Say plainly when nothing would move, and not block that case.

## Not in scope

- Editing the saved keyword lists themselves. Trevor's to do by hand once this
  ships, and it is the first real test of it.
- The freeze behaviour: editing a bench still on defaults copies the whole default
  list into storage, so it never receives a later default again. Real, and why
  `broken` survives in the saved Luthier list (`src/data/jobs.js:395`). Not fixed here.
- Any change to `inferBench` itself, or to how keywords are matched.

## Rules that bind this

- `jobs[]` is blast-radius. Verifier and browser test still apply.
- The preview must not write. If it writes and then asks, it has failed.
- Bench writes go to the Sheet-owned jobsMaster record. Check a later CSV import
  does not silently undo an accepted change, and report what you find.
- Plain English in the dialog. Job numbers and bench names, no code terms.

Background only, do NOT open to start work: `docs/briefs/2026-09-01-keyword-cleanup.md`.
