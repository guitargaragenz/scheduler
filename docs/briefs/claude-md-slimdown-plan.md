---
doc_status: live
---

# Plan — slim CLAUDE.md down to about 200 lines

**Goal:** CLAUDE.md loads in full for every session and every subagent. It is 312 lines / ~3,300 words. Cut the length without losing a single rule.

**How:** the rules stay. The stories behind them move out.

## What moves

The six rules under `## Rules` (line 225 to the end) each carry a paragraph explaining the incident that caused them. Those paragraphs move to a new file, `docs/why-the-rules-exist.md`. Each rule in CLAUDE.md keeps its heading, its bullet points, and gains one link: "why this rule exists".

The six:

1. Trevor never runs git himself — the 35 deleted files, 2026-06-14
2. Always confirm scope — the bulk archiving, 2026-05-23
3. Stay on-track during autonomous work — the babysitting problem
4. Documents describe the past — briefs E and F, three build rounds each
5. A scope lock is a page — the 300-line pending-brief
6. Git discipline — one line, nothing to move

Saving: roughly 40 lines.

## What does not move

- Every rule itself, word for word.
- Agent-Team Protocol and the blast-radius file list.
- Model Discipline.
- Workshop rules the code must respect. These are not incident stories, they are facts about how the workshop runs, and a build already went wrong for not knowing one.
- Where things live, Starting a New Session, Departments.

## The one open question — Claude's Role

`## Claude's Role` is 66 lines, the single biggest section, and most of it repeats Trevor's personal instructions: short answers, plain English, `tt` / `tl` / `sz`.

It is duplicated **on purpose**. The file says so: it is there "precisely because it must never depend on an agent choosing to go read a memory file."

Moving it to a linked file defeats that stated reason. So this plan leaves Claude's Role alone unless Trevor says otherwise.

**Trevor's call:** leave it (finish at ~270 lines), or trim the duplication inside it (finish at ~215 lines).

## Expected result

| | Lines |
|---|---|
| Now | 312 |
| Rules backstories moved only | ~270 |
| Plus Claude's Role trimmed | ~215 |

## Verification

- `grep '^###' CLAUDE.md` before and after returns the same list. No rule heading lost.
- Every moved paragraph appears in `docs/why-the-rules-exist.md`.
- Every rule that lost a paragraph has a working link.
