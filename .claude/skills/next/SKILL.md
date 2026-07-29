---
name: next
description: "Use when Trevor opens a session and says next, /next, what's next, pick up where we left off, or otherwise wants to start work without naming a brief. Also use when a session needs to establish which GGNZ Scheduler work is currently live before touching anything."
---

# Next

Starts a session on whatever GGNZ Scheduler work is actually live right now, and at the right
protocol step. Nothing about the current build is written into this skill — it is all discovered
from the repo — because a hardcoded brief name goes stale the day the brief ships.

## Do this, in order

1. **Read [docs/briefs/README.md](../../../docs/briefs/README.md).** Its **Live** table is the
   source of truth for what is current. Ignore the Parked and Closed tables for now.
2. **Read the brief the Live table points at**, and check its own `doc_status:` line says `live`.
   If the Live table and the `doc_status:` line disagree, say so and stop — the index is wrong and
   that is worth one sentence to Trevor before any work happens.
3. **Read the standing-order blockquote above the Parked table** in the same README. It fixes the
   order of work. Whatever it says overrides any instinct to start with a small visible change.
4. **Work out which protocol step the work resumes at**, from the brief's own text — not from
   assumption. The steps are: 1 brief → 2 council → 3 builder → 4 verifier → 5 browser test →
   6 merge. A brief Trevor approved that council has never seen resumes at **2**, not 3.
5. **Verify one fact from the brief against the live code before acting on it.** Pick the fact the
   build turns on — a status string, a column name, a function name. Briefs E, F and G each lost a
   build round to a fact that was true when written. One grep is cheaper than a build round.
6. **Report to Trevor in plain English, then start.** Four things, in this order:
   - which brief is live, and one line on what it does
   - which protocol step it resumes at, and why that step
   - what the standing order says is *not* being touched
   - the first action you are taking now

## What this is not

Not a status report he has to reply to. He said "next" to get work moving — finish step 6 by
actually starting, not by asking which of the live items he wants.

If the Live table holds more than one item, the one marked **"Current — start here"** is the one.
If none is marked, take the top row and say that is what you did.

## Where the pieces live

| Thing | Where |
|---|---|
| What is live, parked, closed | `docs/briefs/README.md` |
| The current scope lock | whatever the Live table points at — often `.claude/pending-brief.md` |
| The protocol, the blast-radius file list, model discipline | `CLAUDE.md` |
| Tech stack, CSV pipeline, code patterns | `SCHEDULER-ARCHITECTURE.md` |

## Common mistakes

- **Starting a build that council hasn't reviewed.** Trevor approving the brief is step 1, not
  step 2. Approved ≠ reviewed.
- **Offering a parked UI change as a quick win** while a data build waits on council. The standing
  order exists precisely to stop that.
- **Trusting the brief's facts.** Documents describe the past; the code describes the present.
- **Closing the scope lock because a brief said to.** If a file also holds approved scope for work
  that hasn't started, closing it turns approved scope into history.
