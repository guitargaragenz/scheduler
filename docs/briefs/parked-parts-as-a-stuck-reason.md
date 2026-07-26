# Parked brief — Parts as a stuck reason

**Status:** **PARKED.** Not approved, not scoped, not started. No "yp" sought yet.
**Date parked:** 2026-07-27
**Blocked on:** the first Sunday board meeting run. See "Why this waits" below.
**Split from:** Brief E (job blocking), where the two parts items were cut at council.

---

## What this is

Three pieces that only work together. Any one of them alone is not worth building.

1. **Bujo quick entry gets a toggle.** Trevor types the part he needs or is hunting for,
   hits the toggle, and it goes straight to the parts list instead of into the day's log.
   **This is the writer that makes the whole thing work** — it means parts get captured at
   the bench, in the moment, rather than held in his head until Sunday.
2. **The part shows as the stuck reason** on its job in the Waiting pile — replacing the
   generic "waiting on a part" with the actual part.
3. **A checkbox clears it** when the part lands.

On piece 3, an important detail in Trevor's own words: he enters the part in Multitrack the
moment it arrives anyway, **so MT is what actually unsticks the job** on the next import. The
checkbox does not unstick anything. It only clears the item off the chase list. Do not build
it as a job-state write.

---

## Why this waits

`parts_to_order` is **empty, not dead.** An earlier finding in Brief E's plan called it dead
code because nothing in `src/` writes to it. That was the wrong test — the writer is the
Sunday board meeting, not the app. `.claude/workflows/sunday-board-meeting.js` names
"new parts → `parts_to_order`" at lines 12 and 16 as one of its three end-of-meeting writes,
reads the list back at line 73, and hands it to the Admin seat at line 95.

The table is empty because **the first board meeting has not run yet.** Trevor is holding it
until the job-blocking build merges (confirmed 2026-07-27).

So this brief waits on the first meeting run — not on anything technical. Building it before
then means shipping a feature that displays nothing and cannot be tested against real data.

**Verified live 2026-07-27, read-only:** `parts_to_order` exists in Supabase with all six
columns (`id`, `description`, `category`, `needed_for_job`, `added_at`, `resolved`).
`completed_jobs` has `invoice_amount` and `week_key`. `scripts/board_meeting_export.mjs` runs
clean end to end. **The Brief D migration was already run** — no SQL is outstanding for it.

---

## The design question that decides whether it works

**The entry has to carry the job number.** Quick entry from job 1268's card should tag itself
to 1268 without Trevor typing it. Quick entry from the general box with nothing open is shop
stock with no job.

The schema already allows both: `needed_for_job` is deliberately nullable, and there is a
comment above the table in `docs/supabase-schema.sql` explaining why — a part can be flagged
against a job number that later disappears, or against no job at all.

### What the bujo quick entry actually does today

Read before planning, per Trevor's instruction. Findings, `src/components/DailyLogPage.jsx`:

- The box is a single free-text input, placeholder `"quick note — hit enter"`, at line 1002
  (and again at 1241 — **there are two of them**, presumably desktop and mobile; both must get
  the toggle or the feature is half-present).
- `handleKeyDown` at line 776 calls `onAddBullet(input.trim(), null, null)`. **The box has no
  concept of a currently-open job** — that first `null` is where a job id would go, and it is
  hardcoded.
- There is already a precedent for exactly the control this needs: when the input has text, a
  button appears beside it (line 1012) that opens a scheduling modal. A parts toggle is the
  same pattern, second button.
- Job-linked bullets **do** exist: `bullet.jobId` at lines 200/205/309, and `pulledJobIds` at
  798. A job pulled into today's log becomes a bullet that already carries its number.

**So: the bujo box on its own cannot tag a job.** Anything typed there is shop stock unless a
job number is inferred from somewhere, and there is nowhere to infer it from.

### Recommendation — two writers, not three

Trevor asked for a recommendation rather than picking. This is it:

- **Bujo quick entry — yes, build it.** Accept that what it captures is shop stock with no job
  attached. That is the honest reading of what the box knows, and it is still the piece that
  matters most: it is the one that catches a part at the bench instead of losing it until
  Sunday. Do not fake a job link here.
- **A control on the job card — yes, build it.** This is the one that carries the job number
  for free, because you started from the job. **Without it, nothing ever populates
  `needed_for_job`, and piece 2 — the part showing as the stuck reason — never fires at all.**
  It is not optional garnish; it is what makes two of the three pieces work.
- **A separate entry point in the Waiting pile — no.** It would be a third writer for the same
  record, and the pile is where the reason *displays*. Reader, not writer. If reaching the job
  card from the pile is awkward, fix that navigation rather than adding a third way in.

---

## Not part of this

- `PartsDrawer.jsx` is the **PartsBox inventory** drawer (`utils/partsbox.js`), a different
  system entirely. Unrelated to `parts_to_order` despite the name.
- `admin/context/GGNZ Parts Shopping List.csv` — a May 2026 component-level restoration BOM
  (capacitors and resistors by value, with board references). **Trevor was unaware it existed**
  until it surfaced on 2026-07-27. Different granularity, different purpose. **Do not migrate
  it into `parts_to_order`.** Worth a separate conversation about whether it is still wanted at
  all; not this brief's problem.
- Do not delete `parts_to_order` or its five Supabase functions (`loadPartsToOrder`,
  `addPartsToOrderItems`, `removePartsToOrderItem`, `markPartResolved`,
  `subscribeToPartsToOrder`, `supabase.js` lines 766–860) on the strength of the superseded
  "dead code" reading.

---

## Before this starts

Blast-radius check: this writes to a shared Supabase table and touches the daily log, so it
runs the full agent-team protocol — brief, "yp", council, builder, independent verifier,
browser test, merge. Not a solo job.
