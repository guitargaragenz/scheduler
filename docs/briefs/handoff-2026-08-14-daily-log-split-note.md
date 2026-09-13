---
doc_status: closed
---

# Handoff — Daily Log split-note fix (2026-08-14)

**Shipped — merged to main at `e99e9fe` (PR #24, 2026-08-14).** Both the placed
rows and the dropdown now show each split's own `sessionNote`. Trevor checked
the Vercel preview and merged. The one item left below is a *new* feature (a
read-only status column), not part of this fix — see the README Live table.

## Done and committed (not yet pushed)

Commit `01c5477` — "Daily Log: show each split's own note, not the guitar's
Multitrack blurb".

The Daily Log panel's second line under each placed job now reads the split's
own `sessionNote` (the note Trevor types under each bench split — "fix broken
headstock", "level crown and polish", "setup"). Before, it read `splitDesc ||
desc`; `splitDesc` is never written anywhere, so it always fell through to
`desc`, the parent guitar's whole Multitrack description. That was the wrong
text — the same fault three prior attempts made.

- File: `src/components/DailyLogPanel.jsx` — helper `subTaskNote(id)` looks the
  split up fresh in `jobs` and returns `sessionNote` with **no fallback** (a
  split with no note shows nothing, never the guitar's blurb). Read live at
  render, so editing a note updates the Daily Log too.
- Verified against live Supabase #1711: the placed row correctly shows
  "fix broken headstock".
- **Not blast-radius** (display-only panel); Trevor confirmed a direct edit was
  fine, no full agent-team protocol needed.

## Open item — the dropdown, NOT fixed

Trevor: "shows on page but not in drop down."

The "+ Put a job on this day…" dropdown in the Daily Log lists options as
`1711 Gibson Les Paul Standard — Electronics` / `— Fretwork` — i.e. the **bench
label**, not the session note. The placed-row line was fixed; the dropdown
option text was not. Next session: decide whether the dropdown option should
also show the split's `sessionNote` (or append it), then make that one edit in
`DailyLogPanel.jsx` where the `<option>` list is built.

## Housekeeping not done

- `01c5477` is **committed but not pushed**.
- Working tree still shows pre-existing modified files not part of this fix:
  `.claude/pending-brief.md`, `docs/briefs/README.md`. Leave or review
  separately — not this task.
