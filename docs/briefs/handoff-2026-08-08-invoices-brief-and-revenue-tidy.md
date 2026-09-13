---
doc_status: closed
created: 2026-08-08
closed: 2026-08-08
---

# Handoff — Invoices import dropped; revenue tidy-ups done

## The Invoices PDF import is cancelled. Do not revive it.

Trevor's call, 2026-08-08, verbatim: *"just drop the idea completely we don't need past
revenue I can go back to any date since my business started and I have a clear picture"*.

`brief-invoices-pdf-import.md` was deleted in the same commit. It is in git history if
anyone ever wants it (`git log -- docs/briefs/`).

**Why it died — the reasoning, so nobody re-proposes it in three months:** importing
1 Apr–8 Aug invoices only copies a list Multitrack already holds and can print on demand.
It buys a second copy of existing data, at the cost of a third parser writing into the one
table the workshop cannot rebuild. What the app *does* add is forward-looking: tick a job
done, the money is recorded, the weekly summary adds up. That already works.

So: **revenue history lives in Multitrack. The app's revenue table builds from here on.**

A second problem the cancellation also disposes of: the Jobs printout Trevor was going to
supply is the *closed*-jobs one, and importing closed jobs into `jobs` would have put
finished work on the live board. Moot now.

## Revenue tidy-ups — done

1. **Job 1712** corrected to PRS / CE / 1.5h by `scripts/fix_1712_make_model_hours.mjs`
   (`90387f0`). The make field held the crammed string "PRS CE" with model empty; the
   script split them and added the hours. Amount untouched.
2. **Hours on revenue rows are estimates, not worked time.** Left as-is. **Nothing on the
   revenue screens totals hours**, so this is cosmetic. Not worth a build.

## Dates in the revenue table — settled, don't re-investigate

- `completed_at` is the **invoice date**. Every revenue total and the weekly breakdown run
  off it. It is correct.
- `created_at` is just when the row was inserted. Bookkeeping; nothing reads it.
- **There is no start date in `completed_jobs`, and no revenue screen wants one.**
  Job ageing lives on the job, from `jobs.first_seen`, written only by the JBA printout —
  open jobs, which is the only place ageing is used. A job with no `first_seen` shows no
  age badge and nothing else breaks (`src/utils/jobAge.js:64`).

**Do these as scripts in `scripts/`, not by hand in Supabase, and not as app code.**
Nothing in the app may rewrite a revenue row — that is the whole point of Build 1
(`c9be008`). Trevor was told hand-editing the table bypasses every guard.

## Also answered this session

- **Pending Revenue Review being empty is correct.** `usePendingRevenueReview.js` is a
  chase-up list for jobs that vanished from a sync. It holds no dollar amounts and never
  did. The 20 rows / $3,295.26 are in `completed_jobs` and intact.
- **Only the JBA printout writes `first_seen`** —
  `JBA_IMPORT_FIELDS = Object.freeze(['firstSeen', 'desc'])`, `src/utils/supabase.js:542`.
  The Jobs printout carries no date.
- **Revenue screens never join back to `jobs`.**
- **Nothing in the app may rewrite a revenue row** — that is Build 1 (`c9be008`).
  Corrections are one-off scripts in `scripts/`, never hand-edits in the Supabase editor.
- Supabase table editor: `https://supabase.com/dashboard/project/ttlvuforvphwyrfotgot/editor`

## Untouched

- **Build 2** of `revenue-data-loss-fix.md` — not started, needs Trevor's go-ahead.
- Both parked UI briefs (stale description after import; Jobs Sheet usability).
