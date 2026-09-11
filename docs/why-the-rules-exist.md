---
doc_status: live
---

# Why the rules exist

The rules themselves live in [CLAUDE.md](../CLAUDE.md). This file holds the incidents behind
them, so the rules load fast and the stories are still on record.

## Trevor never runs git himself

Micky's local clone can be out of sync with GitHub, and Trevor running git by hand there caused
accidental deletion of 35 app files on 2026-06-14.

## Always confirm scope before bulk or destructive operations

Bulk session archiving was done when only duplicate removal was requested (2026-05-23).

## Stay on-track during autonomous work

The agent-team protocol exists so Trevor only checks in twice per task — approve the brief,
approve the merge — and otherwise stays off the Mac. Needing him back mid-session to manually
redirect a build defeats the whole point.

## Documents describe the past. The code describes the present.

Briefs E and F each burned three build rounds for the same reason: the builder built correctly
against a brief that contained facts which were true when written and wrong when read. A brief
claimed Multitrack's status string was `'Waiting Parts'` (it is `'Waiting'`). A handoff said
Multitrack had changed its PDF layout (it was a one-off glitch). Old briefs still talked about
Firestore months after everything moved to Supabase.

## A scope lock is a page, not a file of record

Added 2026-08-08, after `.claude/pending-brief.md` grew to ~300 lines — a near-copy of the
revenue brief. Starting a session then loaded the same audit twice, before any work happened.
Trevor pays for that in context, which is what he has least of.

## Claude's Role — the dated entries

- **Preserved in CLAUDE.md (2026-07-12)** rather than in a memory file, precisely because it must
  never depend on an agent choosing to go read one.
- **Evidence rules the chat, not defensiveness (2026-09-02).** Trevor named a screen ("Day view"),
  sent a screenshot of exactly that screen, and Claude spent two turns correcting his terminology
  instead of answering — the third time in one session Claude defended its own framing over his
  input. The app has four colliding screen names; navigating them is Claude's problem, not his.
  The naming was never the question.
- **Short answers, always (2026-08-02),** in Trevor's words: "with an ADHD mind long text and
  jargon just shuts me down."
- **`tt` and `tl` (2026-08-04).** He types them the moment an answer goes wrong, often while a
  reply is still being written — he is not a fast typer, hence two letters.
- **`sz` (2026-08-04),** after he asked the long way mid-session. Answer honestly: what is
  degrading, what is still solid, and a plain yes or no on starting fresh. Never reassurance.

## Moved out of CLAUDE.md 2026-09-11, to keep it short

- **Job Tracker decommissioned 2026-07-06.** The legacy standalone tool was archived to
  `archive/job-tracker/` and is no longer deployed. The Jobs page and Sidebar superseded it
  entirely — same bench/status/action filtering, plus real scheduling and sync.
- **Starting a session, corrected 2026-09-11.** Step 1 used to say terminal-only, which predates
  the desktop app and had Trevor thinking he was in the wrong place.
- **Blast-radius file list, corrected 2026-07-28.** It previously named `useFirebase.js` and called
  `scheduledSlots` Firestore state. The app runs on Supabase — `useFirebase.js` is dead code
  (nothing imports it, and it reads from Supabase anyway). Deleting it is separate housekeeping,
  not part of any feature build.
- **Model discipline, added 2026-07-28** after repeatedly hitting rate limits. Trevor sets Opus for
  architecture thinking, then every council reviewer, verifier and scout spawns as Opus too. One
  `council this` was eleven Opus agents.
- **Why `ggnz-builder` stays on Opus.** It writes to `scheduledSlots`, `useSupabase.js` and the
  `jobs[]` shape. A cheap agent's mistake there costs a bad merge and a debugging session, which
  burns more than it saved. Cheap everywhere else; careful where the live job data is.
- **Workshop rules written down 2026-08-02,** because a build already got designed around not
  knowing one of them.
- **Backlog never coexists with Waiting Parts, added 2026-08-05.** Build 1 made `BL` block, and
  that looked like it would mute the "PARTS ARRIVED?" notice for backlog jobs. It cannot: the
  combination doesn't occur.
- **Bench comes from the work, Trevor's ruling 2026-09-03,** after brand and model were dropped as
  bench signals.
- **Glue needs 12 hours, added 2026-08-04,** after a week schedule put a 1635 neck glue and the
  rest of its bench cards on the same Friday.
