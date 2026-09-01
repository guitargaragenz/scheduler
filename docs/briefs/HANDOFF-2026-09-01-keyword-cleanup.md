doc_status: live

# Handoff — keyword clean-up, Part A done, Part B awaiting `yp`

Written 2026-09-01 at the end of the session. Everything below is checked
against the live code and the live database, not remembered.

## Start here

Read `.claude/pending-brief.md`. It is the scope lock and it is current.
Do **not** read the whole background brief to start — only if the lock leaves
a real question unanswered.

## Where the work is

**Part A — DONE.** The saved `benchKeywords` in `app_settings` were corrected
by a direct REST write, so no job moved. Verified after: 22 pending bench moves
became **12**, all correct. Settings → Keywords is safe for Trevor to open
again. The old value is recorded in
[2026-09-01-keyword-cleanup.md](2026-09-01-keyword-cleanup.md).

**Part B — scoped, council done, NOT approved.** The design is *decouple*:
keyword edits write keywords only, and a separate "Re-match benches" button
does the moving, always showing the list first. Both `ggnz-council` reviewers
rejected the earlier confirm-on-edit shape; their findings are build
requirements in the lock.

## The one thing that must happen first

**Trevor has not said `yp` to the scope lock.** He approved the *design*
("decouple") and he approved *writing this handoff* — neither is approval to
build. Get the `yp` on `.claude/pending-brief.md`, then `ggnz-builder`
(protocol step 3).

Council has already run. Do not run it again.

## Facts worth carrying, all verified

- **`saveJob` swallows every error** (`src/utils/supabase.js:48` — logs, returns
  `null`) and `handleBenchKeywordsChange` fires the writes unawaited
  (`src/App.jsx:273`). Three of twelve failing shows twelve moved on a board the
  database disagrees with. **This is live today**, not introduced by Part B.
- **Keyword edits are not keystroke-driven.** `AddRow`
  (`src/components/SettingsModal.jsx:43`) only fires on Enter or the Add button
  — one write per chip added or removed. An earlier brief said keystroke; it was
  wrong.
- **The re-infer computes and commits in one pass** (`src/App.jsx:265-270`).
  There is no existing way to ask "what would move" without moving it. That is
  the restructure Part B turns on.
- **The 12 moves are deliberately still pending.** Trevor's call: they get
  applied the first time the new button is used, so its first run is real.

## How to re-measure

Live Supabase credentials are in the web session environment
(`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). A read-only script that pulls
`jobs` and `app_settings` over the REST API and runs `inferBench` over each
non-split job reproduces the 12. Two gotchas: the job number column is `job`,
not `job_number`, and `vb`/`backlog` are `'Y'`/`'N'` text in `vb`/`bl`.
Write it to the scratchpad, not the repo.

**Re-measure rather than trusting any number in any document.** The count was
16 in the morning, 22 by the time it was read, and 12 after Part A.

## Open, not scoped

- The session ran council on a brief Trevor had not approved. Read-only agents,
  no harm to code or data, but the protocol order was wrong. Noted so it isn't
  repeated.

## Open PR

[#57](https://github.com/guitargaragenz/scheduler/pull/57) — docs only (the
index fix, the Part A record, the scope lock, the mockup). Green. Not merged.
