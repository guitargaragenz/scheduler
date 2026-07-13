# GGNZ Scheduler — Claude's persistent memory (plain-text summary for Cowork)

Paste this into Cowork whenever it needs context on how Trevor works and where this project stands. Kept
short on purpose — it's a summary for a tool that doesn't need the full technical memory, just enough to
not get things wrong. Update it if it drifts noticeably stale (check against `admin/context/parking-lot.md`
and this project's own Claude Code memory if unsure).

**How Trevor works:**
- Has an ADHD brain (not a clinical diagnosis) — watch for rabbit holes, restate task at session start,
  redirect drift, keep UI zen/minimal (fewer visible rows, progressive disclosure, generous whitespace).
  Uses plain punctuation, not `*` as a divider.
- Wants honest pushback on suggestions, not silent agreement — be direct.
- Trusts his own direct bug reports — investigate/fix immediately, don't burn calls re-verifying first.
- When auditing plans/backlog/memory, check if it's still the right call, not just whether it was done
  correctly.
- Default to agent-team workflows (council, independent builder/verifier) for non-trivial or blast-radius
  work, not solo building.
- Never bundle an unrelated deletion into a requested destructive command — no local backup on this Mac (no
  Time Machine, no snapshots), so accidental deletions are permanent.
- Read a new third-party plugin's actual code before trusting it with real data, especially
  aggregator/proxy-style ones.
- Reference jobs as `#number Mfr Model`, never bare `#number` (auto-links to GitHub issues and 404s).
- This app has ONE Firebase project — no dev/test split. Live verification writes real data — never test
  lock/delete/migrate actions without a recovery plan.
- Say the plan out loud before a chain of investigation/write actions, not after.
- Hand him the plain-words answer to any open-ended prompt rather than making him formulate it himself.
- Explain plans and technical work in plain English by default — file/function-level detail stays in plan
  files and commit messages, not the default explanation.

**Live project state:**
- Current stable baseline tracked via git tags in the repo; check `git log` fresh rather than trusting a
  memorized commit hash.
- Agent-team protocol: brief → Trevor approves ("yp") → build → independent verify → merge gate → Trevor
  approves again. Blast-radius files (scheduledSlots, calendarSlot, useGoogleCalendar.js, useFirebase.js,
  jobs[] shape) force mandatory council review.
- Repo reorganized into Apps (root)/Marketing/Admin departments. Job Tracker tool fully decommissioned.
- Sunday board meeting: a live manual interview through Claude (speak-up/ask/skip) produced the "Focus
  list" feature — more useful than the original whiteboard agent-council design.

**References:**
- Parking lot: `admin/context/parking-lot.md` — read fresh each session, review Sundays.
- Devices: Micky (iMac, primary dev), Moby (MacBook), Slim (Mac Mini, workshop).
