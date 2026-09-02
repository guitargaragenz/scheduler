# Handoff — the keyword builds are reverted, and what's actually left

doc_status: closed

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
**Not merged. It needs Trevor's approval.**

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

## The one real bug found, not fixed

`DailyLogPage.jsx:470` prints `{s.hoursRange}h`. Split pieces have no
`hoursRange`, so every split line renders as `Fretwork · h` with no number.
Broken since it was written (`e498496`), unrelated to any of the above.
Trevor was asked whether to fix it and had not answered.

Open alongside it: whether those split lines should be tappable at all. Also
unanswered — that would be a new feature, not a rollback.

## Also shipped this session

`2dd856e` adds **"Evidence rules the chat, not defensiveness"** to Claude's
standing role in CLAUDE.md. Written after Claude spent two turns correcting
Trevor's name for a screen he had named correctly and screenshotted. The test:
do his words and his evidence agree? If yes he is right — take his framing. If
they genuinely conflict, name the exact conflict. Terminology alone is never
grounds to correct him.

## The next task, in order

1. Trevor reviews PR #60 and decides whether the revert merges.
2. **Only after that**, and only if the Admin→Setup problem is still live, the
   cause is still unknown. Do not guess at it — two theories died this session.
   It needs the jobs read off the board against Multitrack, or a session on
   Micky with `.env`, because live job data is not readable from a web session.

## Do not

- Revive the To Be Invoiced fix. Trevor cancelled it explicitly.
- Offer a third theory for the Admin→Setup bug without live data behind it.
- Treat the mobile split text lines as a regression.
