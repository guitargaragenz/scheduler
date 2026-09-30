---
doc_status: live
---

# Weekly Log split dropdown — background

Scope lock: `.claude/pending-brief.md`.

Council 2026-09-30, both reviewers "not yet", fixed in the lock:
- Part done flag is `pieceDone`, not `done`.
- A second "next bench" order would disagree with the Board's `nextBenchOf`
  (Luthier, Fretwork, Setup). Trevor kept the Board order; the Weekly Log reuses it.
  Electronics jobs stay put, as on the Board.
- Changing filing changes "Save week as a file". Trevor: the file follows the page.
- Picker and tap-away layer flagged as risks.

## Verifier checklist

1. Split job name tap opens parts dropdown; closed by default; tap again/away closes;
   day cells still tappable with it open.
2. Parts listed Fretwork, Luthier, Finishing, Wiring, Setup, then others.
3. `pieceDone` parts crossed with tick; first not-done has "next".
4. Row heading matches `nextBenchOf`; Electronics jobs stay put; all done = job's own bench.
5. Saved week file groups jobs under the same headings as the page.
6. Picker never offers a job already on the week. Grey tag gone. No job data written.
7. Full test suite passes; new tests for filing, all-done, closed default, tap-away.
