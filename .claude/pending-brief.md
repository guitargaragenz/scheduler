doc_status: live

# Pending Brief — make the Jobs by Age PDF the source of truth for description

**Status:** ✅ **APPROVED by Trevor 2026-08-01 ("yes"). Council done (step 2). Resumes at step 3, builder.**
**Date:** 2026-07-30, council + PDF evidence added 2026-08-01.
**Repo state:** `main`, clean.

> **Why this brief nearly cost a second round:** it was written 2026-07-30 and **never
> committed** — it sat as an uncommitted edit on top of Brief H, so the session that worked
> through it left no record and the 2026-08-01 session re-derived it from scratch. Commit the
> scope lock when it is written, not when the build lands.

## Plain-English summary

Trevor noticed job descriptions in the app look cut off. Confirmed against real PDFs and
the live database:

- The app currently gets its description text from the **Job List** PDF (the one with
  "Fault:" lines under each row) — `parseMultitrackPdf.js`.
- That printout genuinely cuts long descriptions off mid-word. Not a parsing bug — the PDF
  itself prints it short. Checked against the same jobs' full text in the **Jobs by Age**
  PDF:

  | Job | Job List (what's stored today) | Jobs by Age (full) |
  |---|---|---|
  | 1708 Eko Modello | "...stp eli" | "...stp elixir 12s Est $1000" |
  | 1635 Epiphone | "...jack pla" | "...jack plate." |
  | 1632 Hofner | "...deep" | "...deep clean Q:$600 inc" |

- Confirmed live in Supabase: jobs `1708` and `1635` are stored with the truncated text,
  right now.

**The fix:** switch description over to come from the Jobs by Age PDF instead of the Job
List PDF.

## Why this needs the full protocol, not a quick edit

This touches `jobs[]` shape — a blast-radius file per `CLAUDE.md`. It also reverses a
deliberate design decision from Build 1c (Brief G): `parseJobsByAgePdf.js` currently
**throws the Desc line away on purpose** (`isDescLine` → `continue`), with an explicit
comment: "ONE FIELD AND NOTHING ELSE" — to stop two PDFs fighting over who writes
description. That reasoning needs re-examining, not just overriding, hence Council.

## Council (step 2, run 2026-08-01) — and the four questions, now answered

Two independent reviewers. Both confirmed the brief's code facts are still accurate:
`parseJobsByAgePdf.js:131` does discard the Desc line, and description does come from the
Job List PDF today (`parseMultitrackPdf.js:96,143`).

### The one thing council could not settle, settled by the PDFs themselves

Reviewer B's strongest challenge: *is the truncation really the printout, or is it our own
wrap-stitching?* `parseMultitrackPdf.js:190-197` only joins a continuation line onto the
fault when it falls within `WRAP_GAP` (15.5pt) — outside that, it is silently dropped. If
that were the cause, the whole brief would be aimed at the wrong file.

**It is not.** Checked against the 31 Jul pair (`Jobs 31:7.pdf`, `GGNZ JBA 31 Jul.pdf`):

| Job | Job List prints | Jobs by Age prints |
|---|---|---|
| 1708 | `...lifted fretboard at nut low E side, stp eli` | `...stp elixir 12s Est $1000` |
| 1635 | `...scratchy pots & switch, replace o/p jack pla` | `...replace o/p jack plate.` |
| 1632 | `...glue loose inlays, deep` | `...glue loose inlays, deep clean Q:$600 inc` |
| 842 | `...power supply is not working. One` | `...is not working. One knob a bit loose` |

In every case the Job List line **ends there** — there is no continuation line for our
parser to have dropped. Multitrack prints it short. **Our parser is not at fault; the fix
belongs where the brief puts it.**

### Q1 — replace or fall back?

**Both printouts carry the same 37 jobs** on the 31 Jul pair, footers agree ("37 Jobs
found" / "37 Jobs by Age"). Coverage is not the problem council feared. But
`jbaImportPlan.js:69-77` still drops JBA rows for jobs not yet on the board — jobs arrive
via the Job List path — so **Job List stays as the create-time source and JBA overwrites
afterwards.** Not a fallback bolted on; that is simply the order jobs arrive in.

### Q2 — which master wins?

**JBA wins, unconditionally, exactly as `firstSeen` already does** (`jbaImportPlan.js:86-90`,
Trevor's own earlier ruling that "a differing date in the printout wins"). Ownership is by
lifecycle stage, not by whichever PDF was dropped last: Job List writes `desc` only when
creating the job, JBA owns it from then on. Enforce it the way `firstSeen` is enforced — via
the `JBA_IMPORT_FIELDS` allow-list, not by convention.

### Q3 — the seam

Mirror `firstSeen` field-for-field:
- `parseJobsByAgePdf.js` — stop discarding at line 131; capture Desc into the row.
- `jbaImportPlan.js` — carry `desc` in `writes` alongside `firstSeen`, with its own changed/filled reporting.
- `supabase.js` — add `'desc'` to `JBA_IMPORT_FIELDS` (~line 343).
- `joinJobs.js` — **no change.** `desc` is not app-owned and not in `NON_MASTER_FIELDS`.

**Scope grew by one thing the brief did not anticipate:** JBA's Desc **wraps onto a second
line** (1708 spills `$1000`, 1632 spills `clean Q:$600 inc`, 842 spills `One knob a bit
loose`). `parseJobsByAgePdf.js:20-21` explicitly declined to import the Jobs PDF's wrap-gap
machinery. **Taking the first Desc line only would swap one truncation for another** — this
build must join wrapped Desc lines. Reuse `parseMultitrackPdf.js`'s existing rule rather
than writing a second copy.

### Q4 — backfill

**No separate backfill step.** `jbaImportPlan.js:80-83` writes only when the value differs,
so the first JBA drop after this ships corrects every truncated description on the board by
itself. **One documented gap:** a job that has already aged off Multitrack's report keeps its
truncated text forever. Accepted — those jobs are finished work.

### Flagged, deliberately out of scope

`pdfImportPlan.js:74` infers bench from `desc` at creation time only. A fuller description
arriving later does **not** re-infer bench. That behaviour is unchanged by this build and is
not to be "fixed" inside it.

## What this does not touch

- Mfr, Model, Status, Customer — those still come from wherever they come from today.
  This is description only.
- Tag, Hours, Action, VB, BL — Trevor's own hand-maintained fields, untouched regardless.
- No UI change. This is the import/data layer only.

## Constraints

- Both PDFs' ligature-fix and ref-derivation logic must stay shared (`parseMultitrackPdf.js`
  exports these already for exactly this reason) — don't duplicate them.
- Preserve the existing refusal-on-count-mismatch behaviour for both parsers.
- Wrapped-Desc joining must reuse the existing wrap rule, not a second copy of it.
