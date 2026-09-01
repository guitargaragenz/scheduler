# Pending — plain-English "and" box for keywords

doc_status: live

Approved by Trevor 2026-09-01, brought forward ahead of the merge of the
keyword-warning dialog (built, verified, awaiting his browser test on PR #58).
Build on the same branch, on top of that work.

## The problem

To send a job to Wiring only when the description has BOTH "install" and
"pickup", Trevor has to type a raw regular expression into Settings:

    (?=.*install)(?=.*pickup)

It works, but it is developer syntax in a tab a service tech uses.

## It must also win the bench order

Tested live today: adding `install` to Wiring moved 10 jobs, all of them to
Admin and Electronics, none to Wiring. Electronics is checked before Wiring
(`jobs.js:150` vs `158`) and already owns `wiring`, `pickup`, `pot`, `jack`.

So an "and" entry MUST beat bench order the way a quoted keyword already does
(`jobs.js:110-137`) — otherwise it repeats that exact failure and does nothing.

## Build this

1. Two plain word inputs in Settings → Keywords, joined by "and" in the UI.
2. On save, store a pattern the EXISTING matcher already understands. Do not
   add a new matching mechanism.
3. Show it as a readable chip — `install + pickup` — never the raw pattern.
   Removing the chip removes the whole entry.
4. It flows through the confirmation dialog built on this branch, like any
   other keyword change.

## Not in scope

- Sentence-level matching. This checks the whole description. Not building one.
- Any change to `inferBench`'s bench order or to how patterns are matched
  beyond point 2 above.
- The Admin behaviour. A blocked job goes to Admin before keywords are read
  (`jobs.js:77`). That is correct and stays.

## Rules that bind this

- Editing keywords re-runs bench matching over live jobs. `jobs[]` is in play.
- The word "regex" must not appear anywhere Trevor can see it.
- Escape user-typed words. A word with a regex character in it must not break
  the pattern or match wrongly.
