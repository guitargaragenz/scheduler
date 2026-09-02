doc_status: closed

# Next: the saved keyword lists need a clean-up before Settings is safe to open

Written 2026-09-01, straight after PR #55 merged at `977c2f5`. Nothing is built
yet. This is the work, not a record.

## Read this first — the one thing that matters

**Editing ANY keyword box in Settings re-runs bench matching over EVERY job and
writes the result to the database.** Not just the bench edited — all of them
(`App.jsx:265`, the `setBenchKeywords` handler). It skips split children, split
parents and jobs with subtasks; it does not skip a bench Trevor set by hand.

So the first keystroke in that tab moves 16 live jobs. Trevor has been told and
is deliberately staying out of Settings until this is fixed.

## What is actually wrong

The stored bench on 16 live jobs has drifted from what the keyword rules say.
Measured 2026-09-01 against the live board: 121 jobs, 62 protected as
split/parent, 16 would move.

**The cause is the saved `benchKeywords` in `app_settings`, not the code.** Its
Luthier list replaced the defaults with bare, unbounded words:

```
"broken", "top", "crack", "reset", "split", "finish", "lifting", ...
```

`broken` with no word boundary and no phrase matches anything broken, and
Luthier is tested before Electronics. So three amp jobs are about to land on
the Luthier bench:

| Job | Now | Would become | Description |
|---|---|---|---|
| 1619 | Electronics | Luthier | "Broken impedance switch, service amp if necessary" |
| 1690 | Electronics | Luthier | "2 x broken keys or base" |
| 1718 | Electronics | Luthier | "broken presence and mid control pots, service amplifier" |

Two more move for the same shape of reason (1616, 1726 → Luthier), two lose
their bench entirely (1684, 1688 "replace string" → no bench), and 1609 →
no bench. The remaining eight are Admin moves that are CORRECT — blocked work
going to Admin, or unblocked work leaving it.

## What this is NOT

Not a fault in PR #55. Verified before merge: **none** of the 121 live jobs
changes bench as a result of that PR. Finishing and Wiring take nothing, and
the quoted-keyword rule changes no result. The drift predates it.

Also not fixable by quoting. Trevor's first instinct was that the new quote
rule covers this — it does not. Quotes make a keyword WIN priority; they do
not stop a vague word matching. `"broken neck"` quoted in Luthier does not
prevent bare `broken` matching "broken keys". The bare word has to go.

## The likely fix

Replace bare `broken` in the saved Luthier list with the specific phrases
(`broken neck`, `broken headstock`, `broken bridge`, `broken brace` — the
shipped defaults already read this way). Then look at `top`, `crack`, `reset`
and `split` for the same unbounded-word problem.

**Open questions for Trevor, do not guess:**
1. The 16 moves are not all bad — eight are corrections. Does he want all 16
   applied once the keywords are right, or only some?
2. `finish` is in his Luthier list. That is what keeps a refinish job on
   Luthier so it splits — check before touching it.
3. Editing the saved keywords is itself the trigger. There may need to be a way
   to fix the list WITHOUT firing the re-infer over everything, or the fix and
   the 16 moves happen in the same instant. Worth asking whether that matters.

## How to measure it again

Live Supabase credentials are present in the web session environment
(`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). A read-only script that pulls
`jobs` and `app_settings`, runs `inferBench` over each non-split job and diffs
against the stored `bench` reproduces the table above. Write it to the
scratchpad, not the repo. **Read-only — nothing in this task should write job
state without Trevor approving it.**

## Rules that bind this

- Settings keyword edits are blast-radius by the definition in CLAUDE.md: they
  write `bench` on live jobs. Brief and approval before any change ships.
- Git discipline per CLAUDE.md.
