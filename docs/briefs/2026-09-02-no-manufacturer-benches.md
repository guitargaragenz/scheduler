# Nothing gets a bench from the manufacturer — background

doc_status: live

Background for the scope lock at `.claude/pending-brief.md`. **Do not open this
to start the build** — the lock holds the scope. This is here for the council
and for whoever asks "why again?".

## Trevor's two rulings

2026-09-02: *"nothing should be filtered by manufacturer"*. And, on being shown
the fallthrough order: *"if it filters through all the benches including setup,
misses the final catch all which is Admin it shouldn't go back to setup"* —
then, decisively: *"there is no such thing as no bench and should never be"*.

The order in `inferBench()` today:

1. blocked? → **Admin** (line 36, *first*, not last)
2. description keywords → Fretwork / Luthier / Setup / Electronics
3. **manufacturer name alone → Electronics or Setup** (lines 64-65)
4. nothing matched → **null**, no bench

Two faults. Step 3 overrides the app's own admission that it cannot read the
work, on the strength of the brand. And step 4 invents a state Trevor says does
not exist. Admin belongs at the end, as the catch-all, and every job gets one.

Note the `null` at step 4 was never Trevor's call: the comment defending it
(`jobs.js:67-72`) is an agent's reasoning, unattributed and undated, unlike the
blocked→Admin ruling above it which carries his quote. Nothing of his is being
overturned by changing it.

## "This was fixed months ago — how is it back?"

**It was never fixed. Proven, not assumed.**

The manufacturer lines went into `src/data/jobs.js` on **28 May 2026**
(`bf97377`) and have never been edited since. Verified by checking all 674
commits from that day to now, one at a time, for the string anywhere in the
tree: present in 673. The single exception is `9d89ab0` (14 June), a commit
containing **one file total** and no `src/` at all — the accidental deletion of
35 app files recorded in CLAUDE.md, restored immediately after.

Two corrections worth carrying, because both misled this session:

- An earlier claim here that the repo's history began 13 August was wrong. The
  web session had a **shallow clone**. `git fetch --unshallow` gives all 716
  commits back to 13 May. **Check `git rev-parse --is-shallow-repository`
  before ever concluding history is missing.**
- The Supabase migration (20-21 July, `1bc79f7`) did not touch git history and
  never could — it changed the database, not the repo.

- **No brief, spec, plan or architecture file mentions the rule.** Grepped.

So it was discussed and never landed in code. The lesson: **it was never
written into CLAUDE.md**, and a rule that lives only in a conversation gets
rebuilt over. Step 3 of the build is the real fix.

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

## Council must rule on

**1. Existing stored benches.** `bench` is stored in the database, so **nothing
on the board changes at merge**. The re-infer at `App.jsx:267` runs only when
bench keywords change — *not* on load — so a job already holding `null` or a
brand-picked bench keeps it until the next PDF import re-derives it. Backfill,
or leave it? Rule either way, but say it plainly: "nothing changed" after merge
otherwise reads as a failed fix, and that is how a good build gets reverted.

**2. The now-dead "no bench" state.** Once Admin is the catch-all, these become
unreachable: `NO_BENCH_COLORS` and `benchColors()`'s fallback (`jobs.js:390`),
JobDrawer's `NEEDS_BENCH` sentinel, option and save guard, `groupByBench()`'s
"No bench set" group and `benchSections()`'s `canAdd: false` handling
(`BenchWeekPage.jsx:412-435`), and WeeklySummaryModal's bench-less bucket.
Strip in this build, or a separate tidy-up? Leaving dead branches that model a
state Trevor says cannot exist is how it creeps back — but it widens the diff.

## Expected consequence

Jobs that used to get Setup or Electronics from the brand alone will land on
**Admin** instead, on the next import. Volume is unknown from a web session. If
that is most of the board, the rollout needs staging — see ruling 1.
