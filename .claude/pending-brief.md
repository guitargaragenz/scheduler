# Pending — keywords stop moving jobs; one button does

doc_status: live

Design chosen by Trevor 2026-09-01 ("decouple"). **Not yet approved — he has
not said `yp` to this page.**

## Build it

**1. Editing keywords writes keywords only.** `handleBenchKeywordsChange`
(`App.jsx:249`) stops calling `setJobs` and `saveJob` entirely. Adding or
removing a word saves the word. No job moves, no confirm screen, no
interruption.

**2. A "Re-match benches" button on the Settings page.** Pressing it shows
every job that would change bench — number, description, from, to — and Trevor
picks **Move them** or **Leave them**. Today that list is 12 jobs, all correct.
Cancel writes nothing.

**3. The computation is state-free.** Extract the loop at `App.jsx:264-270`
into a helper taking `(jobs, keywords)` and returning the list, writing no
state. Preview and apply call the same helper, and **apply uses the list
already shown**, never a recompute.

**4. Applying must report failure.** Await the `saveJob` writes, collect the
results, and name the job numbers that did not save. Never report success over
a partial write.

Council's reasoning for 3 and 4 is in the brief linked below.

## Out of scope

- Changing `inferBench` or `DEFAULT_BENCH_KEYWORDS`.
- Touching the saved `benchKeywords` again — Part A settled that.
- Per-job bench overrides, an undo, or a moves history.
- The `Wiring` Settings box being read by nothing (real, separate).

## Rules that bind this

- **Blast-radius** — writes `bench` on live jobs. `ggnz-builder` builds,
  `ggnz-verifier` verifies, never the same agent.
- **Cancel writes nothing to `jobs[]`.** A verifier item, not a nicety.
- The in-memory board and the database must never disagree, even briefly — no
  "move then undo on cancel".
- No browser test that applies moves — the Vercel preview talks to the LIVE
  database.
- Git discipline per CLAUDE.md.

Background, do **not** open to start the build:
[docs/briefs/2026-09-01-keyword-cleanup.md](../docs/briefs/2026-09-01-keyword-cleanup.md)
