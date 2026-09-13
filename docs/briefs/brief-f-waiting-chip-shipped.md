---
doc_status: closed
closed: 2026-07-27
superseded_by: -
---

# Pending Brief F — "Waiting" chip on the bench-picker row

> # ⛔ CLOSED — HISTORY ONLY. DO NOT ACT ON ANYTHING BELOW THIS LINE.
>
> This work is finished. Nothing below is a live instruction, no matter how it is
> worded. Task lists, "next steps" and "awaiting approval" notes inside this file are
> a record of what was true at the time, not work to pick up.
> **Check any fact here against the live code before relying on it.**
>
> Brief F shipped and merged to `main` at `ece2197`, 2026-07-27.
>
> **Known wrong fact in this file:** it states Multitrack's real status string is
> `'Waiting Parts'`. It is **`'Waiting'`**. The Multitrack dropdown *label* reads
> "Waiting parts", but the export is what the app sees. Verified against the app code
> 2026-07-28 — `'Waiting Parts'` appears nowhere in `src/`.

**Status:** SHIPPED. Merged to main 2026-07-27 (`ece2197`). Browser-tested on Vercel preview —
counts correct, click-to-filter works, blocked cards stay non-draggable, drag-mode toggle hides
correctly. Trevor approved the merge live in chat.

**Known issue found during Trevor's live review, tracked as a fast follow-up — see
`docs/briefs/re-fresh-blocked-status-match-fix.md`:** `blockedPile()` compares `status === 'Waiting'`,
but Multitrack's real status string is **"Waiting Parts"** (confirmed via Trevor's MT screenshot,
2026-07-27) — so `'Waiting'` never matches a real job. The chip's "Waiting: 16" count this session was
actually On Hold + In Transit jobs, not parts-waiting jobs. Trevor's corrected rule: On Hold always
stays its own thing (even with CI); Waiting = Waiting Parts or CI; In Transit is its own thing too, not
Waiting. Trevor also wants separate Hold and In Transit chips on the same row.
**Open question — RESOLVED:** Two chips — **"Waiting"** and **"Planning"** — split to match the
Sidebar's existing two piles. Not one combined chip.
**Date:** 2026-07-27
**Repo state:** `main` @ merge of `staging/job-blocking` (Brief E rounds 1–3, fully shipped)
**Trigger:** Trevor flagged, live on the deployed app, that the main bench-picker screen (`JobShelf.jsx`)
has no way to see blocked jobs at all — Setup/Luthier/Electronics/Fretwork/Wiring/Finishing/Admin chips,
but nothing for Waiting/Planning. Brief E deliberately pulled blocked jobs out of Admin and into their
own piles (visible in the Sidebar and Jobs page), but this particular screen — the one Trevor actually
works from all day — was never given an equivalent.

---

## Plain-English summary

Brief E fixed blocked jobs cluttering up Admin. But it didn't put them anywhere on the screen Trevor
actually looks at to decide what to work on next — the bench row (Setup 5, Luthier 5, Electronics 13,
etc). Right now a blocked job is invisible there. Trevor's ask: he doesn't need to *work* a blocked job,
but he needs to *see* it's stuck, same way he sees Setup has 5 jobs waiting.

Fix: add a **"Waiting"** chip (and possibly a separate "Planning" chip) to that same row, showing a
count, same as the real bench chips. Clicking it lists the blocked jobs in that pile — same interaction
as clicking "Setup." It is not a real bench: it doesn't touch `inferBench`, doesn't make blocked jobs
schedulable, doesn't change bench colors or the Admin bin problem Brief E just fixed. It's a read-only
window into the same `blockedPile()` data that already drives the Sidebar/Jobs page piles, surfaced on
the one screen that was missing it.

---

## Scope — proposed

1. Import `blockedPile` (and `blockedReason` if needed for the list view) into `src/components/JobShelf.jsx`
   from `../data/jobs.js` (currently not imported there — confirmed via research pass).
2. Add **two** chips — "Waiting" and "Planning" (decision locked, see status above) — to the chip row at
   `JobShelf.jsx:185-204`, alongside the existing `BENCH_ORDER`-driven bench chips. Count = jobs in
   `topLevel` (the same already-filtered list at `JobShelf.jsx:58-66`) where `blockedPile(job)` matches
   the relevant pile, not `job.bench === X`.
3. Clicking the chip filters the job list below to that pile, reusing the same select/filter mechanism
   already used for bench chips — no new list-rendering component.
4. Blocked jobs in this list stay **non-draggable** (round 3 already built this at the card level) —
   this chip is a new *entry point* to already-existing cards, not new card behavior.
5. No changes to `inferBench`, `BENCH_ORDER`, bench colors, the Admin chip, or the `bench NOT NULL`
   schema constraint.
6. Tests: chip count matches `blockedPile()` output; clicking filters correctly; chip does not appear in
   `BENCH_ORDER` or get treated as a real bench anywhere downstream.

**Out of scope — do not build:**
- Any change to what counts as blocked (`blockedPile()` logic itself is untouched — this is a display
  layer only).
- Making blocked jobs draggable or schedulable from this new chip.
- Repurposing the Admin chip/bench for this — considered and rejected (reintroduces the "Admin as dumping
  ground" problem Brief E just fixed).
- A general-purpose "sub-bench" system — this is one specific chip for one specific visibility gap, not
  new infrastructure.

---

## Why this needs the brief process, even though it's small

Touches `JobShelf.jsx`, one of the ~17 render sites Brief E round 3 already modified for bench-color
fallbacks, and reads from `blockedPile()` — data path shared with `scheduledSlots`/bench-assignment
logic. Small blast radius, but the same file family as prior blast-radius work, so it goes through the
same protocol rather than being patched in ad hoc.

## Council Findings — BINDING ON THE BUILDER (2026-07-27, two independent reviewers)

**Correction to this brief's premise:** the claim that the two chips "match the Sidebar's two piles"
is FALSE. `Sidebar.jsx:73-75` splits locked jobs three ways off the old `deriveJobStatusFlags`
booleans (`📞 AWAITING` / `📦 IN TRANSIT` / `🔒 ON HOLD`, `Sidebar.jsx:285,295,305`) and never calls
`blockedPile()`. `JobsPage.jsx:35-36,150` is a third variant again ("Waiting / On Hold", split on
`schedulable`). "Waiting" and "Planning" are currently code-only strings (`jobs.js:119,125`) — these
chips are the first user-facing use of those words. Trevor has been told; three-screen alignment is a
FOLLOW-UP brief, see `docs/briefs/blocked-pile-naming-alignment.md`. **The builder must NOT touch
Sidebar or JobsPage in this build.**

Confirmed good: `blockedPile()` does return exactly `'waiting'` / `'planning'` / `null`
(`jobs.js:116-127`). `topLevel` (`JobShelf.jsx:58-66`) does NOT filter out blocked jobs — counts will
be non-zero. `selectedBench` (`JobShelf.jsx:40`) is local state, never passed out; grep confirms no
other file reads it, so **none of Brief E's ~17 bench-colour render sites can break**. Blocked cards
are already non-draggable (`JobCard.jsx:13,19`) and already render in `NO_BENCH_COLORS` via
`benchColors(null)` (`JobCard.jsx:21`) — no card work needed. `blockedReason` does NOT need importing.

**Mandatory fixes — all display-layer, all inside existing scope:**

- **C1 — Never route pile values through the bench chip loop.** `JobShelf.jsx:189` is
  `BENCH_COLORS[bench] || BENCH_COLORS.Admin`; a pile key falls through to the **Admin swatch**,
  re-creating the exact "blocked work looks like Admin" mis-read Brief E removed. Render the two pile
  chips in their OWN block, not inside the `benchCounts.map`. While in here, fix line 189 to
  `benchColors(bench)`. **Do NOT add pile names to `BENCH_ORDER` (`JobShelf.jsx:6`)** — that is the
  lazy implementation and it breaks everything below.
- **C2 — The filter must branch on pile.** `JobShelf.jsx:92-93` is
  `topLevel.filter(j => j.bench === selectedBench)`. Blocked jobs have `bench === null`, so a pile
  selection silently renders the empty state at `JobShelf.jsx:259-262` — correct count, empty list.
  Namespace the stored values as `'pile:waiting'` / `'pile:planning'` (a prefixed value can never
  collide with a real `job.bench`) and add an explicit `blockedPile(j) === pile` branch ahead of the
  bench comparison.
- **C3 — Make blocked EXCLUSIVE, no double-counting.** `inferBench` returns `null` for blocked jobs
  (`jobs.js:27`) but only runs on the CSV path (`App.jsx:779`); Supabase takes bench verbatim
  (`useSupabase.js:53`) and does not recompute it, though it DOES recompute `schedulable` against
  `blockedPile` two lines later (`useSupabase.js:74`). So a job that went On Hold keeps a stale
  `bench: 'Setup'` and would count in BOTH Setup and Waiting. Fix the bench count
  (`JobShelf.jsx:70`) and the bench filter (`JobShelf.jsx:93`) to add `&& blockedPile(j) == null`.
  During the build, report the live count of jobs where `job.bench != null && blockedPile(job) != null`.
- **C4 — Validate the persisted selection.** `JobShelf.jsx:40,50-51` persists to
  `localStorage['jobShelfBench']`. On restore, discard any stored value that is neither in
  `BENCH_ORDER` nor a known `pile:` key, so a stale value can't boot the shelf into a dead filter.
- **C5 — Suppress drag-mode controls on a pile selection.** `JobShelf.jsx:231-248` renders the
  Regular / 🚨 Urgent buttons whenever `active` is true (`JobShelf.jsx:80`). With a pile selected that
  offers drag controls above cards that cannot be dragged. Hide that block for pile selections.
- **C6 — Header wording (Trevor approved).** Change the caption at `JobShelf.jsx:134` from
  `jobs waiting` to `unscheduled`. Text only, no logic — removes the collision with the new
  "Waiting" chip.

**Placement & style (council recommendation, adopt as spec):**
- Both chips at the **end** of the row, forced onto their own line via a
  `<div style={{ flexBasis: '100%', height: 0 }} />` spacer after the `benchCounts.map`, order
  Waiting then Planning. Prepending would shift every bench chip and break muscle memory; plain
  appending lets wrap put them in an unstable position.
- Style: same size/shape/padding as bench chips, but **outlined not filled** — `background:
  'transparent'`, permanent `border: 1px solid #334155`, `color: '#64748b'`; active state
  `color: '#94a3b8'`, `borderColor: '#475569'`; same 0.5/1 opacity rule as bench chips. No emoji, no
  lock icon. This matches the existing `NO_BENCH_COLORS` house convention for "not a bench"
  (`jobs.js:422`) without inventing a colour, and matches the dim cards the chip reveals.
- **Empty state: hide the chip at count 0** (precedent: the Focus pill at `JobShelf.jsx:171`). If both
  are 0, suppress the flex-break spacer too, or the row gains a phantom blank line.

**Known, accepted, not to be "fixed" in this build:** chip counts ignore the hours-bucket filter
(`matchHours`, `JobShelf.jsx:97`) — the existing bench chips already behave this way. Upside worth
noting at verification: blocked jobs are in the `topLevel.length` header (`JobShelf.jsx:133`) but in no
chip today, so counts have never summed to the header; these two chips close that gap.

## Method — agent-team protocol

1. **Brief** — this file. ✅ Approved by Trevor 2026-07-27.
2. **Council** — quick pass on placement/wording/edge cases. The one-vs-two question is already settled
   (two chips); council does not reopen it.
3. **Builder** — staging branch, supervised.
4. **Independent verifier** — separate agent.
5. **Browser test** — Vercel preview, confirm the chip appears, count is right, click filters correctly,
   cards stay non-draggable.
6. **Merge** — Trevor's "yp".

**No commits before step 1 is approved.**
