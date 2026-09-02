# To Be Invoiced is not a blocked status

doc_status: live

Background for the scope lock at `.claude/pending-brief.md`. That page is the
build. This one is the archaeology — it does not need reading to start work.

## What Trevor saw

2026-09-02: "since Wiring bench keywords has been added, admin jobs are showing
as available in setups etc."

The Wiring keywords are not the cause. They are what made him open Settings and
save a keyword box, which is the trigger.

## The cause, traced through the code

`blockedPile()` (`src/data/jobs.js:296`) is the single source of truth for "is
this job blocked". It hard-codes:

- statuses `On Hold`, `In Transit`, `Waiting`
- flags VB and BL (Trevor's own, set in the Jobs Sheet)
- actions `INC`, `RS`, `RS-C`, `DG`

`To Be Invoiced` is not in that list, and the string appears nowhere in the app.

`inferBench()` returns `'Admin'` only when `blockedPile()` says blocked — there
are no Admin keywords and no Admin box in Settings. So a To Be Invoiced job is
computed as workable, and falls through to the keyword chain and then the
manufacturer fallback, which sends most guitars to Setup.

Saving any keyword box in Settings re-runs `inferBench()` over every top-level
job and writes the result to the bench column (`App.jsx:276-281`). That is the
moment the stored `Admin` is replaced with `Setup`.

## Why it explains the keyword handoff's unexplained 10

`docs/briefs/2026-09-01-handoff-keyword-work.md` records ten jobs listed by the
warning dialog on every keyword edit, unrelated to the words changed, cause not
established. This is that cause: the dialog lists jobs whose stored bench the
matcher cannot reproduce, and a To Be Invoiced job never can be.

Not yet confirmed against live data — that needs a session on Micky with `.env`,
or Trevor reading the ten off the board. It is the expected finding, not a
proven one.

## What the status means

Trevor, 2026-09-02: the job is completed in Multitrack and waiting on him to
send the invoice.

So it is genuinely not workable, and the Admin bench it picks up once blocked is
the honest answer — sending the invoice is his admin, not bench work. It stays
on the board until he invoices it in the app; nothing here marks it done or
touches revenue.

## The design decision

A blocked job has to land in one of `JobShelf.jsx`'s four pile chips — Waiting,
Planning, Hold, In Transit — or it counts nowhere and disappears off the shelf.
None of the four means "finished, needs invoicing".

Trevor's call, 2026-09-02: **its own chip**, labelled **To Invoice**, rather
than folding it into Hold. Hold already reads as "paused on purpose" and is
already a catch-all bin; these jobs would hide in it.

## The separate problem this does NOT fix

A job Trevor sets to Admin **by hand** that is not blocked is still overwritten
on the next keyword save. Nothing records that a bench was chosen by a human, so
the re-infer cannot tell it apart from a stale one. Real, unscoped, and
deliberately out of this build.
