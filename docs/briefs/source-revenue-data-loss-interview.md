---
doc_status: live
---

# Source material — the revenue data-loss bug (mark-done wipes completed_jobs)

**This is not a brief. It is raw material for one, and it has not been audited.**

Written 2026-08-06 at the end of a very long session, at Trevor's request, because his interview
answers exist nowhere else. The next session's first job is to **audit this file against the live
code and live data**, discard anything that doesn't hold up, and write the brief from what
survives. Every code claim below is written as a claim with a file and line to check — not as
fact. Treat them all as unverified.

Parking-lot item: `pk-md-04`, still `open`, dated 2026-08-01. It carries the original diagnosis
and the 2026-08-06 update. Read it alongside this.

---

## Part 1 — Trevor's answers. These are the authoritative part of this document.

Asked in interview 2026-08-06. His words, lightly tidied. **A council reviewer cannot check
these against code — only Trevor can. If any of them is wrong, the build is wrong.**

**Can one invoice cover several jobs?**
> "1 invoice — schools prefer 1 invoice to keep things easier to track."

The 29 July Papamoa College invoice was $575 and covered nine separate job numbers (1682–1690:
eight ukuleles and a Medelli keyboard, all minor repairs charged at half-hour rates).

**What does he type in the app when nine jobs go out on one invoice?**
> "In the app I just enter the individually invoiced amount for that job."

So each job carries its own share. **There is no aggregation problem** — one row per job, amount
is that job's own line. This matters: a design that tried to model one invoice spanning many jobs
would be solving a problem Trevor does not have.

**Is "done" the same as "invoiced"?**
> "When a job [is marked] done in MT or app it has been invoiced. If a job says To Be Inv in MT —
> job done but waiting for me to invoice it out."

So `To Be Inv` is finished work that has not been billed yet. Marking done in the app means the
invoice already exists.

**What should happen if he enters the wrong amount?**
> "If I missed it and noticed it later on I think it should be a database edit made by you or
> myself bc I don't think it's a good thing to drag it back into app... if it's a fat finger thing
> and I notice it straight away then I should be able to make the correction in the app before
> commit."

**And on adding a confirm step to allow that:**
> "No, it's not a step added, it's just me noticing... given it's temperamental history probably
> best to leave it to one and done, then edit if necessary in DB."

**Settled: no confirm step, no in-app editing of a completed row. One and done. Corrections happen
in the database, by Trevor or by Claude.** This is a deliberate choice made in full knowledge of
the feature's history — do not "improve" it by adding an edit screen.

**Should the app capture the invoice number?**
> "Yes that's a good idea."

Multitrack records invoice numbers, not job numbers, so today nothing can be reconciled between
the two automatically. One invoice number typed per job would close that.

**Should the app nag about `To Be Inv` jobs — finished work not yet billed?**
> "Yes probably a good idea."

Six such jobs were sitting unbilled during the 2026-08-04 board meeting.

**On the feature's history:**
> "It's always bitten every time it's been introduced into the app... probably at least 3x now in
> 3 different builds. Everything was stable until revenue was added then issues everywhere."

**On recovery:**
> "MT has record of all invoiced jobs but they are invoice numbers not job numbers. Based on
> customer only but I can add anything back that was deleted once it's fixed."

So nothing is permanently lost. **Fix first, backfill after** — Trevor re-enters by hand, matching
on customer and date.

---

## Part 2 — What was observed in the live database on 2026-08-06

Directly queried, not inferred:

- `completed_jobs` held exactly **one row** at roughly 05:07 UTC: job 1687, Papamoa College, $50.
- Checked again a short time later: exactly **one row**, and a different one — job 1712, Jules
  Lovell, $204.45, `completed_at` 2026-08-07T03:16Z. **The 1687 row was gone.**
- The 1712 row has **`job_number` = null**.
- The `jobs` row for 1687 still exists, `departed_at` 2026-08-02, `done` = **false**.

Trevor's account, which prompted the better diagnosis below:
> "Both of those jobs I've had to reconfirm that they were finished — is it possible in the
> reconfirming move that's where they get deleted rather than deleted straight away?"

---

## Part 3 — Code claims. ALL UNVERIFIED. Check every one.

Each of these was read during the 2026-08-06 session. Line numbers were accurate then and will
drift. **Re-read each site before relying on it.**

**Claim 1 — the save deletes the whole table first.**
`saveCompletedJobs()` at `src/utils/supabase.js:1795` calls `clearCompletedJobs()` at line 1798.
`clearCompletedJobs()` at line 1822 issues `.delete().neq('id', '')` — every row. It then inserts
the array it was handed.

**Claim 2 — the array it is handed comes from browser memory.**
`handleMarkDone()` at `src/hooks/useJobs.js` builds `newRecords = [...completedJobs, record]`
(around line 263) and passes it to `saveCompletedJobs()` (around line 269). `completedJobs` is
React state. After a page reload it is empty until the load finishes.

**Consequence, if claims 1 and 2 hold:** whatever is not in the tab's memory at the moment of
ticking is deleted. This is the mechanism `pk-md-04` describes and it is the thing to fix.

**Claim 3 — the reconfirm path throws the job number away.**
`buildManualInvoiceJob()` at `src/data/jobs.js:326` returns a record with `job: null`, plus null
bench and hours, reconstructing customer and make from the text of a Daily Log bullet. Called from
`CatchUpInterview.jsx:144` (`confirmManualComplete`). This would explain the null `job_number`
observed on the 1712 row — **and if it does, the 1712 row came through the reconfirm flow, not an
ordinary tick.**

**Claim 4 — the reconfirm paths reach the same save.**
`src/App.jsx` wires both `CatchUpInterview` and the revenue-review banner to `handleMarkDone`
(around lines 985 and 1000; `handleRevenueReviewDone` around line 371). So reconfirming is not a
separate write path — it lands on the same delete-then-insert.

**Why this combination is the dangerous one, if the claims hold:** the reconfirm flow exists
*because* a job has already vanished from the board. That usually means a reload has happened,
which is exactly when memory is empty — so the reconfirm step is the most likely trigger of the
deletion, not a separate bug.

**Claim 5 — eight places read this data.** `src/App.jsx`, `CatchUpInterview.jsx`,
`CloseDayModal.jsx`, `RevenueBreakdown.jsx`, `WeeklySummaryModal.jsx`, `src/data/jobs.js`,
`src/data/joinJobs.js`, `src/hooks/useJobs.js`, plus `scripts/board_meeting_export.mjs` and
`.claude/workflows/sunday-board-meeting.js`. Each currently assumes the whole list is in memory.
If the table becomes append-only and grows without limit, every one needs checking — this is the
bulk of the work, not the fix itself.

---

## Part 4 — What was NOT established

- **Nobody watched the 1712 write happen.** That it deleted 1687 is an inference from the
  mechanism plus the before/after, not an observation. It is a strong inference. It is not proof.
- **The earlier nine-row loss** (2026-07-31, $780.86 ex GST) is recorded in `pk-md-04` by an
  earlier session and was not re-verified here.
- **The three previous failed attempts have not been read.** `pk-md-04` says the last one
  "genuinely broke the app". Reading all three and writing down what they had in common is the
  first task of the brief, ahead of any fix. `git log -- src/utils/supabase.js`.
- **What makes a completed job unique** is undecided. Presumably the job id, so that ticking twice
  updates rather than duplicates — but with the delete-everything behaviour gone, duplicates
  become possible for the first time, so this needs an explicit answer.

---

## Part 5 — The design principle to hold on to

Drawn from the pattern across three failures, and worth stating plainly because it is what the
next build should be judged against:

**The job board can be rebuilt. The revenue record cannot.**

The board is a reflection of the Multitrack printout — if it is wrong, re-import and it is right
again. There is no equivalent for money. Once a line is deleted, nothing in the app can
reconstruct it. So the revenue record must be **append-only**: one job finished, one row written,
that row never rewritten and never deleted by the app.

Every one of the three failed attempts treated revenue as rebuildable state. That is the mistake
to name explicitly in the brief, so the fourth attempt does not repeat it.

---

## Part 6 — Live advice given to Trevor, still standing

**Do not mark jobs done in the app until this is fixed.** Every tick can wipe the previous line.
Keep finished jobs on paper or in the Daily Log and enter them once it is safe.

---

## Protocol

Blast-radius: `useJobs.js` and `utils/supabase.js`, both named in CLAUDE.md. Three prior failures.
Full agent-team protocol, and the previous attempts read before anything is designed.
