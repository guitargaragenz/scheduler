---
name: next
description: "Use when Trevor opens a session and says next, /next, what's next, pick up where we left off, or otherwise wants to start work without naming a brief."
---

# Next

1. **Sync.** `git fetch origin`, then if the tree is clean `git checkout main && git pull --ff-only`.
   Say in one line how far behind the clone was. Tree dirty or mid-merge: say so and stop.
2. **Read `.claude/pending-brief.md` — and nothing else.** Don't follow its links out. If it's
   empty or not `doc_status: live`, say "nothing live" and ask what's next.
3. **Report in plain English, then start:** what's live, which protocol step it resumes at
   (approved but never council-reviewed = step 2), and the first action you're taking now.
