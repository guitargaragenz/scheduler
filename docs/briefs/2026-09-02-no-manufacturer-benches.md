# Nothing gets a bench from the manufacturer — background

doc_status: live

Background for the scope lock at `.claude/pending-brief.md`. **Do not open this
to start the build** — the lock holds the scope. This is here for the council
and for whoever asks "why again?".

## Trevor's rule

2026-09-02: *"nothing should be filtered by manufacturer"*. And, on being shown
the fallthrough order: *"if it filters through all the benches including setup,
misses the final catch all which is Admin it shouldn't go back to setup"*.

He is right that the order is wrong, and my first description of it was wrong
too. The real order in `inferBench()` is:

1. blocked? → **Admin** (line 36, *first*, not last)
2. description keywords → Fretwork / Luthier / Setup / Electronics
3. **manufacturer name alone → Electronics or Setup** (lines 64-65)
4. nothing matched → **null**, no bench

Admin is not the final catch-all; "no bench" is. Step 3 sits between the app
admitting it cannot read the work and the honest answer, and overrides it on
the strength of the brand. That is the fault.

## "This was fixed months ago — how is it back?"

**Cannot be verified, and the reason is worth recording.** This repo's git
history starts **13 August 2026** (92 commits). Anything older is not in the
clone. What is certain:

- The manufacturer regexes are present and unchanged in **every commit this
  repo holds**. Nothing in the keyword work (#55, #58) touched them, which is
  why the PR #60 revert did not remove them.
- **No brief, spec, plan or architecture file mentions the decision.** Grepped.

So either the fix predates the visible history and was lost, or it was agreed
and never landed. There is no evidence to pick between those, and guessing is
the failure mode that cost two sessions this week. The lesson that actually
matters: **it was never written into CLAUDE.md**, and a rule that lives only in
a conversation gets rebuilt over. Step 2 of the build is the real fix.

## Found while scoping, NOT in scope

`src/data/pdfImportPlan.js:96` calls `inferBench` with `action: ''`,
`backlog: false`, `vb: false`. `App.jsx:267` passes all three for real. Since
the Admin branch at line 36 gates on `blockedPile({ status, action, backlog,
vb })`, a job blocked by its **action** (`INC`, `RS`, `RS-C`, `DG`) or by the
backlog/VB flags can miss Admin on a PDF import and fall through to bench
matching instead.

That is a plausible route to blocked work landing on a bench — including the
Admin→Setup complaint — but it is **a theory, not a finding**, and the standing
rule from 2026-09-02 is no third theory without live data behind it. It is
recorded here, not built. Council to rule on whether it earns its own brief.

## Expected consequence of the build

`bench` is stored in the database, so **nothing on the board changes at merge**.
The effect appears on the next PDF import: jobs that used to get Setup or
Electronics from the brand alone will arrive with no bench and wait for Trevor
to pick one. That is the intent, but the volume is unknown from a web session —
if it is most of the board, the rollout needs staging.
