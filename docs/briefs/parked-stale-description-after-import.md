doc_status: parked

# Board shows the old description until you reload

**Noted 2026-08-01** while closing the job-description brief (shipped `2960d05`). Parked
2026-08-03 at Trevor's call. **Not scoped, not approved — don't build from this.**

## What happens

Drop a PDF, the import runs, the description in the database is correct. The board on screen
still shows the old one until the page is reloaded. Data right, screen stale.

## Why

`src/hooks/useJobs.js:319` — after an import the hook refreshes dates only, not the rest of the
job row. Verify that line before acting on it; it was true 2026-08-01.

## Scope, if it's ever picked up

Widening what that refresh pulls touches the `jobs[]` shape, so it is blast-radius — full
protocol, no solo fix. The obvious one-liner is exactly the kind of change that needs council
on it, because everything on the board reads from that array.
