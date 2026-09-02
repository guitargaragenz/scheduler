# Handoff — the keyword builds are reverted, and what's actually left

doc_status: live

Written 2026-09-02 at end of session. Start here.

## What happened

Trevor reported: since the wiring bench keywords went in, Admin jobs were
showing as available on Setup and other benches.

He then called it off and asked for a rollback instead of a fix:

> "Cancel all this it's ridiculous. The fact is everything was working fine
> until a context bloated agent ran a build. The answer is to roll everything
> back to just before that point, which I believe was the wiring keywords."

## What was done

**Draft PR #60** on branch `claude/handoff-review-t1eei6`. It reverts, code only:

- `ebcbcc2` — reverts PR #55 (wiring + finishing keyword lists)
- `0ba360c` — reverts PR #58 (keyword warning dialog, "and" box)
- `2dd856e` — unrelated: a new CLAUDE.md rule, see below

764 tests green, production build clean, Vercel preview Ready.
**Merged 2026-09-02 at `d0ffa22`** on Trevor's approval.

Deliberately NOT reverted — process work unrelated to the bug:
`.claude/agents/*.md`, `.claude/skills/protocol/SKILL.md`, and the three
2026-09-01 briefs.

## Correction worth carrying

Wiring and Finishing were **already benches** before PR #55 — colours, hours and
split cards all present at `8b3f9b3`. #55 only added their keyword lists, two
lines in `inferBench`'s chain, quoted-keyword priority, and Finishing's place in
six bench-list constants. An earlier session claimed #55 introduced the benches
themselves. It didn't. Trevor caught it.

## Two dead ends — do not re-run them

1. **"`To Be Invoiced` is missing from `blockedPile()`."** True — the string
   appears nowhere in `src/`. But it is **not** the cause: Trevor checked the
   jobs landing on Setup against Multitrack and none of them are To Be Invoiced.
   A scope lock and two council reviews were spent on this theory before one
   question to him killed it. Real gap, unscoped, not this bug.
2. **Splits rendering as plain text on mobile.** Trevor flagged the Day view
   showing splits as uneditable text lines. That is `DailyLogPage.jsx:464`
   (`LogJobCard`) and it is **by design** — a read-only summary strip under the
   card; tapping the card opens the parent job. Not a regression from the
   revert, which touched one line in `BenchBoardPage.jsx` and nothing here.

## The split-hours line — asked, answered, not a bug

`DailyLogPage.jsx:470` prints `{s.hoursRange}h` on each split line. Checked
2026-09-02, and the earlier description of it here was wrong — it is three
different behaviours on one line, not one:

- auto-split cards (`src/data/jobs.js:275`+) set their own `hoursRange`, so
  those lines render a correct number;
- hand-made splits (`src/hooks/useJobs.js:268`) spread the parent job and
  override `hours` but not `hoursRange`, so they show the **parent's** range;
- splits read back from Supabase (`src/hooks/useSupabase.js:95`) never map
  `hoursRange` at all, so those are the blank `· h` ones.

**Trevor's call, 2026-09-02: leave it.** *"hours don't count in log pages ...
I work out of logs and use board and sheet to manipulate status benches,
splits etc."* The number is never read there, so a wrong or missing one costs
nothing. Not work. Do not re-raise it as a bug.

Same for whether those split lines should be tappable — that would be a new
feature, and it was never asked for.

## Also shipped this session

`2dd856e` adds **"Evidence rules the chat, not defensiveness"** to Claude's
standing role in CLAUDE.md. Written after Claude spent two turns correcting
Trevor's name for a screen he had named correctly and screenshotted. The test:
do his words and his evidence agree? If yes he is right — take his framing. If
they genuinely conflict, name the exact conflict. Terminology alone is never
grounds to correct him.

## The next task

The revert is merged, so the only thing left is the original complaint:
**is the Admin→Setup problem still showing on the board?**

Nothing in the database changed, so any job already sitting on the wrong bench
is still sitting there — the board looking unchanged straight after the merge
proves nothing either way.

If it is still live, the cause is still unknown. Do not guess at it — two
theories died on 2026-09-02. It needs the jobs read off the board against
Multitrack, or a session on Micky with `.env`, because live job data is not
readable from a web session.

## Do not

- Revive the To Be Invoiced fix. Trevor cancelled it explicitly.
- Offer a third theory for the Admin→Setup bug without live data behind it.
- Treat the mobile split text lines as a regression.
