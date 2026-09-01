doc_status: closed

# Finishing becomes a bench you can land on

Shipped 2026-09-01. PR: guitargaragenz/scheduler#55.

## Where it started

Trevor asked for "a bench named Finish Work", and separately said job 1728 was
stuck on Setup and should be Luthier. Both turned out to be different things
than they looked.

**Finish Work.** A bench called `Finishing` already existed — it had a colour
in `BENCH_COLORS` and it appeared as an auto-split card when a Luthier job's
description mentioned `refinish` / `finish` (`createSubtasks`, jobs.js). What it
did not have was any way to steer it: no entry in `DEFAULT_BENCH_KEYWORDS`, no
row in Settings → Keywords, no test in `inferBench`, and no place in the job
drawer's bench picker. So a job that was purely finish work could not land on
it, and Trevor had no way to see it as a bench. His ruling: keep the name
Finishing, don't rename it — "it's already in the app it just needs to appear
basically a UI change no need for council". Council step waived by him.

**Job 1728.** Not a bench problem. The Weekly Log hides its Remove button on any
row booked on a day this week (`BenchWeekPage.jsx`, ~line 894) — the comment
there explains why: removing clears marks, but the booking puts the row straight
back, so a button that visibly does nothing was judged worse than no button.
Trevor stood this down as a one-off ("never mind it's a one off really. My
mistake my slip"). Not fixed, and deliberately so.

## What shipped

- `Finishing` keyword list in `DEFAULT_BENCH_KEYWORDS` — lacquer, nitro,
  respray, clear coat, french polish, buff, polish out, touch up, sand back,
  finish repair.
- `inferBench` tests Finishing **after Luthier, before Setup**. Order is
  load-bearing: `refinish` and bare `finish` stay Luthier keywords, so a Luthier
  job keeps its Luthier + Finishing split and nothing already on the board
  moves. Only a job with no Luthier work falls through to Finishing.
- Settings → Keywords now lists Finishing, with its amber accent.
- `JobDrawer` and `MobileJobSheet` can pick it by hand. Added late in the array,
  never first — the `NEEDS_BENCH` sentinel rule (a `<select>` with an unmatched
  value shows its first option, which silently mis-filed jobs as Luthier in
  August).
- Added to the hard-coded `BENCH_ORDER` in `JobsPage`, `BenchWeekPage`,
  `BenchBoardPage` and `WeeklySummaryModal`. This is the "it just needs to
  appear" half: those four filter strictly against that list, so a job on
  Finishing would have been invisible on each of them. `JobShelf` already had it.

768 tests green, production build clean.

## Quoted keywords (added same session)

Trevor asked whether he could just type `output jack` as a Wiring keyword. He
could type it; it did nothing. Electronics owns the bare words `output` and
`jack` and is tested first, so the phrase never got reached. That is not a
Wiring problem — the bench order meant a specific phrase could never beat a
vaguer word on an earlier bench, in any keyword box in Settings.

The first attempt inferred which keywords were "specific" (a phrase beats a word
it spells out). It worked, but Trevor's counter-proposal is better and is what
shipped: **a keyword wrapped in double quotes wins outright**, and he marks them
himself as he goes.

- Explicit beats inferred — he decides, the app doesn't guess.
- **Safe by construction.** No existing keyword is quoted, so no job can change
  bench until he deliberately quotes something. The inferred version could not
  make that promise.
- Curly quotes count too (`“…”`). A phone keyboard substitutes them without
  asking, and a keyword that silently stopped being a priority because iOS was
  being helpful is exactly this app's recurring kind of invisible failure.
- `"output jack"` and `"input jack"` ship as Wiring defaults, quoted. "no
  output" and "input gain" stay on Electronics.
- **The trap this opened:** quoted keywords are filtered out of the bench's
  ordinary regex, so quoting a bench's *last* keyword leaves `[].join('|')` —
  `new RegExp('')` — which matches every string and sends the whole board to
  that bench. Same failure mode as the empty-keyword-list bug already guarded
  above; a `NEVER` pattern handles it, with a test.

## Worth carrying forward

- **A bench is five things, not one.** Colour, keywords, an `inferBench` test, a
  Settings row, a drawer option, and a place in every page's `BENCH_ORDER`.
  Finishing had one of them and looked like a bench from the outside. Half a
  bench presents to Trevor as a bug, not as a missing feature.
- **`Wiring` had the same bug — fixed in the same PR.** Trevor approved it on
  sight ("yp to wiring bench"). Its Settings keyword box was read by nothing.
  It now has a keyword list and an `inferBench` test placed **last of the five
  keyword benches**, and that placement is the whole safety of it: Setup and
  Electronics already own `pickup`, `pups`, `wiring`, `switch`, `pot`, `jack`
  and `scratchy`, and every job carrying one of those is on a bench today.
  Testing Wiring any earlier pulls them off it. The keyword list deliberately
  repeats none of those words — `rewire`, `solder`, `harness`, `loom`,
  `shielding`, `earth wire`, `ground wire` matched nothing at all before.
  One job type does move: a `rewire` job from a Setup-list manufacturer
  (Fender and friends) now reads Wiring instead of falling through to the maker
  fallback. That is how every other bench already behaves — what the work says
  beats who made the guitar — so it is the fix, not a side effect.
- **Bench lists are duplicated across seven files.** `BENCH_ORDER` /
  `ALL_BENCHES` / `BENCHES` are declared separately in `JobsPage`,
  `BenchWeekPage`, `BenchBoardPage`, `WeeklySummaryModal`, `JobShelf`,
  `JobDrawer`, `MobileJobSheet` and `SettingsModal`, each in its own order.
  Adding a bench means touching all of them, and missing one hides jobs
  silently. A single exported source of bench names would be the real fix.
