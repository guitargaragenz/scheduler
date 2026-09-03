# Brand and model must never pick a bench

doc_status: closed

Shipped at `046a6d6` (PR #64), browser-tested on the Vercel preview and merged
2026-09-03. Nothing on wrong benches.

## What to build

In `src/data/jobs.js`, `inferBench()`:

1. Delete the three brand/model rules:
   - `/passport|pa\s*\d/` → Electronics
   - the amp/PA manufacturer regex → Electronics
   - the guitar manufacturer regex → Setup
2. Stop folding `model` into the matched text: `const d = desc.toLowerCase()`.
3. The `mfr` and `model` arguments stay in the signature (callers pass them);
   they are simply no longer used to choose a bench.

Anything the description keywords don't match returns `null` — "Needs a bench" —
which JobDrawer already catches and refuses to save.

## Why

Trevor's ruling, 2026-09-03: the brand of an instrument says nothing about the
work being done on it. A Fender could be a refret or a rewire. Every job's
description carries keywords that should pick the bench; the brand rules were a
guess layered on top, and a wrong guess reads as a promise the job is workable
at that bench.

## Out of scope

- No new keyword rules for any bench. Do not add keywords for Finishing or
  Wiring — they stay sub-only, never auto-assigned.
- Do not touch `blockedPile()` or the blocked→Admin first line.
- Do not touch the bench display-order lists (separate uncommitted work).
- Do not change the `null` fallback to Admin.
- Do not add an unbenched counter or flag to the PDF import preview. Accepted:
  after an import, unbenched jobs show as grey "no bench" cards on the Jobs page
  and Trevor picks them up by eye.

## Rules that bind this build

- Blocked wins first. The `blockedPile()` check stays the opening statement.
- No test changes needed: no existing test exercises the brand-only path.
- Full protocol: council → builder → verifier → browser test → merge.

Background only, do not open to start the build:
`docs/briefs/2026-09-03-handoff-finishing-bench.md`.
