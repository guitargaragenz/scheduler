---
doc_status: live
created: 2026-08-08
---

# Handoff — Invoices brief rewritten, two small revenue tidy-ups open

Supersedes the "next action" section of
[handoff-revenue-backfill-and-invoices-pdf.md](handoff-revenue-backfill-and-invoices-pdf.md),
which stays live for its facts.

## Where the Invoices import stands

[brief-invoices-pdf-import.md](brief-invoices-pdf-import.md) is written and now matches
Trevor's scope lock. **It has not been approved yet** — protocol step 1, awaiting "yp".
Do not send it to council before that.

**The scope lock, verbatim, 2026-08-08:** *"no invoice numbers period I just want job
data and revenue taken from invoices I don't want invoice data in database period"*.

That killed the brief's original recommendation (an `invoice_number` column and
`inv-<number>` row keys). The replacement is a **date cutoff**: import only invoices
dated before the earliest existing revenue row. No schema change, no invoice data stored.

**Still blocked regardless:** no real List Invoices PDF exists in the repo. Both existing
parsers were written off measured x/y positions in real printouts; this one cannot be
specified until Trevor downloads a sample.

## Two small jobs Trevor raised at the end

Both are on `completed_jobs` rows, both need his input, neither is started.

1. **Job 1712 is missing make/model.** It came from `backfill_1712_gst.mjs`-era backfill,
   which only had what he supplied. Needs the make and model from him.
2. **Hours are wrong on the revenue rows generally.** A revenue row copies the job card's
   *estimated* hours, not time actually worked; backfilled rows have whatever the script
   put in. **Nothing on the revenue screens totals hours** — the money figures don't use
   them — so this is cosmetic. Open question for Trevor: real worked-hours (he supplies
   the numbers) or blank them.

**Do these as scripts in `scripts/`, not by hand in Supabase, and not as app code.**
Nothing in the app may rewrite a revenue row — that is the whole point of Build 1
(`c9be008`). Trevor was told hand-editing the table bypasses every guard.

## Answered this session, so nobody re-investigates

- **Pending Revenue Review being empty is correct.** `usePendingRevenueReview.js` is a
  chase-up list for jobs that vanished from a sync. It holds no dollar amounts and never
  did. The 20 rows / $3,295.26 are in `completed_jobs` and intact.
- **Job start dates live in `jobs.first_seen`, and only the JBA printout writes it** —
  `JBA_IMPORT_FIELDS = Object.freeze(['firstSeen', 'desc'])`, `src/utils/supabase.js:542`.
  The Jobs printout carries no date. So for the *revenue* goal, Jobs + Invoices is enough;
  JBA is still required for board ageing.
- **Revenue screens never join back to `jobs`**, so an invoice-derived revenue row does
  not need a live job behind it.
- Supabase table editor: `https://supabase.com/dashboard/project/ttlvuforvphwyrfotgot/editor`

## Untouched

- **Build 2** of `revenue-data-loss-fix.md` — not started, needs Trevor's go-ahead.
- Both parked UI briefs (stale description after import; Jobs Sheet usability).
