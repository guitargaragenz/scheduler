---
name: protocol
description: "Use when a piece of GGNZ Scheduler work needs building — a feature, a fix, anything touching shared state or more than one file. Runs the agent-team protocol end to end: brief, council, builder, verifier, browser test, merge, close the documents. Also use when Trevor says run the protocol, protocol this, or asks to build something without naming which step to start at."
---

# Protocol

The agent-team protocol from [CLAUDE.md](../../../CLAUDE.md), run as one workflow instead of
from memory. It exists so Trevor checks in twice — approve the brief, approve the merge — and
otherwise stays off the Mac.

**The step that gets skipped is the last one.** A session that ends after the merge leaves a
brief reading as live work, and the next session picks it up as a task list. Step 7 is not
optional bookkeeping; it is the step this skill exists to make unskippable.

## Before anything

Read [CLAUDE.md](../../../CLAUDE.md) if it isn't already loaded — the blast-radius list, the
model discipline table and the git rules all bind here.

Work out whether this is blast-radius work: does it touch `scheduledSlots`, `calendarSlot`,
`useGoogleCalendar.js`, `useSupabase.js`, `src/utils/supabase.js`, or the `jobs[]` shape? If
you are unsure, or it spans several files, treat it as blast-radius and run every step. The
cost of a needless council round is minutes. The cost of skipping one is a bad merge.

## Step 1 — Brief

Write it to `.claude/pending-brief.md`, replacing whatever is there. The previous occupant is
safe in git history; say in the new brief where it went (commit and merge sha).

A brief needs, at minimum:

- **The problem in Trevor's words.** Quote him. It is the thing the build is judged against.
- **Scope**, split into merges if it is more than one sitting.
- **A "not in scope" list** that explicitly rules out the blast-radius files unless the work
  genuinely needs them.
- **A numbered checklist for the verifier.** Number it once, at the end, so renumbering later
  doesn't desynchronise from the text.
- `doc_status: live` on line 1.

**Check every factual claim against the live code before you write it down.** File names,
line numbers, status strings, table columns, function names. Briefs E, F and G each lost a
build round to a fact that was true when written and wrong when read. One grep is cheaper
than a build round.

**If the work has a visible shape — a page, a panel, a new control — build a mockup artifact
before the brief is final and show Trevor.** On 2026-08-03 this changed the design twice
before a line of code existed: a Settings entry point became tabs, then a sidebar list became
one tab per project. Both would have been a rebuild if found after the build. It costs one
artifact and it is the cheapest round-trip available.

Then stop. Trevor approves with "yp". **No brief entry, no commit** — that rule is in CLAUDE.md
and it binds you as much as the builder.

## Step 2 — Council

Two `ggnz-council` agents, spawned **in parallel, in a single message**, each told it is
reviewer 1 or 2 of 2 and working independently. Model is pinned in the agent file; do not
override it.

Give each one a different emphasis so you get two reviews rather than the same review twice —
one on the mechanics (does the build hold together, what will bite), one on the product call
(is this the right thing to build at all).

Both are required to hand back a claims table before their verdict — every fact in the brief
marked confirmed, wrong, or can't-verify-from-code. That requirement lives in the agent file,
so you do not need to repeat it, but you do need to read the table rather than skipping to the
verdict.

**A "not yet" verdict stops the build.** If either reviewer marks a load-bearing claim wrong or
unverifiable, the answer goes back to Trevor before step 3 — the fact gets settled first, and
the brief gets corrected. Do not proceed on the grounds that the fix looks right anyway.

When they report: fold their rulings into the brief text itself, and add a short section at
the end recording what changed and why. **Do not leave the corrections only in chat** — the
builder reads the file, not the conversation.

Synthesis happens here, in the main session. Never spawn an agent to summarise other agents.

## Step 3 — Builder

One `ggnz-builder`. This is the only agent allowed on a premium model, because it writes to
live job state.

Tell it:

- The brief is scope-locked; its "not in scope" list is binding.
- Which staging branch to use (`staging/<short-name>`), and that `main` and the brief's own
  branch are off limits.
- To check the brief's facts against the code, because line numbers move.
- To link the mockup artifact if there is one, matching its shape but the app's own styling.
- To run the full test suite and add tests for the new behaviour.
- To `git add` specific files, never `-A`.
- To report back what it built, anything in the brief it found to be wrong, any decision the
  brief didn't cover, and the real test numbers.

## Step 4 — Verifier

One `ggnz-verifier`, and **never the agent that did the build**.

Point it at the brief explicitly, including which branch to read it from — after a merge,
`main`'s copy of `.claude/pending-brief.md` may be a different, older brief entirely.

Ask for pass / fail / can't-verify per numbered item, with file:line evidence. Anything needing
a browser is "can't verify" — tell it to say what a human should click rather than guess.

## Step 5 — Browser test

Open a draft PR for the staging branch so Vercel builds a preview, then give Trevor the link
and a short numbered list of what to click — specifically the items the verifier couldn't
reach. Keep it to the few things that would actually fail.

The Vercel preview toolbar sits at the bottom of preview builds and can cover a control. It
is not in production. Say so if he hits it.

## Step 6 — Merge

Trevor approves with "yp". Merge the build PR.

## Step 7 — Close the documents, in this session

Not later, not next session. A finished brief left reading as live is a trap set for whoever
comes next.

1. `.claude/pending-brief.md` — `doc_status:` to `closed`, retitle it as a record rather than
   a pending brief, and add: shipped-at commit, test numbers, every decision the builder made
   that the brief didn't cover, and any checklist item that could not be met as written and why.
2. `docs/briefs/README.md` — record what shipped in plain English, plus anything noticed in
   passing that wants its own conversation later. That file is what the `next` skill reads.
3. Commit and push both, open a PR, merge it.

## Throughout

- **Short answers to Trevor, always** — plain English, no jargon. Accessibility requirement,
  not style. Status updates are one or two sentences; full explanation only for risk,
  irreversible actions and genuine decision points.
- **Claude runs every git command.** Trevor never types git himself.
- **If a fix keeps growing new problems each review pass, stop and go back to root cause.**
  Don't add another guard layer, and don't wait to be told.
- **A redirect mid-session always wins.** Re-orient fully before the next action.
