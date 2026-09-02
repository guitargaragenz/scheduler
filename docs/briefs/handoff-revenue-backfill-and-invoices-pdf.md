---
doc_status: closed
created: 2026-08-08
---

# Handoff — revenue backfill done, Invoices PDF import proposed

Written 2026-08-08 at the end of a long session. Build 1 of the revenue
data-loss fix is shipped and proven live. This handoff covers what is now true,
and the one new idea that needs its own build.

## What shipped and is confirmed working

Build 1 of `revenue-data-loss-fix.md` merged at `c9be008`. The app can no
longer delete a revenue row. Ticking a job appends one row, keyed on the
top-level job, and refuses a second write for a job that already has one.

**Proven live, not just in tests.** Jobs 321, 592 and 1714 were reintroduced on
a Multitrack upload and ticked done. Three new rows appeared, and the existing
Jules Lovell row survived — under the old code that row would have been wiped.

## What the revenue table holds now

20 rows, $3,295.26, all ex-GST:

| Week starting | Jobs | Total |
|---|---|---|
| 18 May | 2 | $1,608.70 |
| 20 Jul | 4 | $522.30 |
| 27 Jul | 10 | $600.00 |
| 3 Aug | 4 | $564.26 |

Everything reconciles against the Multitrack invoice list. Trevor's supplied
figures are ex-GST; Multitrack's Total column is GST-inclusive. Job 1710
reconciles exactly against Multitrack invoice 1428 ($115.00 inc / $100.00 ex),
which is what confirmed that.

## Scripts written this session — all one-off, all in `scripts/`

All of these are deliberately scripts and **not** app code. Nothing in the app
may write or rewrite a revenue row; that is the point of the append-only build.
All are safe to re-run — each refuses a job that already has a row.

- `repair_completed_job_numbers.mjs` — filled null `job_number` values
- `backfill_missing_revenue_rows.mjs` — the five 2 Aug jobs
- `fix_revenue_invoice_dates.mjs` — 321/592/1714 moved from tick date to 4 Aug
- `backfill_papamoa_revenue.mjs` — the nine Papamoa College instruments
- `fix_1712_gst.mjs` — Jules Lovell was recorded GST-inclusive, now ex
- `backfill_1619_1710_revenue.mjs` — the last two matchable July invoices

**Do not run any of these again without a reason.** They are kept as a record of
what was changed and why, not as maintenance tools.

## Facts worth carrying forward

- **`jobs.departed_at` is not a completion date.** Fifteen-plus jobs carry the
  identical value `2026-08-02T11:01:20.769+00:00`, to the millisecond. That is a
  batch stamp. Using it as a completion date drops months of work into one
  week's takings. Always ask Trevor for the invoice date instead.
- **Revenue screens never join back to `jobs`.** `RevenueBreakdown.jsx` and
  `WeeklySummaryModal.jsx` read `completed_jobs` standalone, and
  `RevenueBreakdown` already handles a record whose job has vanished. So a
  revenue row does **not** need a live job behind it. This is what makes the
  proposal below possible.
- Nine July invoices could not be backfilled: their jobs are gone from the
  database entirely. Given the point above, they could now be added without a
  job — that was not known at the time.
- Two live jobs are paid in advance and must **not** be backfilled: **1703**
  (Murray Spicer) and **Liam Jolly**'s job. They will get their revenue the
  normal way when ticked done.
- Job 1703 showing three rows is correct — a split job is a parent plus one row
  per bench session. Not a fault.

## The proposal — a third PDF import for Invoices — **CANCELLED 2026-08-08**

> **Dead. Do not build this.** Trevor dropped it the same week it was proposed: past
> revenue already lives in Multitrack, which can print any date range on demand, so the
> import only duplicates it. See
> [handoff-2026-08-08-invoices-brief-and-revenue-tidy.md](handoff-2026-08-08-invoices-brief-and-revenue-tidy.md).
> The rest of this section is kept as the record of what was considered, not as work.

Trevor's idea, in his words: download three PDFs since 1 April 2026 — **Jobs,
JBA, and Invoices** — and import the lot, so the revenue record covers the whole
financial year.

**Jobs and JBA already import. An Invoices import does not exist.** That is a
new build, not a config change.

Sketch of what it would need:

- A parser for the Multitrack **List Invoices** page: `InvDate`, `Customer`,
  `Status` (Paid / Owing), `Total`, `Inv` number.
- The Total column is **GST-inclusive**. Rows must be divided by 1.15 to store
  ex-GST, matching everything already in the table.
- The invoice list carries no job number, so rows would be keyed some other way
  — probably the invoice number. That needs designing; the current table keys on
  `job_id` with a `cj-<jobid>` primary key.
- Must skip anything already recorded, and must never overwrite an existing row.
- Import order stays **Jobs → JBA**, then Invoices last.

**This is blast-radius work** — it writes to the revenue table, which is the one
record the workshop cannot rebuild from a printout. Full agent-team protocol:
brief, two councils, builder, independent verifier, browser test, merge.

Confirm the import order and the count-check refusal against
`src/data/pdfImportPlan.js` and `src/data/jbaImportPlan.js` before designing —
both already refuse an import whose row count disagrees with the document's own
stated total, and the Invoices import should do the same.

## Also still outstanding

**Build 2** of `revenue-data-loss-fix.md` — not started. The revenue table now
grows without limit, and roughly a dozen files still load the whole history into
memory. Nothing is broken; it gets slower as the table grows. Needs its own
protocol run. Do not start it without Trevor's go-ahead.

## Next action

~~Trevor downloads the three PDFs.~~ Cancelled 2026-08-08 — see the note above. The
revenue table builds forward from job ticks only; history stays in Multitrack.
