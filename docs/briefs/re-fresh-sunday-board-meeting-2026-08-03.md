---
doc_status: live
---

# Session refresh — run the live half of the Sunday board meeting (2026-08-03)

Continuing work in the GGNZ Scheduler project. Goal of this session: run steps 2–10 of the
Sunday board meeting with Trevor — the live conversation. Step 1 (the auto-gathered reports)
already ran; its output is embedded below. **Do not re-run the workflow.**

## Update 2026-08-04 — read this before the rest of the file

The meeting still has NOT happened. It is still at step 2 (not-completed reasons). Nothing
has been written: no schedule, no focus_list, no parts_to_order rows, no minutes, no Apple Note.

Resolved since this brief was written — the sections below are stale on these two points:
- **The workflow fixes are committed.** Both the `args`-parsing fix and the exportData fix are
  in (`f65479d`), working tree clean. Nothing to commit, don't re-ask.
- **The parts-blocked miscount is fixed** (`7a2e5ea`). The count now finds WP jobs wherever
  they sit, not just on the backlog. The carried-over Ops report below still contains the OLD
  wrong text ("nothing is parts-blocked") — the truth is **2 parts-blocked: 1705 and 1679**.

Still open:
- **Board meetings can only run where `.env` is — currently Micky only.** Web/iPhone sessions
  cannot run one: no `.env`, so no Supabase read (job list, parking lot) and no step-10 writes.
  Don't start a board meeting from a web session. Confirmed 2026-08-04.
- **Moby setup — PARKED 2026-08-04.** Trevor AirDropped `.env`/`.env.local` to Moby and it still
  didn't work: Moby's clone lives in iCloud Drive, which offloads and part-syncs files, so git
  and the dev server both break on it. Fix when picked up: clone fresh to `~/scheduler` on Moby
  (outside iCloud), AirDrop the two env files into it, then delete the iCloud copy — two clones
  on one machine is the same out-of-sync failure as 2026-06-14. Nothing is lost by deleting it;
  only the gitignored env files are not on GitHub.
- The Finance caveat below still stands in full — $50 is not the real week.

## Where things stand

The `sunday-board-meeting` workflow ran successfully for week starting 2026-08-03, reporting on
the week just worked (weekKey 2026-07-27). It produced the Ops / Finance / Admin reports only.
None of the live ritual has happened: not-completed reasons, coming-up deadlines, Admin's live
parts additions, challenges, lessons, backlog triage, the Parking Lot review, or the three
end-of-meeting writes (schedule → scheduledSlots/calendarSlot, picked jobs → focus_list via
saveFocusList, new parts → parts_to_order).

Fixes made to `.claude/workflows/sunday-board-meeting.js` this session, **uncommitted**:
- `args` can arrive as a JSON string; it's now parsed either way. Previously the run died
  instantly on "Invalid Date" before spawning a single agent.
- The gather step no longer relies on a subagent echoing the export's stdout — the export is
  ~44KB and the agent refuses to reproduce a payload that size, which failed every time. The
  script now prefers `args.exportData`, with the agent path kept only as a fallback.
  So the caller runs `node scripts/board_meeting_export.mjs` and passes the parsed object in.

## Known-wrong numbers — say these out loud before Trevor acts on them

- **Parts-blocked count reads 0. It should read 2.** `partsJobs` filters `backlog` jobs only,
  but jobs 1705 and 1679 are marked WP with `backlog: false`, so they vanish. Not yet fixed.
- **Finance's $50 is not the real week.** The mark-done bug (parked 2026-07-31, Parking Lot item
  pk-md-04) wipes the completed-jobs table after a hard refresh. 9 jobs / $780.86 ex GST were
  lost that way. $50 is the survivor, not the takings.

## Next steps

1. Walk Trevor through steps 2–10 as a conversation, one thing at a time.
2. Read the Parking Lot with him — it is his own agenda, entered in-app during the week.
3. Do the three writes at the end, only after he approves.
4. Ask whether to commit the workflow fixes and whether to fix the parts-blocked miscount.
5. Open question he hasn't answered: copy `.env` to Moby so board meetings can run there, or
   keep them on Micky? (`.env` and `.env.local` are gitignored, so Moby currently can't export.)

## Files to open (read these, don't re-derive)

- `.claude/workflows/sunday-board-meeting.js` — the meeting's phase boundary is documented in
  its header comment: what belongs in the workflow vs. what must be a live chat turn.
- `scripts/board_meeting_export.mjs` — the data pull. Needs `.env` with the Supabase keys.
- Supabase `parking_lot` table (open items) — Trevor's agenda. There is exactly ONE parking lot;
  `admin/context/parking-lot.md` is deleted, don't go looking for it.

## Carried-over data — the three reports, verbatim (they exist nowhere else)

**Ops:** Backlog is 12 jobs, with 4 ready to schedule right now. Nothing is parts-blocked or in
transit, so no supplier risk on the board this week. The main drag is the 3 awaiting customer —
that's the only bucket needing chase-ups; the remaining 5 sit outside both the ready and blocked
groups and need a status pass to confirm where they belong.
*(The "nothing parts-blocked" line is the miscount above — 1705 and 1679 are both WP.)*

**Finance:** One job invoiced last week — $50.00 ex GST ($57.50 incl). That's effectively a
zero-revenue week against a cash position that's already tight. Getting invoiceable work out the
door this week is the only lever that matters.
*(See the mark-done caveat above.)*

**Admin:**
1. Parts to chase (~30 min in one block): job 1616 Ernie Ball Primo Slinky and job 1705 TDA7294
   both need an actual order placed. Job 1679 pop rivets (1"/25mm head, 3.5–4mm dia) is a
   sourcing job, not an order — needs ringing round suppliers, so give it its own slot.
2. Customers needing a call (~45 min, back-to-back): job 1175 Julian Henry, job 321 and job 592
   both Sheep as Chips Ltd — 321 and 592 are the same customer, so one call covers two jobs.
3. Flagged: 1679's rivets are marked "odd size — source, not order", so that job is stalled until
   the sourcing call happens. 1616 and 1705 have no supplier or ETA recorded, so there's no way to
   tell whether they were ever placed — treat both as unplaced.

**Raw counts:** 55 jobs total, 12 backlog, 4 schedulable now, 3 awaiting customer
(1604 Toi Ohomai, 1268 Chris Doms, 1448 Annette Papuni), 2 waiting parts (1705, 1679),
1 completed job last week ($50 ex GST), 3 open parts_to_order items, 16 open Parking Lot items.
