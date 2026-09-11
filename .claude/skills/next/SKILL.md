---
name: next
description: "Use when Trevor opens a session and says next, /next, what's next, pick up where we left off, or otherwise wants to start work without naming a brief. Also use when a session needs to establish which GGNZ Scheduler work is currently live before touching anything."
---

# Next

Starts a session on whatever work is live right now, at the right protocol step. Nothing
about the current build is written in here — it is all discovered from the repo, because a
hardcoded brief name goes stale the day the brief ships.

## Do this, in order

0. **Sync first — nothing comes before it.** `git fetch origin`, then if the tree is clean
   `git checkout main && git pull --ff-only`. Say in one line how far behind the clone was.
   A session once burned most of a context window re-fixing a bug that had already shipped,
   purely because the clone was 71 commits behind. Stale clone in, stale work out.
1. **Read [docs/briefs/README.md](../../../docs/briefs/README.md).** Its **Live** table is
   the source of truth. Ignore Parked and Closed for now. More than one live item: take the
   one marked **"Current — start here"**, else the top row, and say that is what you did.
2. **Read the scope lock the Live table points at** (usually `.claude/pending-brief.md`) and
   check its own `doc_status:` says `live`. If the two disagree, say so and stop — the index
   is wrong and that is worth a sentence to Trevor first.
   **Then stop reading.** The scope lock links out to the full brief for background. Don't
   follow that link to start — it can be hundreds of lines and spends the session before any
   work happens. Open it only if the scope lock doesn't answer a real question, and say why.
3. **Read the blockquote above the Parked table** in the same README. If it sets a standing
   order it fixes the order of work and overrides any instinct to start with a small visible
   change. If it says there is none, nothing in Parked is blocked — but nothing there is
   approved either, so it still doesn't get started without a yes from Trevor.
4. **Work out which protocol step this resumes at** from the brief's own text, not from
   assumption: 1 brief → 2 council → 3 builder → 4 verifier → 5 browser test → 6 merge. A
   brief Trevor approved that council has never seen resumes at **2**, not 3. Approved is not
   reviewed.
5. **Check one fact from the brief against the live code** — the one the build turns on: a
   status string, a column name, a function name. Briefs have lost whole build rounds to a
   fact that was true the day it was written. One grep is cheaper than a build round.
6. **Report in plain English, then start.** Four things: which brief is live and what it does;
   which step it resumes at and why; what the blockquote above Parked says about what is *not*
   being touched; the first action you are taking now.

Step 6 finishes by actually starting. This is not a status report he has to reply to, and not
a menu of live items to pick from.

## Two other ways this goes wrong

- **Offering a parked UI change as a quick win** while a data build waits on council.
- **Closing the scope lock because a brief said to.** If it also holds approved scope for work
  that hasn't started, closing it turns approved scope into history.
