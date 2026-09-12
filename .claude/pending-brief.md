---
doc_status: live
---

# Scope lock — bench change is dropped on split jobs

**Status: waiting on Trevor's approval (step 1). Not approved yet.**

## The bug, confirmed in today's code

In `src/hooks/useJobs.js`, saving a split job writes each card's bench to the
children, but the parent row update (line 307) carries no bench at all. The
board reads the parent, so the bench dropdown looks like it worked and snaps
back. The single-card path does persist it (line 258), which is why collapsing
to one card and re-splitting is a working workaround.

## What to build

On a multi-card save, persist a bench on the parent row as well, using the
first card's bench. Same jobsMaster override path the un-split branch already
uses, so it survives a later CSV import.

## Out of scope

- Jobs coming off a hold staying stuck on Admin. Separate problem, own brief.
- Any change to auto-split, to `inferBench()`, or to `PDF_IMPORT_FIELDS`.
- Any change to how the board chooses parent vs child cards to display.
- Touching the bench dropdown's appearance or disabling it.

## Rules that bind this build

- A bench is picked from the work, never from the brand or the item.
- There is no such thing as "no bench" — the parent must never end up empty.
- Blast radius: `jobs[]` shape and jobsMaster writes. Full protocol, all six
  steps, no shortcuts.

## Background only — do not follow to start work

`docs/briefs/2026-09-03-drawer-bench-change-dropped-on-split-jobs.md` holds the
original diagnosis. Background reading, not the next step.
