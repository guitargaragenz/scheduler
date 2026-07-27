# Re-fresh — PDF-drop import: scope agreed, council not yet run

**Written:** 2026-07-28. **Status: scope confirmed by Trevor, no code written, council not run.**

## Where this got to

Trevor confirmed the scope for the PDF-drop import feature. The next action is running
the council — and Trevor specifically wants the **`llm-council` skill**, not the 2-agent
council built into the `/scope` skill. See "The council decision" below; this matters and
was the last thing under discussion when the session ended.

---

## The agreed scope (Trevor's confirmed answers)

**Goal** — Trevor drops the Multitrack PDF into the Scheduler in his browser and new jobs
appear. No DropBox folder, no watcher script, no CSV.

**Rollout — option C, two builds.** Build 1 adds PDF-drop; the DropBox/watcher/CSV
pipeline keeps running untouched. Build 2 (separate, later) retires the old pipeline once
real PDFs have imported successfully. Trevor initially asked whether B (replace outright in
one build) was better since "the CSV pipeline is limping" — the verdict given, and accepted,
was no: a limping pipeline still beats no pipeline if the new import trips on a real PDF.

**In scope, decided:**
- Duplicate protection — re-dropping the same PDF must never create a second copy of a job.
- Count sanity-check — if the parse comes back short, the import refuses and says so rather
  than quietly importing a partial set.

**For the council to resolve:** the manual fields — `Tag`, `Hours`, `Action`, `VB`, `BL`.
These come from the Google Sheet, not the PDF. Trevor explicitly deferred this ("one for the
council to work out and bring back to me"). The risk is a PDF import blanking fields on jobs
he's already marked up. **This is the single most important council question.**

**Constraints:**
- Scheduling comes out untouched — calendar slots, bench assignments, scheduled jobs.
- Nothing in `SCHEDULER_old/` gets touched.
- Dead `useFirebase.js` and the stale docs (below) are noted but explicitly NOT part of
  this build.

**Source of the feature:** the parser being ported lives in a *different* repo —
`/Users/admin/Desktop/1. PROJECTS/Business/AI FILES/BUILDS/NEW SCHEDULER BUILD/workshop-scheduler/`
(`lib/parseMultitrackPdf.ts` using `pdfjs-dist`, and `app/import/page.tsx`). Full detail in
[handoff-board-meeting-and-pdf-drop.md](handoff-board-meeting-and-pdf-drop.md) section 2.

---

## The council decision — read before running anything

Trevor prefers the **`llm-council`** skill over the `/scope` skill's built-in 2-agent
council. Reason, established this session with evidence: the 2-agent council approves
designs without independently re-verifying against real data. It passed Brief F, which then
shipped with `blockedPile()` checking status `'Waiting'` — a value no real job has (the real
Multitrack status is `'Waiting Parts'`). Only the live browser test caught it.

`llm-council` is at `/Users/admin/.claude/skills/llm-council/SKILL.md`. It was not loading
because it was a loose `llm-council.md` file; moving it into its own folder as `SKILL.md`
fixed that. It now appears in slash commands (though still not in the settings UI).

**Open question, not yet answered by Trevor.** `llm-council`'s five advisors (Contrarian,
First Principles, Expansionist, Outsider, Executor) are tuned for *business* decisions, not
code. Two options were put to him and he hadn't chosen when the session ended:

1. **Run it as-written** — unmodified advisors. Tests whether the pattern genuinely beats the
   old council on a real blast-radius question, and earns the adaptation decision with
   evidence. (This was the recommendation.)
2. **Run it with swapped lenses** — keep the machinery (5 parallel, anonymized peer review,
   chairman who can overrule the majority) but retarget advisors at code: Data Integrity,
   First Principles, Downstream Effects, Outsider, Executor.

**Ask Trevor which, then run it on the manual-fields question.**

---

## Stale docs — fixed this session

Both were actively misleading and have been corrected:
- `handoff-pdf-import-truncation-incident.md` said "nothing fixed yet, Sheet not yet
  restored." Trevor confirmed truncation **is fixed** and the Sheet **is restored, 46 jobs**.
- `CLAUDE.md`'s blast-radius list named `useFirebase.js`. That file is dead code — nothing
  imports it, and it reads from Supabase anyway. The live persistence layer is
  `useSupabase.js` / `utils/supabase.js`.

---

## Next action

1. Ask Trevor: `llm-council` as-written, or with swapped lenses?
2. Run it on the manual-fields question (`Tag`/`Hours`/`Action`/`VB`/`BL`).
3. Bring the verdict back to Trevor in plain English.
4. Only then write the brief to `.claude/pending-brief.md` for his first "yp".

**No code until Trevor's "yp" on a written brief.** This is a `jobs[]` shape/identity
change — full Agent-Team Protocol, no shortcuts.
