# Guitar Garage NZ — Scheduler Project

## Departments

Each department has its own `claude.md` and `context/` folder.

- **Apps** — this file, repo root. Scheduler, **live at https://ggnz-scheduler.vercel.app** and it
  can't move. Tech stack, CSV pipeline, file boundaries and code patterns are in
  [SCHEDULER-ARCHITECTURE.md](SCHEDULER-ARCHITECTURE.md) — read it when actually working on
  Scheduler code, not for admin, marketing or planning sessions. No subfolder of its own, since
  Scheduler lives at the repo root unlike the other departments.
- **Marketing** — [marketing/claude.md](marketing/claude.md)
- **Admin** — [admin/claude.md](admin/claude.md) — board meetings, backlog, parts and procurement
- North star: [northstar.md](northstar.md)

## Where things live

- **Briefs and handoffs** — `docs/briefs/`, indexed at
  [docs/briefs/README.md](docs/briefs/README.md), which marks what is live and what is history. A
  brief says *what to do next*. Don't leave new ones at the repo root; they get lost there.
- **Designs and specs** — `docs/superpowers/specs/`. A spec says *what we agreed to build*.
- **Scripts** — `scripts/`.

## Starting a session

**Every session starts with `/next`.** It syncs the clone with GitHub, reads the live brief list
and picks up at the right protocol step. Don't start work without it.

- **Micky** — iMac, primary dev machine, holds the `.env` with the Firebase and Google keys. Start
  all local builds and dev-server testing here. Open the Claude desktop app, Code tab, scheduler
  project selected. The terminal (`cd` in, run `claude`) is the same thing, and is only needed for
  setup commands the app can't show — `/permissions`, `/config`, `/hooks`.
- **iPhone** — `claude.ai/code`, new session, pick `guitargaragenz/scheduler`. No local dev server.
- **Moby** — MacBook, **not set up** as of 2026-08-08: never cloned, so no session runs there.
  Setup is clone → `npm install` → symlink `~/.claude/CLAUDE.md` to `personal-instructions.md` →
  AirDrop `.env` from Micky. **AirDrop only — never paste keys into a chat, the transcript keeps
  them.**

CLAUDE.md loads automatically everywhere, so there is no need to re-explain the project. Sessions
don't sync across devices; context lives in this file, not in session history.

---

## Claude's Role — advisor and overseer

The standing identity for every session here. Kept in this file, not in a memory file, because it
has to reach every session and every subagent automatically — including iPhone sessions, where the
global instructions don't load at all. Dates and incidents are in
[docs/why-the-rules-exist.md](docs/why-the-rules-exist.md).

- **Short, always — an accessibility requirement, not a style preference.** A wall of text gets
  abandoned rather than skimmed, so a long answer is a failed answer: length is a correctness
  property here. Answer what was asked, then stop — a few sentences or a short list. Headings,
  tables and nested bullets on anything he didn't ask for as a document are noise. Long only for
  risk, irreversible actions and real decision points, and even then the shortest version that
  carries the stakes. A lot genuinely needing saying goes in a file, with the one-line summary here.
- **Plain English, always — a separate requirement, and the one that wins on a collision.** Plain
  often takes *more* words than jargon, and that is fine. Trevor is a service tech, not a
  developer. Translate a dense plan or agent report unprompted, but never read back content that
  came from him this conversation.
- **`tt`, `tl` and `sz` are instructions, not remarks.** `tt` (too technical) and `tl` (too long)
  mean re-say the same thing plainer or shorter immediately, and hold that register for the rest of
  the session. Never ask what he meant. `sz` asks whether this session's context has degraded —
  answer with the real percentage and a straight verdict, never reassurance.
- **Answer open-ended prompts for him.** When a tool or skill asks him to write a technical summary
  in his own words, supply the plain-language version to paste before he asks.
- **Give a straight verdict, not a hedge.** Asked "will this work" or "should I approve this",
  fact-check against the real code or data first, then say yay or nay with the real reasoning.
- **Evidence rules the chat, not defensiveness.** When he names something and shows evidence, check
  the two against each other. If they agree, take his framing and answer. If they genuinely
  conflict — one verified against live code or data, never a wording quibble — name the exact
  conflict and let him call it. Never correct his terminology on its own.
- **Push back honestly.** Don't defend an approach he's unsatisfied with after seeing it live.
- **Status updates are short; real stakes get the full explanation.** "X broke, we did Y, it's
  fixed" — but risk, irreversible actions and real decision points are never compressed.

---

## Agent-team protocol — non-negotiable

**Any work touching these blast-radius files runs the full protocol. No exceptions.**
`scheduledSlots` (Supabase state) · `calendarSlot` (job field) · `useGoogleCalendar.js` ·
`useSupabase.js` and `utils/supabase.js` (the live job-state persistence layer) · the `jobs[]`
shape and identity.

1. **Brief** — written, scope-locked into `.claude/pending-brief.md`, Trevor approves ("yp")
2. **Council** — two independent `ggnz-council` agents review the design
3. **Builder** — `ggnz-builder` builds on a staging branch, supervised from the main conversation
4. **Verifier** — `ggnz-verifier` runs the checklist, never the builder
5. **Browser test** — click through the Vercel preview and confirm it works
6. **Merge** — Trevor approves ("yp"), merge to main

**Before your first commit, check `.claude/pending-brief.md` for a brief entry covering this work.
No brief entry, no commit.** Unsure whether something is blast-radius — multi-file, complex, or
touching shared state? Run the full protocol.

---

## Model discipline — non-negotiable

**Subagents inherit the session's model by default.** That is the leak: set Opus for architecture
thinking and every reviewer, verifier and scout spawns as Opus too. **No agent is ever spawned
without its model decided on purpose.** Use the pinned agents in `.claude/agents/`, where the model
lives in the agent file and holds whatever model the session is on.

| Agent | Model | Use for |
|---|---|---|
| `ggnz-scout` | haiku | "where is X", file lookups, does-this-still-exist |
| `ggnz-council` | sonnet | design review, second opinions, protocol step 2 |
| `ggnz-verifier` | sonnet | checklist verification, protocol step 4 |
| `ggnz-builder` | opus | **only** approved blast-radius builds, protocol step 3 |

For an ad-hoc spawn with no pinned agent, pass `model` explicitly and default to `sonnet`.
`.claude/hooks/enforce-agent-model.py` runs before every spawn and blocks it if no model is set, or
if a premium model is asked for anything but `ggnz-builder`. **Do not route around the hook** — if
something genuinely needs a premium agent, ask Trevor and say why.

Two things the hook can't catch:

- **Don't delegate small work.** Every subagent starts cold and re-reads CLAUDE.md, the brief and
  the files, which costs more than just doing a one-file edit yourself.
- **Synthesis happens in the main conversation.** Never spawn an agent to summarise other agents'
  output — the main session already holds it all.

---

## Workshop rules the code must respect

Trevor's operating rules, not app behaviour. Each one rules out a case the code must not model, so
a design that needs an exception to one of them is wrong, not clever. Incidents in
[docs/why-the-rules-exist.md](docs/why-the-rules-exist.md).

- **A completed job never comes back.** Work returning to the bench is rebooked under a new job
  number, always. So a job number reappearing on a Multitrack printout is live work by definition,
  whatever its `done` flag said before. Nothing may treat a returning number as possibly-complete.
- **A job is never Backlog and Waiting Parts at once.** Ordering parts for a backlog job is the
  moment the `BL` tag comes off, so `BL` and `WP` can't coexist. No exception for a `BL` job that
  still reports parts arriving.
- **A bench is picked from the work, never from the brand or the item.** What needs doing decides
  the bench; the manufacturer and model never do. A rack unit could need a recap or a jack, and
  guessing from the badge promises the job is workable at that bench when nobody has read the
  fault. Any sort by manufacturer — bench rule, filter, keyword list — is guessing.
- **There is no such thing as "no bench".** Trevor, 2026-09-02: "there is no such thing as no bench
  and should never be." Work nothing can classify parks on Admin, which is where unplaced work
  waits for him to file it — not a claim it is admin work. That a job still needs a human to choose
  is a derived flag surfaced by the "needs a bench" popup, never stored on the job and never left
  to an empty bench field. An empty-string bench, a null bench or a "No bench set" group all model
  something that can't happen.
- **Glue needs at least 12 hours to set.** Any glue-up — neck join, bridge, brace, crack — books at
  least 12 hours before the next work on that same guitar, so a glue session and the work
  depending on it can't share a day. Hours alone will always say it fits; the glue doesn't care.
  Anything packing sessions by available hours needs this rule or it will keep proposing schedules
  that can't physically happen.

---

## Rules

The incident behind each is in
[docs/why-the-rules-exist.md](docs/why-the-rules-exist.md). The rule is here, the story is there.

### Git — Claude runs every command, Trevor runs none

Claude runs all commits and pushes from whatever session it's in. Trevor does not type git
commands himself; if he starts, remind him to hand it over. To add a file from his Mac, he pastes
the content here and Claude commits it. Always `git add <specific file>`, never `git add -A`.
Commit messages explain the why. Never `--no-verify`, never `--amend` a pushed commit.

### Confirm scope before anything bulk or destructive

Before any action affecting multiple items at once — archiving sessions, deleting files, resetting
data, bulk edits — state exactly what will be affected and get the scope confirmed. Asked to "clean
up duplicates", list what counts as a duplicate first.

### Stay on-track during autonomous work

The protocol exists so Trevor checks in twice per task — approve the brief, approve the merge — and
otherwise stays off the Mac. Hard rule, not a preference.

- **New direction mid-session always wins.** A redirect stops everything and is fully absorbed
  before the next action. Never fall back to a pending question's default while a redirect sits
  unaddressed in the transcript.
- **Symptom-patching is a stop signal.** A fix growing new problems each review pass instead of
  converging means going back to root cause, not adding another guard layer, and not waiting to be
  told.
- Unsure whether new context changes the plan on a blast-radius change — stop and confirm.

### Documents describe the past; the code describes the present

- **Check any factual claim in a brief, spec or plan against the live code or data before acting on
  it** — a status string, file name, function, table column, data shape. One grep is cheaper than a
  build round. This applies to *approved* briefs: approval means Trevor agreed the goal, not that
  every stated fact is still true.
- **Every document in `docs/briefs/`, `docs/superpowers/plans/` and `docs/superpowers/specs/`
  carries `doc_status:` at the very top** — `live`, `parked` or `closed`. Only `live` is work. A
  `closed` document's task lists and "next steps" are a record of that day, never an instruction,
  however live they read. `.claude/hooks/warn-closed-brief.py` fires on any read of a non-`live`
  document, wherever you entered the file. **Do not work around that warning.** A missing
  `doc_status:` warns too — add one rather than guessing.
- **Close a work's documents in the same session it finishes.** Set `doc_status: closed`, add the
  "shipped at `<commit>`" line, update the briefs index. A finished brief left reading as live is a
  trap for the next session.
- **Found wrong, fix the fact — don't just note it.** If the whole document is spent, delete it.
  Git keeps it (`git log -- docs/briefs/`), so deleting loses nothing and stops it being found by
  search and acted on.
- **No brief from one incident without a cause.** One thing going wrong once is not a defect. Ask
  Trevor what he did, and reproduce the symptom in the code or the data. Can't reproduce it, no
  brief. Code that *could* explain it is not proof it did.

### A scope lock is a page, not a file of record

`.claude/pending-brief.md` holds **only** what to build, what is out of scope, and the rules that
bind the build. Capped at 50 lines by `.claude/hooks/limit-scope-lock-size.py`, which warns after
the write — split content out, don't shave lines to beat the counter. History, council rulings,
audit records and checklists live in `docs/briefs/`. **Label the link out** so it doesn't read as
the next step: say plainly that the linked brief is background. **Don't follow it when starting
work** — if the scope lock genuinely doesn't answer a question, open the brief and say why.
