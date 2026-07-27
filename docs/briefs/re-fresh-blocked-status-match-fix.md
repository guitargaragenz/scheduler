# Brief — fix the blocked-status match bug + split Hold / In Transit / Waiting chips

**Status:** APPROVED by Trevor 2026-07-27 ("yp"). Council next. Raised live 2026-07-27 during Brief F's browser test.
**Depends on:** Brief F (shipped, `ece2197`).

---

## Plain-English summary

When Trevor looked at the live "Waiting" chip Brief F just shipped, it said 16 — and none of those
16 jobs were actually waiting on parts. The bug: Multitrack's real status is **"Waiting Parts"**, but
the code was checking for a status called plain **"Waiting"**, which no real job ever has. So the
"Waiting" bucket was silently catching every On Hold and In Transit job instead — jobs that are either
paused on purpose (On Hold) or already have parts moving (In Transit), neither of which needed chasing.

Trevor's corrected rule, confirmed live:
- **On Hold** — Trevor paused it on purpose. Stays "Hold," always, even if the action code is CI.
  Never counts as Waiting.
- **In Transit** — parts are already on the way. Its own thing, never counts as Waiting.
- **Waiting** — status is literally `Waiting Parts`, OR action is `CI` (waiting on the customer) —
  but only when status isn't On Hold (On Hold wins first).

Trevor also wants **Hold** and **In Transit** to each get their own chip on the bench row, same style
as Waiting/Planning, so he can see all three at a glance.

## Scope — proposed

1. Fix `blockedPile()` in `src/data/jobs.js:116-127`:
   - Check `status === 'On Hold'` FIRST → return `'hold'` (new pile), unconditionally, before the CI check.
   - Then: `status === 'Waiting Parts' || act === 'CI'` → return `'waiting'`.
   - Then: `status === 'In Transit'` → return `'transit'` (new pile).
   - `act === 'INC'` → `'planning'` (unchanged, still checked ahead of status per existing comment at
     `jobs.js:106-112` — confirm this doesn't conflict with the new On-Hold-first rule; INC is an action
     code, On Hold is a status, so they're orthogonal, but the builder should re-verify with the same
     rigor as Brief E's council did).
2. Update the two other places in `jobs.js` that still reference the literal string `'Waiting'`
   instead of `'Waiting Parts'` — `blockedReason` (`:150-152`) and the accept-list at `:317`
   (`['On Hold', 'Waiting', 'To Be Inv', 'In Transit']`).
3. Add two new chips to `JobShelf.jsx`'s pile-chip block (alongside Waiting/Planning, same outlined
   style, same hide-at-zero rule): **Hold** and **In Transit**.
4. Same non-draggable, same click-to-filter mechanism as Waiting/Planning — no new interaction pattern.
5. Tests: update `JobShelf.test.jsx` fixtures to use real MT status strings (`'Waiting Parts'`, not
   `'Waiting'`); add coverage for the On-Hold-wins-over-CI rule; add coverage for the new `'transit'`
   and `'hold'` pile classification.

**Out of scope — do not build:**
- Sidebar/JobsPage alignment — still tracked separately in
  `docs/briefs/blocked-pile-naming-alignment.md`, which this brief's fix makes MORE relevant (a fourth
  status string bug on top of the three-screen naming mismatch), but is not this brief's job to fix.
- The `parts_to_order` table join — still empty, still unwired, still `parked-parts-as-a-stuck-reason.md`'s
  job, not this one.

## Why this needs the brief process

`blockedPile()` is the single function read by Sidebar, JobsPage, JobShelf, CalendarGrid, and
`inferBench` (`jobs.js:100-104`). The diff is small, but the blast radius is everywhere — this is
explicitly the kind of "small file, shared logic" case CLAUDE.md's protocol exists for. Full
Brief → Council → Builder → Independent Verifier → Browser Test → Merge, same as Brief F.

## Method — agent-team protocol

1. **Brief** — this file. Needs Trevor's "yp" before any commit.
2. **Council** — check the On-Hold-before-CI ordering against every existing caller of `blockedPile()`
   and `blockedReason()`, confirm no downstream code assumed the old (buggy) `'Waiting'` string, confirm
   the two new piles (`hold`, `transit`) don't collide with `PILE_VALUES`'s `pile:` namespacing rule
   from Brief F.
3. **Builder** — new staging branch, supervised.
4. **Independent verifier** — separate agent, checks the fix against real MT status strings, not just
   the old fixtures.
5. **Browser test** — Vercel preview. This time, count real On Hold / In Transit / Waiting Parts jobs
   in the live data first and confirm the chips match by hand, since this bug's root cause was
   exactly a silent mismatch between code assumptions and real data.
6. **Merge** — Trevor's "yp".

**No commits before step 1 is approved.**

---

## Council Findings — BINDING ON THE BUILDER (2026-07-27, two independent reviewers)

**Correction to scope item 2:** `blockedReason` (`jobs.js:136-153`) does NOT contain the literal
string `'Waiting'` — leave it untouched except where step 2 already says (no changes needed there at
all; drop that half of step 2). The actual second instance of the bug is in `deriveJobStatusFlags`
(`jobs.js:194`): `const awaiting = status === 'Waiting' && ['INC', 'CI'].includes(act);` — this feeds
`job.awaiting`, consumed directly by `Sidebar.jsx:73,75` (the "📞 AWAITING" bucket). Since no real job
carries the literal status `'Waiting'`, Sidebar's Awaiting bucket has been silently empty in production
this whole time — same root-cause bug, different function. **Trevor has decided (2026-07-27): fix this
typo too, in this brief** (change `'Waiting'` → `'Waiting Parts'` at `jobs.js:194`), and **rename the
Sidebar label from "📞 AWAITING" to "📞 WAITING"** at `Sidebar.jsx:285` (Trevor: "change Awaiting to
Waiting like I requested last time"). This is now in scope. `blockedReason` itself needs no change.

**Ordering resolved:** In Transit + CI cannot occur in real data — Trevor confirmed customer-input (CI)
is always resolved before parts ship/go In Transit. No special-case needed for that combination. Order
stands as scoped: `INC → On Hold → In Transit → (Waiting Parts or CI) → null`. Do not add a test case
for In Transit+CI as a "should be transit" assertion — it's not a reachable real state, and asserting
one order over the other would just be testing dead code.

**`blockedReason`'s existing CI-before-status precedence (`jobs.js:143-149`) stays exactly as-is.**
Trevor did not ask for it to change; it predates this brief (Brief E round 3) and is documented as
deliberate at `jobs.js:143-147`. Do not touch it.

**Confirmed safe (both reviewers, no action needed):**
- `PILE_VALUES` namespacing (`JobShelf.jsx:15`, generated from `PILES`) — `hold`/`transit` keys produce
  `pile:hold`/`pile:transit`, no collision with `BENCH_ORDER`.
- Pile chip render path (`JobShelf.jsx:230-278`) is generic over `pileCounts`, no hardcoded
  two-piles assumption — adding two more entries is a pure data change, wrap/spacer logic unaffected.
- No enum/switch/PropTypes anywhere assumes only `'waiting'`/`'planning'` are valid non-null
  `blockedPile()` return values — `JobCard.jsx:13` only checks `!= null`.
- Sidebar/JobsPage isolation from `blockedPile()`/`blockedReason()` — confirmed structurally accurate,
  those two screens use `deriveJobStatusFlags()` booleans set at parse time, never call `blockedPile`
  directly (except now the one Sidebar label/typo fix above, which touches the flag not the pile logic).

**Mandatory fixes — additions to the builder's scope:**

- **C1 — Add `hold`/`transit` to the `PILES` config array**, not just the render block. `PILES`
  (`JobShelf.jsx:11-14`) is what `pileCounts` (`JobShelf.jsx:110-113`) and the render loop both consume
  — patching only the JSX without adding `{ key: 'hold', label: 'Hold' }` / `{ key: 'transit', label:
  'In Transit' }` here means the new chips silently never render (count always filtered to 0).
- **C2 — Fix `deriveJobStatusFlags` (`jobs.js:194`) and the Sidebar label (`Sidebar.jsx:285`)** per the
  correction above — now in scope, not deferred to the naming-alignment brief.
- **C3 — Test file list corrected:** `src/data/jobs.test.js` also hardcodes the buggy `'Waiting'`
  literal and WILL break under the fix — specifically lines ~124, 130, 132, 147, 169 need fixture/
  expectation updates (`'Waiting'` → `'Waiting Parts'` where realistic; `'On Hold'` expectations
  currently asserting pile `'waiting'` must become `'hold'`). Update this file alongside
  `JobShelf.test.jsx`, not instead of it.
- **C4 — Add a case-sensitivity regression test.** `blockedPile()` does exact string equality with no
  `.trim()`/`.toUpperCase()` on `status` (unlike `act`, which is normalized at line 118). Lock in
  current exact-match behavior with a test so a future MT export casing/whitespace quirk fails loudly
  instead of silently reproducing this whole bug class again.
- **C5 — Add an On Hold + INC test case**, asserting `'planning'` (INC is checked first and is
  status-independent, per the existing comment at `jobs.js:106-112` — unchanged by this brief).

**C6 — Fix the wrong INC comment.** The code comment at `jobs.js:106-112` describes `INC` as "needs a
quote or a plan written first." That's wrong — Trevor's correction (2026-07-27): `INC` = Incubating,
meaning the job is still turning over in his head, nowhere near planning or quoting yet. Update the
comment to say that. No behavior change — `INC` is still checked first, still status-independent, still
maps to pile `'planning'` — this is a comment-accuracy fix only, not a logic change. While in there,
builder should also swap any other status/tag terminology mix-ups in nearby comments: **status**
(On Hold, Waiting Parts, In Transit, Active, Booked In) and **tag/action code**
(INC, CI, RS-C, RS, DG, GTS) are two separate fields on a job, not one axis — see project memory
`multitrack-status-vs-tags` for the full tag glossary.

**C7 — CI does NOT independently gate `blockedPile()`.** Builder's first pass added
`act === 'CI'` as a standalone trigger for the `'waiting'` pile, which meant an `Active`+`CI` job
(previously fully workable) became blocked — a real behavior change, caught by two pre-existing tests
(`useSupabase.test.js:27`, `JobCard.test.jsx:42`). Trevor's decision (2026-07-27): CI should only
matter when the job is already blocked by its status (Waiting Parts / In Transit) — it never
independently blocks an otherwise-workable job. Since Waiting Parts and In Transit already gate on
their own, this means **`blockedPile()` should drop the `act === 'CI'` clause entirely** — final order
is `INC → On Hold → In Transit → Waiting Parts → null`, no CI branch. `blockedReason()` is unaffected
and unchanged — it still reports "waiting on the customer" for CI jobs that are already blocked for
another reason, exactly as before. Builder: revert the CI clause added in the first pass; restore the
two pre-existing Active+CI-stays-workable tests to passing without modifying their fixtures.

Everything else in the original scope proceeds as written. Builder: proceed.
