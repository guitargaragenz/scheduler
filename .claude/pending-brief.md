# Pending — warn before a keyword edit moves jobs

doc_status: live

Rewritten 2026-09-01, superseding the "clean up the saved keyword lists" scope.

## The problem

Changing anything in Settings → Keywords immediately re-runs bench matching over
every live job and saves the ones that changed (`App.jsx:265`). Nothing shows
Trevor what will move before it moves. He is deliberately staying out of that tab
because of it. **That is the live constraint, and it is what this build lifts.**

Fires on: adding a whole keyword, removing a chip, or "reset to defaults"
(`SettingsModal.jsx`). Not on typing.

## Build this

A confirmation step between the edit and the save. It must:

1. Compute the new benches without writing anything.
2. Show which jobs would move, each as `job number — from bench → to bench`.
3. Offer go ahead / cancel. Cancel leaves both the jobs and the keyword list
   exactly as they were.
4. Say plainly when nothing would move, and not block that case.

## Not in scope

- Editing the saved keyword lists themselves. That is Trevor's to do by hand
  once this ships, and it is the first real test of it.
- The freeze behaviour: editing a bench that is still on defaults copies the
  whole default list into storage, so that bench never receives a later default
  again. Real, and the reason `broken` is still in the saved Luthier list — the
  defaults were tightened after the copy was taken (`src/data/jobs.js:395`).
  Noted, not fixed here.
- Any change to `inferBench` itself, or to how keywords are matched.

## Rules that bind this

- `jobs[]` is blast-radius. Full protocol, no shortcuts.
- The preview must not write. If it writes and then asks, it has failed.
- Bench writes go to the jobsMaster record, which is Sheet-owned. Check a later
  CSV import does not silently undo an accepted change, and report what you find.
- Plain English in the dialog. Job numbers and bench names, no code terms.

## Background, do NOT open to start work

`docs/briefs/2026-09-01-keyword-cleanup.md` — the original measurement and the
job-by-job table. Its 16-job count and its `broken` claim are unverified from
code; both live in Supabase. Background only.
