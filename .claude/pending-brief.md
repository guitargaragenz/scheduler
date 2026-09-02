# Scope lock — nothing gets a bench from the manufacturer

doc_status: live

Trevor, 2026-09-02: *"nothing should be filtered by manufacturer"*. The brand of
the guitar says nothing about the work.

## Build

1. **Delete the two manufacturer lines**, `src/data/jobs.js:64-65` — the
   Electronics brand list (`db tech|rcf|...`) and the Setup brand list
   (`fender|gibson|...`). Both test `m`, the `mfr` field, and nothing else. A
   job matching no keyword then returns `null` — no bench — which `JobDrawer`'s
   "Needs a bench" already catches.
2. **Write the rule into CLAUDE.md** under "Workshop rules that the code must
   respect". It was never written down; that is why it is being fixed again.
3. **Tests** — `src/data/jobs.test.js:215-261` asserts brand-driven benches.
   Update to assert `null`, and add one that fails if a bare manufacturer ever
   picks a bench again.

## Out of scope

- **Line 63 stays.** `/passport|pa\s*\d/` tests the *description*, not `mfr`.
- **No database change.** `bench` is stored, so jobs already on a brand-picked
  bench keep it and the board looks identical after merge. Tell Trevor that
  plainly — it must not read as "the fix didn't work".
- **The Admin→Setup bug is not fixed here.** Cause unknown, needs live data.
  Do not fold a theory about it into this build.
- No change to `blockedPile()`, `scheduledSlots`, `calendarSlot`, `jobs[]`.

## Council must rule on

- **How many jobs lose their bench on the next import?** Unknown from a web
  session. If it is most of the board, the rollout needs staging.
- **Whether `pdfImportPlan.js:96` earns its own brief** — it calls `inferBench`
  without `action`/`backlog`/`vb`. Detail in the background file below.

## Binds this build

- `src/data/jobs.js` is a blast-radius file — **full protocol**, no shortcuts.
- No browser test that writes job state: the preview talks to the LIVE database.
- Documents describe the past; check every fact above against the code.

Background only — do **not** open it to start the build:
`docs/briefs/2026-09-02-no-manufacturer-benches.md`.
