# Pending — keyword edits must ask before they move jobs

doc_status: live

Scoped and approved by Trevor 2026-09-01 ("c", then "let B's confirm screen
apply them"). Part A (correcting the saved keywords) is already done.

## Build it

Editing a Settings keyword box must no longer move jobs by itself. Today
`handleBenchKeywordsChange` (`App.jsx:249`) re-infers every job and writes the
result on each keystroke, with nothing shown first. Instead:

- A confirm step listing every job that would change bench — number, from, to,
  description. Today that list is **12 jobs**, all correct.
- Trevor applies or cancels. Cancel writes nothing to `jobs[]`.
- The keyword list saves either way — correcting a word must never be blocked
  by declining the moves.
- Applying writes bench exactly as the handler does now: same
  `pickMasterFields` / `saveJob` path, same split-child, split-parent and
  subtask skips.

The 12 pending moves are applied through this screen, deliberately. Nothing
applies them before it ships.

## Out of scope

- Changing `inferBench` or `DEFAULT_BENCH_KEYWORDS`.
- Touching the saved `benchKeywords` again — Part A settled that.
- Per-job bench overrides, an undo, or a moves history.
- The `Wiring` Settings box being read by nothing (real, separate).

## Rules that bind this

- **Blast-radius** — writes `bench` on live jobs. Full protocol: council
  (step 2) before any build, then `ggnz-builder`, then `ggnz-verifier`.
- Cancel means zero writes to `jobs[]`. A verifier item, not a nicety.
- No browser test that applies moves — the Vercel preview talks to the LIVE
  database.
- Git discipline per CLAUDE.md.

Background, do **not** open to start the build:
[docs/briefs/2026-09-01-keyword-cleanup.md](../docs/briefs/2026-09-01-keyword-cleanup.md)
