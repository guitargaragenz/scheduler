# Pending — the saved keyword lists need a clean-up

doc_status: live

Raised by Trevor 2026-09-01 after PR #55 merged. Not yet scoped or approved —
the open questions below have to be answered by him first.

## The problem

Editing ANY keyword box in Settings re-runs bench matching over EVERY live job
and writes the result to the database (`App.jsx:265`). The saved keyword list
has drifted, so the first keystroke in that tab moves **16 live jobs** — three
of them amp jobs landing on the Luthier bench, because the saved Luthier list
contains bare `broken` with no word boundary.

**Trevor is deliberately staying out of Settings → Keywords until this is
fixed.** That is the live constraint.

## Not caused by PR #55

Verified against the live board before merge: none of the 121 jobs changes
bench because of that PR. The drift predates it. Quoting does not fix it
either — quotes make a keyword win, they do not stop a vague word matching.

## Before building, ask Trevor

1. Eight of the 16 moves are corrections, not damage. Apply all 16, or some?
2. Does the keyword fix need to happen WITHOUT firing the re-infer over
   everything, or is one big correction acceptable?
3. `finish` in his Luthier list is load-bearing for the refinish split — check
   before touching.

## Background, do NOT open to start work

Full measurement, the job-by-job table and the likely fix are in
`docs/briefs/2026-09-01-keyword-cleanup.md`.
