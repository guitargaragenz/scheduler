---
doc_status: closed
---

# A new session is ~60% full before any work starts

Written 2026-08-08, after a fresh session hit ~60% having done nothing but read the
scope lock. Three previous attempts to "sort context" all failed, for the same reason:
each one fixed something in this repo, and the cost is not in this repo.

## The one measured fact

A brand-new session, two reads in (the scope lock and the briefs index), sat at ~60%.
Those two reads are about 8k tokens — roughly 10%.

**So the session started near 50% before a single file was opened.** That 50% is the
whole problem. Everything else is noise.

## What has been ruled out, with evidence

- **MCP servers.** None are configured. `~/.claude.json`, `~/.claude/settings.json`,
  the Claude desktop config, and this repo — all have an empty `mcpServers`. The IMAP
  one was the last, and Trevor deleted it. The browser / computer-use / simulator tools
  that appear in a session are built into the app; they are not installed and cannot be
  switched off.
- **The scope lock.** Capped at 50 lines last session (`45804a8`) and holding — 396
  words. That fix worked. It is not the leak.
- **Junk file reads.** The earlier audit (`65cf5ff`) added deny rules for
  `node_modules`, `dist`, lockfiles. Also worked. Also not the leak.
- **Permission lists.** `.claude/settings.local.json` is long, and it looks like it
  governs this. It does not. **Allow/deny controls what Claude is asked permission for,
  not what loads into context.** This is the trap that made a past round look like a
  context fix when it was not one.

## What is still unmeasured

The ~50% baseline itself. Candidates, in no particular order and none of them checked:
the system prompt, tool definitions, the built-in skill catalogue, project CLAUDE.md
(~3,800 tokens), and the auto-loaded memory index.

**Nobody has ever actually looked at the real numbers.** Every round so far has run on
an estimate, including two wrong ones in the session that produced this brief.

## Next step — measure before touching anything

Run `/context-audit` (it starts by running `/context`) and read the real per-section
breakdown. Do not propose a fix before that output exists.

Only two things are known to be ours and known to be trimmable, and both are small:

- `CLAUDE.md` — ~2,840 words, auto-loads every session.
- The briefs index — ~2,800 words, read by `/next` every session, because its table
  cells have grown into paragraphs. Worth splitting the reasoning out of, but it is
  ~4k tokens. **It cannot be the 50%.**

## The rule this brief exists to enforce

**Do not fix this from inside the repo again until the measurement says the repo is the
problem.** Three rounds have now been spent trimming files that add up to under 10%.
That is the "lots of motion, nothing fixed" pattern, and it is a stop signal.

If the audit shows the baseline is the app itself, the honest answer is that it cannot
be fixed here — and the real tool is shorter sessions and `/re-fresh`, not another hook.
Say that plainly rather than shipping a fourth fix that changes nothing.
