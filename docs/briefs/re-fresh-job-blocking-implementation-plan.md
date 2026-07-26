# Session refresh — write the implementation plan for job blocking

GGNZ Scheduler, repo root, `main` at `8b8f686`. No uncommitted app code.

**The design is finished, approved and committed.** Read it first and do not re-derive it:

> `docs/superpowers/specs/2026-07-26-job-blocking-design.md`

**This session's job:** invoke `superpowers:writing-plans` and turn that spec into an
implementation plan. Then the full agent-team protocol. **Nothing gets built until the
brief is approved.**

---

## What the design actually says, in one paragraph

Trevor's job list is cluttered with jobs he cannot work on. The fix is to sort every job by
**who owes what** and hide the ones nobody can touch. Three piles replace the three locked
Sidebar sections:

- **Waiting** — someone else owes Trevor something (parts, customer input, in transit).
  Has a live count that turns **red** past 14 days. That red count is the whole safety net:
  the real failure mode is a part order that died three weeks ago and nobody chased.
- **Planning** — Trevor owes himself a decision. MT status `Waiting` + Action `INC`, his
  words: *"a job I'm trying to get my head around."* **No red, no chase pressure** — nobody
  owes him anything, so nagging is meaningless. Keeping `INC` out of Waiting is
  load-bearing; mixing unchaseable jobs into the chase pile makes the red count worthless.
- **Ready** — the normal queue, unchanged.

Plus: the **Admin bench empties itself**, because Admin is currently doing two unrelated
jobs (real bookable admin work, and a dumping ground). And an amber **"needs a bench"** flag
for jobs `inferBench` couldn't classify — today they hide among real Admin jobs.

---

## The five things most likely to get lost

1. **The weekly meeting is the reason field.** Trevor's own redirect, and it is the scope
   line for the entire design: *"waiting and on hold jobs etc are sorted once a week in
   upcoming meetings."* Between meetings the app only has to get blocked work out of the
   way. At the meeting it only has to hand over the list. **Do not** re-propose a
   Scheduler-side "why is this stuck" field, importing MT's `Comments` box, a second PDF
   source, or a comment tagging scheme. All four were considered and cut.

2. **Job age is NOT missing.** `FirstSeen` is blank, which has misled several sessions, but
   the **`Days` column is populated and accurate**. Job 1582 reads 274, exactly matching its
   Multitrack create date of 25/10/2025. No join, no manual typing, no export change needed.

3. **Never sort by job number as an age proxy.** Numbers look sequential but **rebooking
   breaks it** — when a job waited on parts, got finished, then needed something else,
   Trevor rebooked it under a *new* number carrying the original arrival date. Late number,
   early date. Jobs 592 and 1582 are legitimate examples, not corrupt data. Closing the old
   job first is protocol now, so it is legacy only. `Days` is the honest field.

4. **Stuck age is the only thing needing new plumbing.** Everything else reads data that
   already exists. It needs one small table (`job_status_since`) living outside the `jobs`
   array so an import cannot wipe it — the `focus_list` precedent. Use **per-row upsert and
   delete**, not `focus_list`'s clear-and-rewrite pattern.

5. **A populated `Days` must never be overwritten by a blank on import.** `handleCsvUpload`
   is upsert-only. Same blank-beats-good shape as the PDF truncation incident.

---

## Known state of the code

- Nothing sorts by job number. Three places already sort on `days` descending —
  `src/data/jobs.js:235`, `JobShelf.jsx:97`, `DailyLogPage.jsx:824`. Ordering is already
  correct.
- **One real bug to fold into the build:** `src/data/jobs.js:235` sorts with
  `b.days - a.days` and no null guard, so the blank-`Days` rows (jobs 1708, 1710) evaluate
  to `NaN` and land in an undefined position. The other two sites use `(b.days ?? 0)`.
  One-line fix, same file the Admin routing already touches.
- `inferBench` ends in `return 'Admin'` at `src/data/jobs.js:34` — that fallback is what
  the amber "needs a bench" pile surfaces.
- `deriveJobStatusFlags` at `src/data/jobs.js:63` derives `readyToStart` / `awaiting` /
  `inTransit` / `schedulable`. Likely the main seam for the three piles.
- `parts_to_order.needed_for_job` exists but nothing reads it against a job. The design
  wants a matched unresolved part to become the job's shown reason, and `markPartResolved`
  to raise a nudge (**not** change status — status is Multitrack's).

---

## Blast radius — the protocol is mandatory

This touches `jobs[]` filtering across most job-rendering components **and** the CSV import
path, and `inferBench` changes which bench a job gets, which affects every bench-filtered
view. That is squarely blast-radius work under CLAUDE.md:

1. Brief written to `.claude/pending-brief.md`, Trevor approves with "yp"
2. Two independent council agents
3. Builder agent on a staging branch
4. Independent verifier — **never the builder**
5. Browser test on the Vercel preview
6. Merge on "yp"

**No brief entry, no commit.** Treat the Admin routing as part of the same protocol run, not
a tidy-up commit alongside it.

---

## Standing rules (from CLAUDE.md — these are not optional)

- **Trevor never runs git.** Claude runs every git command, from any session. If he starts
  typing git himself, stop him and take it over. Him running git by hand deleted 35 app
  files on 2026-06-14.
- Always `git add <specific file>`, **never `git add -A`**. Never `--no-verify`, never
  amend a pushed commit.
- **Plain English, not dev language.** Trevor is a service tech, not a developer. Translate
  every plan and agent report before anything else. Give a straight verdict, not a hedge.
  Push back honestly. Root cause over patches.
- **Confirm scope before anything bulk or destructive.**
- **Don't make him babysit the session.** Two check-ins only: approve the brief, approve the
  merge.

## Do not do

- **Don't drop a Multitrack PDF or restart the watcher.** The parser is still unfixed; a bad
  PDF re-truncates `jobs.csv`.
- **Don't trust `sheet_to_csv.command`'s name.** It is CSV-authoritative — any Sheet row
  absent from `jobs.csv` gets deleted, no sanity floor. This caused the truncation incident.
- **Don't "fix" blank `FirstSeen`.** It is blank because the export in use carries no date,
  and `Days` already solves the problem it looks like it causes.
- Don't re-open where manual fields get edited (answered: the app), don't propose a
  spreadsheet-style bulk-edit grid, don't ask whether ClickUp could be the bridge.
- Don't design real job-to-job dependency links. No evidence they bite weekly on a
  one-bench workshop; explicitly deferred in the spec.

## Still open, not blocking this plan

- What an import should do with a job that has **vanished from Multitrack**. Upsert-only
  means it stays open forever. Options put to Trevor: ask in the import preview, or
  auto-mark done but never delete. Not decided, and not part of this spec.
- The Multitrack PDF parser fix.
- Supabase still holds 10 blank `mfr` values — fixed by Trevor clicking 📂 in the app and
  uploading the rebuilt `jobs.csv`. Low priority.
