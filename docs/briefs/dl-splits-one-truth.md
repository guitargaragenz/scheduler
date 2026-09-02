---
doc_status: closed
---

# Brief — one tick, one truth: DL split marks and the board card (2026-08-20)

Background for the scope lock at [`.claude/pending-brief.md`](../../.claude/pending-brief.md).
That page binds the build; this one is why.

## Where this came from

The Daily Log auto-appear build (`62b760b`) put booked splits on the day by
themselves, each with its own mark. Trevor then asked for the splits to sit
under their job and be markable — and, on being told the D Log's marks are
deliberately separate from the board's job cards, said plainly:

> *"it doesn't make sense if I'm ticking off splits and they don't get ticked
> off in card... that's a bunch of confusion waiting to happen. It doesn't
> matter which tick closes the job in the card, it just matters that everything
> is saying the same thing."*

He is right, and the first answer given him was wrong. Two screens showing
different states of the same piece of work is a worse failure than any edge
case the separation was protecting. Losing track of what is done where is the
problem being solved; nothing else.

## Code read live 2026-08-20 — check it again before building

- `handleMarkPieceDone(parentJobId, childJobId, pieceDone, onAllPiecesDone)` in
  `src/hooks/useJobs.js` (~649). Splits carry **`pieceDone`**, not `done`. It is
  already a toggle — `PomoDrawer` calls it with `!job.pieceDone` — so undo needs
  no new mechanism.
- `handleMarkPieceDoneWithInvoicing` in `src/App.jsx` (~376) wires that call to
  `handleAllPiecesDone`, so **ticking the last piece opens the invoice prompt
  today.**
- `handleMarkDone` (`useJobs.js` ~326) is the whole-job finish, and walks up to
  the top-level job because split work is invoiced combined, one invoice per job.
- D Log marks are stored per row as `mark:<itemId>` in `bench_day_marks`
  (`DailyLogPanel.jsx`, `useDayMarks.js`) and touch nothing else.
- Weekly Log rows are one per job, never per split — there is no split-level row
  there to keep in step.

## The decision the council has to make

Trevor's call is that closing a job stays his own manual `×` in the Weekly Log's
final column, with the invoice asked there and nowhere else. But a D Log `×` on
the last piece would, as the code stands, raise the invoice prompt from the D Log.

Those two cannot both be true. The council rules on which gives:
either the piece-done path stops raising the prompt when the tick came from the
D Log, or the prompt moves out of the piece path entirely.

Whatever is chosen, the money question must be asked **once**, deliberately, and
never as a side effect of a day mark.

## Not this build

Wiring the D Log's other marks (`·`, `/`, `>`) to anything, changing the whole-job
`done` flag, or touching revenue.
