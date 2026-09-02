# Pending — To Be Invoiced is not a blocked status

doc_status: live

Scoped and approved by Trevor 2026-09-02.

`blockedPile()` (`src/data/jobs.js:296`) hard-codes the blocked statuses and
`To Be Invoiced` is not among them, so those jobs read as workable. On any
Settings keyword save the re-infer (`App.jsx:278`) then overwrites their Admin
bench with a keyword one — usually Setup. That is the bug.

The status means: finished in Multitrack, waiting on Trevor to send the invoice.

## Build

1. Add `To Be Invoiced` to `blockedPile()`, returning its own pile key
   `invoice`. Exact string, character for character.
2. `blockedReason()` returns a plain reason — "completed, needs invoicing".
3. New chip in `JobShelf.jsx`'s `PILES` row, label **To Invoice**. Trevor's
   call: its own chip, not folded into Hold.
4. Tests covering all three.

## Out of scope

- **The hand-set-bench problem** — a job set to Admin by hand that is not
  blocked is still overwritten on a keyword save. Real, separate, not this.
- Changing when the keyword save re-infers, or which jobs it covers.
- The two shipped keyword builds (warning dialog, "and" box), PR #58.
- Marking anything done; anything touching revenue.
- Any backfill or migration of stored benches. No script in this build.

## Rules that bind it

- Blast-radius (`jobs[]`, and the bench column gets written). Full protocol.
- `blockedPile()` stays the single source of truth. No second copy of the
  status test anywhere.
- Verify the status string against live data before relying on it. `Waiting`
  vs `Waiting Parts` cost two build rounds already.

Background only, and **not needed to start the build** — the cause traced
through the code, the pile decision and the link to the unexplained 10:
`docs/briefs/2026-09-02-to-be-invoiced-blocked.md`.
