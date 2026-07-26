# Session refresh — Continue Brief D (Sunday Board Meeting rebuild), re-verify latest fix, then Live Test

Continuing work in the **GGNZ SCHEDULER PROJECT** repo at
`/Users/trevorcollings/Library/Mobile Documents/com~apple~CloudDocs/Desktop/GGNZ SCHEDULER PROJECT`,
on staging branch **`brief-d-sunday-board-meeting-supabase`** (branched off clean `main`,
never pushed or merged). Goal of this session: decide on re-verifying the latest commit,
formally close out the Brief document, then move to the Supabase SQL migration and Live Test.

Follow the Agent-Team Protocol in this repo's `CLAUDE.md`/`AGENTS.md`: Brief → Council →
Builder → Independent Verifier → Live Test → Merge, with Trevor's explicit **"yp"** required
at each gate. Trevor never runs git himself — the assistant runs every git command.

## Where things stand

Brief D rebuilds the Sunday Board Meeting as a live Supabase-backed chat ritual (see
`.claude/pending-brief.md` for full scope). Builder's original 4-commit implementation was
independently verified (6/7 items PASS). Since then, two more real bugs were found and fixed
on this branch:

1. **`normalizeJobsFromDb()` in `src/hooks/useSupabase.js`** was emitting uppercase
   `VB`/`BL`/`PJ` keys instead of the app's actual lowercase `vb`/`backlog`/`project`
   convention, and never called `deriveJobStatusFlags()`. Fixed via Builder agent, commit
   `1cc0e43`. **Independently re-verified — all 5 checks PASS.**
   - Key distinction (Trevor pushed back initially, then approved with "yp"): CSV/DB
     *column* names have always been uppercase-ish (`VB`/`BL`/`PJ`) — that part never
     changed and Trevor was right about it. The bug was that the in-app **job object**
     has always used lowercase `vb`/`backlog`/`project` (set in `src/data/jobs.js`), and
     this one function's output didn't match that shape.
   - This fix is documented in `.claude/pending-brief.md` as "Scope item 5."

2. **`toJobRow()` / `JOB_COLUMN_MAP` in `src/utils/supabase.js`** — found while investigating
   Trevor's "probably best to clean it up right?" question about what the Verifier had called
   "harmless dead code." **The Verifier's dead-code claim was wrong** — `toJobRow()` is live,
   called from `saveJob()` and the batch-write path, with a real caller chain through
   `App.jsx:767` → `pickMasterFields()` → `saveJob()` → `toJobRow()`. Stale uppercase
   `VB`/`BL`/`PJ` keys in `JOB_COLUMN_MAP` were silently dropping `vb`/`backlog`/`project`
   from partial writes on this path (not destructive — omitted columns just aren't touched
   in a Supabase upsert, not nulled — but real functionality loss). Fixed directly (not via
   subagent, since it was small and self-contained), committed as `978940f`. Verified via
   `npm run build` (clean) and `git status --short` (only intended file changed). **Not yet
   independently re-verified by a fresh Verifier pass**, and **not yet added to
   `.claude/pending-brief.md`** — both still open.

Lesson reinforced this segment: never trust a subagent's "dead code" / "safe to ignore"
self-report without independently grepping/reading the actual code — this is the second
time in this Brief that a Verifier's own claim needed direct correction.

## Next steps

1. **Ask Trevor directly** (this was left as an open question, unanswered before handoff):
   does commit `978940f` (the `toJobRow()` fix) need a fresh Independent Verifier pass, or
   is it small enough to eyeball at Live Test?
2. **Update `.claude/pending-brief.md`** to formally document the `toJobRow()` fix — add it
   under "Scope item 5" or as a new "Scope item 6," per the repo's "no brief entry, no
   commit" norm (the commit already happened; the Brief doc hasn't caught up).
3. **Run the pending Supabase SQL migration manually** in the Supabase SQL editor: the new
   `parts_to_order` table, plus `completed_jobs`'s new `invoice_amount`/`week_key` columns.
   Exact SQL block is in `docs/supabase-schema.sql` — pull it out for Trevor to paste in.
4. **Live Test** — Trevor at the keyboard, ideally this coming Sunday: confirm quick-wins/
   completed/admin auto-report correctly, live-input steps genuinely pause for his input, and
   after "Plan for the coming week," the schedule/focus list/parts list all show up correctly
   in the actual app. Requires step 3 done first.
5. **Merge** — only on Trevor's explicit "yp", executed only by the assistant via git, never
   by Trevor.

## Files to open (read these, don't re-derive)

- `.claude/pending-brief.md` — authoritative, amended scope document; current Status line
  says "VERIFIER COMPLETE, SCOPE AMENDED AGAIN, RE-APPROVED ('yp' 2026-07-25) — Builder
  fixing item 5, then re-verify" — this line is now stale and needs updating once the
  `toJobRow()` fix is folded in and the re-verify question is resolved.
- `src/hooks/useSupabase.js` — `normalizeJobsFromDb()`, fixed and re-verified (commit
  `1cc0e43`). Reference for the lowercase + `deriveJobStatusFlags()` convention.
- `src/utils/supabase.js` — `toJobRow()`, `JOB_COLUMN_MAP`, new `JOB_BOOLEAN_YN_COLUMN_MAP`
  (commit `978940f`), the fix awaiting re-verification and Brief documentation.
- `src/data/jobs.js` (lines ~214-216) — canonical lowercase `vb`/`backlog`/`project` shape,
  and the uppercase `VB`/`BL`/`PJ` CSV header convention, for confirming casing questions.
- `docs/supabase-schema.sql` — schema reference; source for the still-unrun `parts_to_order`
  table + `completed_jobs` column migration SQL.

## Avoid repeating

- Don't take a Verifier's "dead code, no live risk" or "safe to ignore" conclusion at face
  value — grep/Read the actual call chain yourself first (this cost real rework once already
  in this Brief).
- Don't conflate DB/CSV *column*-name casing (uppercase `VB`/`BL`/`PJ`, unchanged, correct)
  with in-app *job-object* casing (lowercase `vb`/`backlog`/`project`) — this distinction is
  the root of both bugs fixed in this segment and will likely resurface elsewhere in the
  Supabase read/write paths.

## Skills to run

- None required to start — pick up directly with step 1 (ask Trevor about re-verification)
  and step 2 (Brief doc update). Continue using the Agent-Team Protocol already established
  in this repo for any further Builder/Verifier cycles.
