---
doc_status: live
created: 2026-08-08
---

# Brief — Invoices PDF import (revenue from 1 April)

**Status: DRAFT, awaiting Trevor's approval ("yp"). Protocol step 1.**

Successor to [handoff-revenue-backfill-and-invoices-pdf.md](handoff-revenue-backfill-and-invoices-pdf.md).
Does not touch the revenue Build 2 scope lock in `.claude/pending-brief.md`.

---

## 1. What this is for

The revenue record only holds what has been ticked or hand-backfilled — 20 rows,
$3,295.26. Trevor wants it to cover the financial year from 1 April 2026. Multitrack's
**List Invoices** printout has every invoice in that period. Nothing in the app can read
it today.

## 2. Why it's possible at all

Verified 2026-08-08: the revenue screens never join back to `jobs`.
`RevenueBreakdown.jsx` and `WeeklySummaryModal.jsx` read `completed_jobs` standalone, and
`RevenueBreakdown` already copes with a record whose job is gone. **So a revenue row does
not need a live job behind it** — which is what lets an invoice-keyed row exist at all.

Nine July invoices couldn't be backfilled by hand for exactly this reason (their jobs are
deleted). This import would pick them up.

## 3. Facts checked against live code, 2026-08-08

- `completed_jobs` is `id TEXT PRIMARY KEY`, plus `job_id`, `job_number`, `customer`,
  `mfr`, `model`, `hours`, `completed_at` (`docs/supabase-schema.sql:175-186`), with
  `invoice_amount` and `week_key` added later. **There is no invoice-number column.**
- Both existing importers refuse on a count mismatch —
  `buildPdfImportPlan()` (`src/data/pdfImportPlan.js:162-179`) requires the PDF's own
  "N Jobs found" tally and refuses if `parsed.length !== statedCount`; the JBA plan does
  the same against its "N Jobs by Age" footer. **The Invoices import must do the same.**
- The two parsers share `deriveRef`, `fixLigatures`, `isWrapContinuation` and
  `loadPdfPages` from `parseMultitrackPdf.js`, but each owns its own layout code. A third
  parser follows that split.
- Existing rows are keyed `cj-<top-level job id>` and the app appends only — it can
  never delete or rewrite a revenue row (Build 1, `c9be008`). That property must survive.

## 4. Scope

### In

1. **`parseInvoicesPdf.js`** — read the List Invoices printout: `InvDate`, `Customer`,
   `Status` (Paid / Owing), `Total`, `Inv` number. Reuse the shared helpers, own its
   layout.
2. **Count refusal** — find the printout's own stated total and refuse the whole import
   if the parsed row count disagrees. Partial revenue is worse than none.
3. **GST** — Multitrack's Total is **GST-inclusive**. Divide by 1.15 and store ex-GST,
   matching every row already in the table.
4. **No new column, no schema change.** See section 5 — Trevor's scope lock.
5. **Row identity** — invoice rows keyed on date + customer, not on anything
   invoice-derived. A re-drop of the same PDF must be a no-op.
6. **Never overwrite, never delete.** Same append-only rule as Build 1: an existing row
   wins, and a refusal is reported, never silent.
7. **Preview before write**, in the shape of the existing imports: how many new rows, what
   total, what was skipped.

### Out

- Any edit-a-revenue-row UI. Ruled out by Trevor, standing.
- Build 2 of the revenue fix (the unbounded readers). Separate, not started.
- Changing how ticking a job done writes revenue.

## 5. Trevor's scope lock — no invoice data in the database

Decided 2026-08-08, verbatim: *"no invoice numbers period I just want job data and
revenue taken from invoices I don't want invoice data in database period"*.

So: **no `invoice_number` column, no invoice-keyed rows, nothing invoice-shaped stored.**
The Invoices PDF is read for money only. This is a hard lock, not a preference — an
earlier draft of this brief recommended the opposite and was overruled twice.

### Which leaves double counting to solve without a new field

The 20 rows already in the table came from those same invoices. Importing 1 Apr–8 Aug
would duplicate roughly half of them.

**The rule: a date cutoff.** Import only invoices dated *before* the earliest existing
revenue row. Everything from that date onward is already captured by the app itself, and
stays the app's business. Cheap, no schema change, and it cannot double-count.

**Its one weakness, for council:** a gap *inside* the covered period is never filled.
The nine July invoices whose jobs are deleted fall on the wrong side of that cutoff. If
they matter, they stay a one-off backfill script, not an import.

## 6. Needed before a builder starts

- A real **List Invoices PDF** covering 1 Apr onwards. No sample exists in the repo, and
  the layout cannot be guessed — both existing parsers were written off measured x/y
  positions in real printouts.
- Trevor's approval ("yp") of this brief as rewritten. Section 5 is now his decision, not
  an open question.

## 7. Protocol

Blast-radius: writes the revenue table. **Full agent-team protocol** — this brief, two
`ggnz-council` reviewers, `ggnz-builder` on a staging branch, `ggnz-verifier`, browser
test, merge.

Import order stays **Jobs → JBA → Invoices**.
