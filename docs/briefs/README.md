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

| Doc | What it does |
|---|---|
| [2026-09-14-part-done-save.md](2026-09-14-part-done-save.md) | **Current — start here.** A ticked part always saves as done. Approved; at council. |
| [2026-09-11-session-handoff.md](2026-09-11-session-handoff.md) | Older handoff — background only. |

The next piece of work gets chosen from Parked, with Trevor — it is not picked off
this page. Start a session with `next`; if this section is still empty, say so.

## Noticed, not scoped

Five real problems nobody has picked up, none attached to a brief. Detail in
[BACKLOG.md](BACKLOG.md).

## Parked — agreed in principle, waiting on something

> **No standing order.** UI work was blocked until the PDF drop shipped and the
> CSV pipeline went. Both happened 2026-07-29 at `1e4186a`, so nothing below is
> blocked now. Unblocked is not approved — the two UI briefs need a yes from me
> before either restarts.

None of these is scoped or approved; each file holds the detail.

| Brief | Waiting on |
|-------|------------|
| [PARKED-2026-08-23-week-marks-row-cap.md](PARKED-2026-08-23-week-marks-row-cap.md) | A fix, agreed but not started. Blast-radius. |
| [parked-stale-description-after-import.md](parked-stale-description-after-import.md) | Nothing — a real bug, just not picked up. Blast-radius. |
| [parked-jobs-sheet-usability-changes.md](parked-jobs-sheet-usability-changes.md) | Nothing. Two small changes left. |
| [blocked-pile-naming-alignment.md](blocked-pile-naming-alignment.md) | Nothing. One finding of four left. |
| [parked-parts-as-a-stuck-reason.md](parked-parts-as-a-stuck-reason.md) | The first Sunday board meeting. |
| [parked-tick-off-from-job-card.md](parked-tick-off-from-job-card.md) | A scope lock and "yp". Questions answered. Blast-radius. |

What each is actually waiting on, in full: [BACKLOG.md](BACKLOG.md).

Closed briefs — kept only because the reasoning still matters — live in [CLOSED.md](CLOSED.md).

---

Designs and specs live in [`../superpowers/specs/`](../superpowers/specs/), not here. A
brief says *what to do next*; a spec says *what we agreed to build*.
