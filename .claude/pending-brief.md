# Pending — Finishing becomes a real bench

doc_status: live

Approved by Trevor 2026-09-01 ("just leave it as finishing and add keywords to
action bench"). Background only, do NOT open to start this build:
`docs/briefs/README.md`.

## The problem

`Finishing` exists as a bench colour and as an auto-split card, but it is not a
bench you can steer. It has no entry in `DEFAULT_BENCH_KEYWORDS`, no row in
Settings → Keywords, and `inferBench` never tests for it. A job that is purely
finish work (lacquer, buff, touch up) has no way to land on it.

## Build

1. `src/data/jobs.js` — add a `Finishing` list to `DEFAULT_BENCH_KEYWORDS`.
2. `src/data/jobs.js` — `inferBench` tests Finishing **after Luthier, before
   Setup**. Order is load-bearing: `refinish` / `\bfinish\b` stay Luthier
   keywords so a Luthier job still splits into Luthier + Finishing cards
   (`createSubtasks`, jobs.js:264). Only a job with no Luthier keyword falls
   through to Finishing.
3. `src/components/SettingsModal.jsx` — add `'Finishing'` to `BENCHES` so the
   keyword list is editable.
4. `src/components/JobDrawer.jsx` and `MobileJobSheet.jsx` — add `'Finishing'`
   to `ALL_BENCHES` so it is pickable by hand. Never first in the array
   (the NEEDS_BENCH sentinel rule, JobDrawer.jsx:8).
5. Tests for the new inference path, both directions: a finish-only job lands
   on Finishing; a `refinish` Luthier job still splits and does NOT change.

## Out of scope

- Renaming Finishing to "Finish Work". Trevor's call: keep the name.
- Job 1728 / the Weekly Log Remove button being hidden on booked rows. Trevor
  stood this down 2026-09-01 as a one-off.
- The `Wiring` keyword box in Settings, which nothing reads. Same shape of bug,
  separate job — note it, don't fix it here.

## Rules that bind this build

- `git add <file>`, never `-A`. No `--no-verify`.
- An empty keyword list must keep falling back to defaults (jobs.js:49) — do
  not weaken that guard.
- Blocked work stays Admin. `blockedPile` runs before any keyword test and must
  stay first.
