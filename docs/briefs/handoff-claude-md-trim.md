---
doc_status: closed
---

# Handoff — CLAUDE.md trim, part 2

**Shipped at `4597304` (2026-09-11).** CLAUDE.md is 267 → 245 lines; the stories moved
to [docs/why-the-rules-exist.md](../why-the-rules-exist.md). Nothing below is a task list.

## Where things stand

CLAUDE.md is 267 lines, down from 312. The slim-down so far is committed and pushed
as `ab2b573`. Nothing is half-done, the tree is clean apart from an unrelated file.

## The question Trevor asked, still unanswered

He quoted four duplications back and asked "was this fixed in last run?"

| Item | Fixed? |
|---|---|
| "Root cause over patches" pointer bullet | Yes, removed in `ab2b573` |
| Stay-on-track rule repeating the protocol | No — left on purpose, and he was told |
| Short answers / plain English overlap in Claude's Role | No — and he was **not** told |
| Completed-job vs BL-WP near-duplicate | No — kept on purpose, worth keeping |

## What is left to trim

All of it is story or history, not instruction. The destination already exists:
`docs/why-the-rules-exist.md`. Move, don't delete.

- Model Discipline's opening dated paragraph ("Added 2026-07-28 after repeatedly
  hitting rate limits… one `council this` was eleven Opus agents").
- The blast-radius blockquote starting "Corrected 2026-07-28".
- The "Why `ggnz-builder` stays on Opus" paragraph — justification, not instruction.
- Dated incident stories inside three Workshop rules: the 2026-08-05 Build 1 story,
  the 2026-09-03 bench ruling, the 2026-08-04 1635 neck glue story.
- Starting a New Session step 1, the "Corrected 2026-09-11" sentence.
- The Job Tracker decommissioning bullet under Departments — a tool that no longer exists.
- The protocol's closing "Why this matters" paragraph — the other half of the
  stay-on-track duplication, and the half that could go instead.

Roughly 30 lines. **Do not start cutting until Trevor picks what goes.**

## Also waiting on Trevor, unrelated

`.claude/pending-brief.md` holds the vanishing-job scope lock. Written, `doc_status: live`,
uncommitted, unapproved. Don't build it, don't spawn council, don't sweep it into a commit.

## How to edit CLAUDE.md safely

A python3 heredoc through Bash: pull the exact old block as a triple-quoted string,
`assert s.count(old)==1`, then replace. Used three times last session, clean each time.
