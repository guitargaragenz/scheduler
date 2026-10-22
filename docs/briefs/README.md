# Session briefs

Handoff notes so the next session picks up without re-deriving anything. Read the one
named in your starting prompt, and only that one.

Every brief, spec and plan carries `doc_status:` at the very top:

| `doc_status` | What it means |
|--------------|---------------|
| `live` | Real, current work. Act on it. |
| `parked` | Scoped but deliberately not started, and **not approved**. Don't build it. |
| `closed` | Finished history. A record — **never** a task list, however live it sounds. |

**A brief is a snapshot of the day it was written, not a description of the code.** If a
brief tells you how the app behaves, check the app. `.claude/hooks/warn-closed-brief.py`
warns on any read of a non-`live` doc; that's a backstop, not permission to skip the line.

---

## Live — work that hasn't finished

## Noticed, not scoped


Real problems nobody has picked up, none attached to a brief. Detail in
[BACKLOG.md](BACKLOG.md).

## Parked

None.

Closed work is a one-line history of lessons in [CLOSED.md](CLOSED.md).

---

Designs and specs live in [`../superpowers/specs/`](../superpowers/specs/), not here. A
brief says *what to do next*; a spec says *what we agreed to build*.

- day-list-matches-week-list.md — closed, search fix shipped in PR #94 (`049b7e9`).
- **Week revenue on any week** (PR #98, `d74f5ec`): loads this week + the week on screen on demand. Close Day / Catch Up only see those two weeks — not full history.
- **Jobs Sheet Enter + date sort** (PR #102, `652f7d1`): Enter moves down Hours, Enter on a Tag jumps to its Hours, rows newest JBA date first.
- **Review prompt when invoicing** (PR #111, `b343d9e`): Pomodoro drawer's invoice box says "💬 No Google review found for <customer> — ask them?" or ⭐. Names come from a Google Takeout via `scripts/build-review-lookup.py` (also rebuilds the Review Lookup page). List goes stale until the next Takeout — a live Google feed needs Business Profile API approval (not applied for yet).
- **Invoice entry incl-GST** (PR #113, `25eeba6`): amount boxes take incl-GST; `handleMarkDone` stores ÷1.15 via `exGstFromIncl` (utils/money.js). Revenue and target stay ex-GST; Multitrack is master. Noticed: `BenchWeekPage.sendNext.test.jsx` "a plain tap still closes" fails on main — unscoped.
