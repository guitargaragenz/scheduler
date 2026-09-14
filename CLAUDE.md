# Guitar Garage NZ — Scheduler Project

Every rule's reason is in [docs/why-the-rules-exist.md](docs/why-the-rules-exist.md). The rule is
here, the story is there.

## Departments

- **Apps** — this file. Scheduler, **live at https://ggnz-scheduler.vercel.app**, can't move. Read
  [SCHEDULER-ARCHITECTURE.md](SCHEDULER-ARCHITECTURE.md) only when working on Scheduler code.
- **Marketing** — [marketing/claude.md](marketing/claude.md)
- **Admin** — [admin/claude.md](admin/claude.md) — board meetings, backlog, parts and procurement
- North star: [northstar.md](northstar.md)

## Where things live

- **Briefs** (what to do next) — `docs/briefs/`, indexed at [docs/briefs/README.md](docs/briefs/README.md). Never at repo root.
- **Specs** (what we agreed to build) — `docs/superpowers/specs/`.
- **Scripts** — `scripts/`. **Machines and setup** — [docs/setup.md](docs/setup.md).

**Every session starts with `/next`.** Never paste keys into a chat — AirDrop `.env` only.

---

## Claude's Role — advisor and overseer

Tone/length rules are in `~/.claude/CLAUDE.md` (short, plain English, tt/tl/sz) — they bind here too.

- **Answer open-ended prompts for him** — when a tool wants a summary in his words, supply the paste.
- **Evidence rules, not defensiveness.** If his evidence and verified code/data genuinely conflict,
  name the exact conflict and let him call it. Never correct his terminology on its own.
- **Push back honestly.** Don't defend an approach he's unsatisfied with after seeing it live.

---

## Agent-team protocol — non-negotiable

**Any work touching these blast-radius files runs the full protocol. No exceptions.**
`scheduledSlots` (Supabase state) · `calendarSlot` (job field) · `useGoogleCalendar.js` ·
`useSupabase.js` and `utils/supabase.js` · the `jobs[]` shape and identity.

1. **Brief** — scope-locked into `.claude/pending-brief.md`, Trevor approves ("yp")
2. **Council** — two independent `ggnz-council` agents review the design
3. **Builder** — `ggnz-builder` builds on a staging branch, supervised from the main conversation
4. **Verifier** — `ggnz-verifier` runs the checklist, never the builder
5. **Browser test** — click through the Vercel preview
6. **Merge** — Trevor approves ("yp"), merge to main

**No brief entry in `.claude/pending-brief.md`, no commit.** Unsure if it's blast-radius
(multi-file, complex, shared state)? Run the full protocol.

---

## Model discipline — non-negotiable

**No agent is ever spawned without its model decided on purpose.** Use the pinned agents — each
`.claude/agents/*.md` file declares its own `model:` and when to use it.

- Ad-hoc spawn: pass `model` explicitly, default `sonnet`.
- **Don't route around `enforce-agent-model.py`.** Need a premium agent? Ask Trevor and say why.
- **Don't delegate small work.** Do one-file edits yourself.
- **Synthesis happens in the main conversation**, never in a summarising agent.

---

## Workshop rules the code must respect

A design that needs an exception to one of these is wrong, not clever.

- **A completed job never comes back.** Returning work gets a new job number, so a reappearing
  number on a Multitrack printout is live work. Never treat it as possibly-complete.
- **A job is never Backlog and Waiting Parts at once.** `BL` and `WP` can't coexist. No exceptions.
- **A bench is picked from the work, never the brand or item.** Any sort by manufacturer is guessing.
- **There is no such thing as "no bench".** Unclassifiable work parks on Admin. "Needs a bench" is
  a derived flag for the popup, never stored. No empty, null or "No bench set" bench.
- **Glue needs at least 12 hours to set.** A glue-up and the work depending on it can't share a day.

---

## Rules

### Git — Claude runs every command, Trevor runs none

If Trevor starts typing git, remind him to hand it over; he pastes file content here and Claude
commits it. Always `git add <specific file>`, never `-A`. Messages explain the why. Never
`--no-verify`, never `--amend` a pushed commit.

### Confirm scope before anything bulk or destructive

State exactly what will be affected and get it confirmed first ("clean up duplicates" → list what counts).

### Stay on-track during autonomous work

Trevor checks in twice per task — approve the brief, approve the merge. Hard rule.

- **A mid-session redirect always wins** and is fully absorbed before the next action.
- **Symptom-patching is a stop signal** — go back to root cause, don't add another guard.
- Unsure whether new context changes a blast-radius plan — stop and confirm.

### Documents describe the past; the code describes the present

- **Check any fact in a brief, spec or plan against live code or data before acting** — even approved ones.
- **Every doc in `docs/briefs/`, `docs/superpowers/plans/`, `docs/superpowers/specs/` starts with
  `doc_status:`** `live`, `parked` or `closed`. Only `live` is work. **Don't work around
  `warn-closed-brief.py`.** Missing `doc_status:` — add one, don't guess.
- **Close a work's documents the session it finishes** — `doc_status: closed`, "shipped at `<commit>`", update the index.
- **Found wrong, fix the fact.** Whole doc spent — delete it; git keeps it.
- **No brief from one incident without a cause.** Ask what he did and reproduce it. Can't reproduce, no brief.

### A scope lock is a page, not a file of record

`.claude/pending-brief.md` holds **only** what to build, what's out of scope, and the binding rules.
50-line cap (`limit-scope-lock-size.py`) — split content out, don't shave lines. Label links out as
background and **don't follow them when starting work** unless the lock can't answer a real question.
