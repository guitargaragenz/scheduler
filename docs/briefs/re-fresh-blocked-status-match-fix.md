# Brief — fix the blocked-status match bug + split Hold / In Transit / Waiting chips

**Status:** DRAFT. Not yet approved by Trevor. Raised live 2026-07-27 during Brief F's browser test.
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
