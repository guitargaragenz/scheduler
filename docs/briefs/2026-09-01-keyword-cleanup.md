doc_status: live

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

## Part A — DONE 2026-09-01. The saved keywords are corrected.

Written straight to `app_settings.benchKeywords` over the REST API, no Settings
edit, so no job moved. Verified live afterwards: **22 pending moves became 12,
and all 12 are correct.**

The old value, for the record — note the bare, unbounded words:

```
Luthier: bridge, crack, brace, reset, top, lower bout, inlay, binding,
         restoration, split, lifting, lifted,
         "broken neck|broken headstock|broken brace", upper bout, broken
```

The new value is `DEFAULT_BENCH_KEYWORDS` plus Trevor's own additions
(`upper bout`, `restoration`, `binding`, `inlay`, `lifting`, `lifted`), with
`refinish` and bare `finish` deliberately left out — he removed those himself
this session.

**Two findings the original brief did not have:**

1. **The count was 22, not 16.** Trevor's `finish` removal changed the picture
   before any of this was built. The 16 was measured earlier the same day. A
   number in a brief is a measurement, not a fact.
2. **The saved lists were missing words too, not just carrying bad ones.**
   `\bstring\b`, `input`, `output` and `\bkeys?\b` are in the shipped defaults
   and were absent from the saved lists, which is why five jobs (1684, 1688,
   1609, 1719, 1690) would have been left with no bench at all. Fixing only the
   over-matching words would have stranded them. Drift goes both ways.

The 12 remaining moves are **not** being applied by hand. Trevor's call: they
go through Part B's confirm screen, so the first use of that screen is a real
one.

## Part B — council said nay twice, and the design changed

Both `ggnz-council` reviewers rejected the first shape (a confirm screen gating
each keyword edit). Trevor chose **decouple** 2026-09-01 after seeing a mockup
of both. Scope lock: `.claude/pending-brief.md`.

**What council found, all four verified against the code before acting:**

1. **The brief's own premise was wrong.** It said keyword edits fire "on each
   keystroke". They don't — `AddRow` (`SettingsModal.jsx:43`) holds its own
   input state and only calls `onAdd` on Enter or the Add button, so the write
   is one per chip added or removed. The confirm-per-edit design was justified
   by a trigger that doesn't exist.
2. **`saveJob` swallows every error** (`supabase.js:48` — logs and returns
   `null`), and the handler fires the writes unawaited in a `forEach`
   (`App.jsx:273`). So 3 of 12 writes failing shows all 12 moved on a board the
   database disagrees with. **This is live today**, independent of Part B, and
   a screen that announces success on top of it makes it worse.
3. **The re-infer computes and commits in the same pass** (`App.jsx:265-270`).
   There is no existing step that produces "what would move" without moving it,
   so a naive build would move the jobs and un-move them on cancel — a window
   where memory and database disagree.
4. **Apply must use the list already shown**, not recompute on click; a device
   syncing between preview and press could otherwise apply a different move
   than the one approved.

**Why decouple won.** The confirm-on-edit shape left editing a word and
reshuffling the board as one act with a speed bump in front, and cleaning up
four words meant four interruptions. Decoupling makes them two acts and leaves
exactly one place in the app that moves jobs between benches.

Mockup of both shapes, shown to Trevor on mobile: `decouple-mockup.html` in
this folder.

## Answers from Trevor, 2026-09-01

1. **Apply all of them** — but see above; the list he approved as "all 16" is
   now 12 after Part A, and the seven wrong Luthier moves are gone rather than
   applied. He was shown the corrected list before Part A was written.
2. **`finish` is gone** — he removed it himself. Do not re-add it, and do not
   re-add `refinish` with the defaults.
3. **Discussed, and it is Part B** — see `.claude/pending-brief.md`.

**The original open questions, kept as the record:**
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
