# Session briefs

Handoff notes written at the end of a session so the next one can pick up without
re-deriving anything.

**How to use these:** read the one named in your starting prompt, and only that one.

Every brief carries a `doc_status:` line at the very top:

| `doc_status` | What it means |
|--------------|---------------|
| `live` | Real, current work. Act on it. |
| `parked` | Scoped but deliberately not started, and **not approved**. Don't build it. |
| `closed` | Finished history. A record of what happened — **never** a task list. |

A `closed` brief's "next steps", "awaiting approval" and "do this next" sections are part
of the record. They are not work to pick up, however live they sound.

**A brief is a snapshot of the day it was written, not a description of the code.** If a
brief tells you how the app behaves, check the app. Briefs E, F and G each lost a build
round to a fact that was true when written and wrong by the time it was read.

Reading a `closed` or `parked` brief trips a hook (`.claude/hooks/warn-closed-brief.py`)
that says so, wherever in the file you entered. That's a backstop, not permission to skip
the status line.

---

## Live — work that hasn't finished

| Brief | Date | Status |
|-------|------|--------|
| [`.claude/pending-brief.md`](../../.claude/pending-brief.md) | 2026-08-01 | **Current — start here.** Parts to Order round 2.5: an optional supplier name on each part, plus a switch to view the list **by supplier** instead of by job, so an ordering session shows everything from one place in one lump. One nullable column. **Awaiting Trevor's approval — starts at step 1.** |

| [one-parking-lot-fed-from-bujo.md](one-parking-lot-fed-from-bujo.md) | 2026-08-01 | **Approved by Trevor, next after the supplier build.** Trevor asked for supplier "before we do this", so it queues behind. Fix the `saveParkingLot()` wipe-before-rewrite (the `completed_jobs` bug class), merge the two Parking Lots into one with the Supabase table authoritative and `admin/context/parking-lot.md` retired, then let a Daily Log bullet tagged `#PL` file itself into it. Touches `src/utils/supabase.js`, so full protocol. Workshop Projects / `#PRJ` is explicitly **not** in it. |

Also open, not scoped: after a PDF import the board shows the old description until the page is reloaded (`src/hooks/useJobs.js:319` refreshes dates only). Data is correct, screen is stale.

## Parked — agreed in principle, waiting on something

> **Standing order, Trevor 2026-07-29:** *"save all UI changes until after PDF drop implemented
> successfully and CSV pipeline gone"*. **✅ Satisfied 2026-07-29 — Brief H's Build 2c shipped
> (`1e4186a`), so both halves are done and UI work is unblocked.** The two UI briefs below were
> held by this standing order; re-check with Trevor before restarting either, since being
> unblocked isn't the same as being re-approved.

| Brief | Date | Waiting on |
|-------|------|------------|
| [parked-jobs-sheet-usability-changes.md](parked-jobs-sheet-usability-changes.md) | 2026-07-29, item 3 shipped 2026-07-30 | **White sheet instead of dark — done (`ce1cc65`).** Still open: **Enter-to-move-down a row** (the real complaint: every cell needs the mouse today) and **30-minute snapping on hand-typed hours** (`parseHoursInput()` in `jobsSheet.js`, not the UI). Both are behaviour changes on an app-owned column, so they go through the full protocol. Not approved, not scoped. |
| [blocked-pile-naming-alignment.md](blocked-pile-naming-alignment.md) | 2026-07-27, re-scoped 2026-07-29 | Nothing — Brief F shipped. **Three of its four findings were already fixed** and the brief has been cut down accordingly: the wording is aligned on "Waiting", and `useSupabase.js:43` now folds `blockedPile()` into `schedulable` so the screens agree on which jobs are stuck. What's left is narrow — the Sidebar's three buckets don't match `blockedPile()`'s four piles, so `🔒 ON HOLD` is a catch-all bin. Not scoped, not approved. |
| [parked-parts-as-a-stuck-reason.md](parked-parts-as-a-stuck-reason.md) | 2026-07-27, refs re-verified 2026-07-29 | The first Sunday board meeting run. Parts captured at the bench, shown as the stuck reason on the job. Split out of Brief E — the `parts_to_order` list is empty until the meeting fills it, so the UI would ship showing nothing. Not approved, not scoped. |

## Closed — kept only because the reasoning still matters

| Brief | Date | Why it's still here |
|-------|------|---------------------|
| [parts-to-order-round-2.md](parts-to-order-round-2.md) | 2026-08-01, shipped same day | Round 2 — parts grouped by job, an optional part number, and an advisory PartsBox stock check with a one-click "check stock" door into the drawer. Shipped at `a702e6b`. Kept for three things: the stock check gets its **own** error state, separate from the red box that means a save failed; the drawer keeps its **own** five-field search including bin/shelf names, while the page uses a separate four-field matcher (swapping one for the other is a silent regression, and the tests now guard it); and the matching is deliberately dumb substring matching — no typo or plural tolerance — because a false "you already have this" means a part never gets ordered. **`parts_to_order` still has no RLS policy in the schema file.** |
| [parts-to-order-page-round-1.md](parts-to-order-page-round-1.md) | 2026-08-01, shipped same day | The Parts to Order page — see the chase list, add a part, tick one off. Shipped at `9a925ef`. Kept for two things: the four `parts_to_order` functions used to swallow their own errors, which is why the Sunday meeting's parts write had never once worked and looked like a success; and the rule that ticking a part off writes **no job state** — Multitrack unsticks the job on the next import, the tick only clears the list. Also records a real issue left alone: `docs/supabase-schema.sql` still has **no RLS policy** for this table, so a schema rebuild reproduces the silent-rejection bug. Needs its own brief. |
| [`.claude/pending-brief.md`](../../.claude/pending-brief.md) | 2026-07-30, shipped 2026-08-01 | Jobs by Age PDF took over the job description — the Job List printout ends long descriptions mid-word, confirmed against the real 31 Jul pair (no continuation line, so not our wrap-stitching). Shipped at `2960d05`. Kept for two things: the ownership-by-lifecycle rule (Job List writes desc at job creation, JBA owns it after — same rule already proven for `firstSeen`), and the reason no backfill was needed. **Also the brief that sat uncommitted for two days and cost a session re-deriving itself.** |
| [re-fresh-repo-housekeeping.md](re-fresh-repo-housekeeping.md) | 2026-07-27, closed 2026-07-30 | The last of the dead-file sweep — `SplitDrawer.jsx`, two spent scripts, `cowork-context-summary.md`, the pre-migration backup JSON, and two merged local branches. All shipped `096986e`–`c44f2db`. |
| [appointments-not-showing-on-the-calendar.md](appointments-not-showing-on-the-calendar.md) | 2026-07-30 | Turned out to be Google Cloud config, not app code — stale API key, Calendar API disabled, missing API restriction, and an OAuth Client ID from the wrong project. Fixed via Cloud Console and env vars, no app code changed, confirmed working live. |
| [`.claude/pending-brief.md`](../../.claude/pending-brief.md) | 2026-07-29 | Brief H, Build 2: retire the CSV pipeline — **all three builds shipped 2026-07-29: 2a `29c1e4a`, 2b `5d262dc`, 2c `1e4186a`.** 2a closed the app's Upload CSV door; 2b dropped the app's use of the stored `days` number and deleted the orphaned `upsertJobsBatch` writer (the `days` database column itself stays — Trevor's call); 2c deleted the four Mac-side pipeline scripts and fixed the stale Firebase/CSV references in `SCHEDULER-ARCHITECTURE.md`. This satisfied the standing order — UI work is unblocked. |
| [brief-g-pdf-drop-full-record.md](brief-g-pdf-drop-full-record.md) | 2026-07-28, amended 2026-07-29 | Brief G's complete record — the whole PDF-drop build. All three shipped: **1a `f927248`, 1b `f2ee449`, 1c `b665e1d`**. Was the scope lock at `.claude/pending-brief.md` until Brief H took that slot 2026-07-29. Kept for the ⚡ council notes on items 8–12: the `23502` sparse-upsert trap, the apply-migrations-by-hand mechanism, the six `days` read sites including three sorts, and the NZ local-date rule. Build 2 is scoped in `.claude/pending-brief.md`, not here. |
| [re-fresh-brief-g-build-1b-browser-test-and-merge.md](re-fresh-brief-g-build-1b-browser-test-and-merge.md) | 2026-07-29 | Brief G Build 1b's working record — the six columns going app-owned, the Jobs Sheet page, the M/T un-swap, the restyle, and the browser test item by item. **Shipped at `f2ee449`.** Kept for two pieces of reasoning that still matter: why six columns were removed from `upsertJobsBatch()` rather than stripped caller-side, and why the live CSV write test was dropped rather than run. Its three deferred Sheet changes have moved to `parked-jobs-sheet-usability-changes.md` — build from there, not from here. |
| [re-fresh-brief-g-pdf-drop-build.md](re-fresh-brief-g-pdf-drop-build.md) | 2026-07-28 | Brief G Build 1a's working record — step 0 match-key gate, the 1a/1b split, the build and verification. Shipped at `f927248`. Superseded by the 3b/1b brief above. |
| [handoff-pdf-import-truncation-incident.md](handoff-pdf-import-truncation-incident.md) | 2026-07-26 | The story of the truncation incident. Everything in it is resolved: bug fixed and pushed, the 10 blank-`mfr` jobs repaired (verified 2026-07-28), the PDF layout never actually changed (one-off glitch), Firestore gone. Cost a session to a mid-file entry — the reason the hook exists. |
| [brief-d-board-meeting-full-record.md](brief-d-board-meeting-full-record.md) | 2026-07-27 | Brief D's complete working record — all nine scope items, council findings, verification and live-test notes. Shipped at `da1d9af`. |
| [brief-f-waiting-chip-shipped.md](brief-f-waiting-chip-shipped.md) | 2026-07-27 | Brief F's full record — Waiting/Planning chips on the bench row. Shipped at `ece2197`. Contains the `'Waiting Parts'` error; corrected in its own banner. |
| [re-fresh-job-blocking-council-and-build.md](re-fresh-job-blocking-council-and-build.md) | 2026-07-27 | Brief E (job blocking). Shipped. Kept for the council design decisions. |
| [re-fresh-blocked-status-match-fix.md](re-fresh-blocked-status-match-fix.md) | 2026-07-27 | Shipped and merged (PR #6, `43a5024`). Kept as the record of how the `'Waiting'` status string was finally pinned down. Its own body still says `'Waiting Parts'` throughout — that is wrong, and its banner says so. |

Everything else has been deleted. Twenty-one spent briefs came out of this folder on
2026-07-28 — the whole Firebase/Firestore era plus every handoff whose work had shipped and
was already recorded elsewhere. **Nothing is lost:** `git log -- docs/briefs/` has all of
them in full, permanently. They were removed because a folder of finished work that reads
like live work is what caused the failed build rounds.

---

Designs and specs live in [`../superpowers/specs/`](../superpowers/specs/), not here. A
brief says *what to do next*; a spec says *what we agreed to build*.
