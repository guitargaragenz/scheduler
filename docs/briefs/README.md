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

| Brief | Date | What it's for |
|-------|------|---------------|
| [re-fresh-brief-g-build-1b-browser-test-and-merge.md](re-fresh-brief-g-build-1b-browser-test-and-merge.md) | 2026-07-29 | **Current — start here.** Brief G's **Build 1b is written, reviewed and pushed** — nothing needs building. It's on `staging/brief-g-jobs-sheet-page` (`70b3381`, `70c5b9c`, `ccb1503`, restyle `8b3ce93`), four commits ahead of `main`. The six columns Tag/Hours/Action/VB/BL/PJ are now app-owned so a CSV sync can't revert them, and the new **Sheet** page is where they're edited. `ggnz-verifier` returned **21/21 pass with one concern** — split/derived rows being excluded from the sheet is proved by code-reading only, so it's gated on the browser test. What's left is **one small code change** (Hours must snap to 30-minute steps — asked for after the restyle, not yet built), then **protocol step 5 (browser test)** and **step 6 (merge on Trevor's "yp")**. **Open question to ask first:** Trevor's closing "no change" was ambiguous — either he's happy with the restyle or he couldn't see it. Resolve that before anything else. Scope lock is still `.claude/pending-brief.md`. |
| [appointments-not-showing-on-the-calendar.md](appointments-not-showing-on-the-calendar.md) | 2026-07-29 | **Separate from Brief G — own branch, own protocol run.** Trevor reported his calendar appointments aren't showing on the week grid. Read-only investigation only, nothing changed. Five suspects written up, most likely first: `calendarList.list()` runs without `showHidden`, so a calendar hidden in the Google Calendar UI is silently excluded — which is exactly where Calendly appointments live. Second: every per-calendar failure is swallowed by `Promise.allSettled` with no log or banner, so a broken calendar looks identical to an empty one. **Five questions to ask Trevor first** — the answers decide which suspect it is. Touches `useGoogleCalendar.js`, a blast-radius file. |
| [re-fresh-repo-housekeeping.md](re-fresh-repo-housekeeping.md) | 2026-07-27, rewritten 2026-07-29 | **Fresh session, run it separately.** **Most of it is already done** — the worktrees, the personal parts list, the client design doc, the stale mockup and the Finder junk are all gone, and the old STOP header about a live build in this tree is obsolete. What's left: one dead component (`SplitDrawer.jsx`), three spent one-off scripts, twenty stale local branches, and two pipeline scripts that must wait for Brief G's Builds 1b and 1c before they can be archived. |

## Parked — agreed in principle, waiting on something

| Brief | Date | Waiting on |
|-------|------|------------|
| [blocked-pile-naming-alignment.md](blocked-pile-naming-alignment.md) | 2026-07-27, re-scoped 2026-07-29 | Nothing — Brief F shipped. **Three of its four findings were already fixed** and the brief has been cut down accordingly: the wording is aligned on "Waiting", and `useSupabase.js:43` now folds `blockedPile()` into `schedulable` so the screens agree on which jobs are stuck. What's left is narrow — the Sidebar's three buckets don't match `blockedPile()`'s four piles, so `🔒 ON HOLD` is a catch-all bin. Not scoped, not approved. |
| [parked-parts-as-a-stuck-reason.md](parked-parts-as-a-stuck-reason.md) | 2026-07-27, refs re-verified 2026-07-29 | The first Sunday board meeting run. Parts captured at the bench, shown as the stuck reason on the job. Split out of Brief E — the `parts_to_order` list is empty until the meeting fills it, so the UI would ship showing nothing. Not approved, not scoped. |

## Closed — kept only because the reasoning still matters

| Brief | Date | Why it's still here |
|-------|------|---------------------|
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
