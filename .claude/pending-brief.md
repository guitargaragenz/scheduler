# Scope lock — no bench from the manufacturer, and no such thing as "no bench"

doc_status: live

Trevor, 2026-09-02, two rulings:
- *"nothing should be filtered by manufacturer"* — the brand of the guitar says
  nothing about the work.
- *"there is no such thing as no bench and should never be"* — every job lands
  on a bench. Admin is the catch-all, at the end.

## Build

1. **Delete the two manufacturer lines**, `src/data/jobs.js:64-65` — the
   Electronics brand list (`db tech|rcf|...`) and the Setup brand list
   (`fender|gibson|...`). Both test `m` (`mfr`) and nothing else.
2. **`inferBench()` never returns `null`.** The final `return null`
   (`jobs.js:73`) becomes `return 'Admin'`. Delete the comment above it that
   argues for null — it is an agent's reasoning, never Trevor's, and it is now
   overruled.
3. **Write both rules into CLAUDE.md**, under "Workshop rules that the code must
   respect". Neither was ever written down; that is why this is being fixed
   again 3 months on.
4. **Tests** — `src/data/jobs.test.js:215-261` asserts brand-driven benches and
   a `null` return. Update both. Add a test that fails if a bare manufacturer
   ever picks a bench, and one that fails if `inferBench` ever returns falsy.

## Out of scope

- **Line 63 stays.** `/passport|pa\s*\d/` tests the *description*, not `mfr`.
- **The Admin→Setup complaint is not being fixed here.** Cause still unknown,
  still needs live data. Do not fold a theory about it into this build.
- No change to `blockedPile()`, `scheduledSlots`, `calendarSlot`, `jobs[]`.

## Council must rule on

Both written up under "Council must rule on" in the background file:

- **Existing stored benches** — backfill, or leave them to the next import?
- **The now-dead "no bench" UI** — strip in this build, or a separate tidy-up?

## Binds this build

- `src/data/jobs.js` is a blast-radius file — **full protocol**, no shortcuts.
- No browser test that writes job state: the preview talks to the LIVE database.
- Documents describe the past; check every fact above against the code.

Background only — do **not** open it to start the build:
`docs/briefs/2026-09-02-no-manufacturer-benches.md`.
