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
| [re-fresh-brief-g-pdf-drop-build.md](re-fresh-brief-g-pdf-drop-build.md) | 2026-07-28 | **Current — start here.** Brief G (drop the Multitrack PDF into the app; rebuild the Google Sheet as an in-app page) is **approved and scope-locked**; the brief itself is `.claude/pending-brief.md`. No code written yet. **Step 0 (the match-key gate) has passed** — 2026-07-28, against a fresh export: 46 job numbers, 45 match the `jobs` table character-for-character, 1 genuinely new (`1711`), zero near-misses. **Split 2026-07-28 into Build 1a (items 1, 2, 5, 6, 7 — the PDF actually imports, merges on its own) and Build 1b (items 3, 4, 4b — ownership move + Jobs Sheet page), with item 3b as a Trevor-only checkpoint between them.** Build 1a starts on branch `staging/brief-g-pdf-drop`. Also records that the CSV pipeline is being retired (don't patch it) and that job `1620` is simply completed. |
| [re-fresh-repo-housekeeping.md](re-fresh-repo-housekeeping.md) | 2026-07-27 | **Fresh session, run it separately.** Clear out misplaced, dead and stale files — 267 MB of broken worktrees, a personal parts list, a client's design doc, three spent one-off scripts. Nothing deleted yet. **Read its STOP section first: it shares this working tree.** Note: the `docs/briefs/` half of this job is already done (2026-07-28). |

## Parked — agreed in principle, waiting on something

| Brief | Date | Waiting on |
|-------|------|------------|
| [blocked-pile-naming-alignment.md](blocked-pile-naming-alignment.md) | 2026-07-27 | Nothing now — Brief F shipped. Sidebar, Jobs page and the bench-row chips call the same stuck job three different things and disagree on which jobs are stuck. Trevor's call: the word is **"Waiting"**, not "Awaiting". Not scoped, not approved. |
| [parked-parts-as-a-stuck-reason.md](parked-parts-as-a-stuck-reason.md) | 2026-07-27 | The first Sunday board meeting run. Parts captured at the bench, shown as the stuck reason on the job. Split out of Brief E — the `parts_to_order` list is empty until the meeting fills it, so the UI would ship showing nothing. Not approved, not scoped. |

## Closed — kept only because the reasoning still matters

| Brief | Date | Why it's still here |
|-------|------|---------------------|
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
