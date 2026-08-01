# Parking Lot

> **⚠️ THIS IS NOT THE ONLY PARKING LOT — read the other one too (found 2026-07-31).**
> The in-app Parking Lot page (`src/components/ParkingLotPage.jsx`, Supabase table
> `parking_lot`) is **Trevor's own input channel into the Sunday meeting** — queries, ideas
> and questions he logs during the week for the next meeting. He built it for that. The
> board-meeting workflow carried a comment calling it "an unrelated product-idea feature",
> so **the meeting has never read it**: 8 items have sat there since June 2026, one of them
> titled "Sunday board meeting with Claude + agents". Read that table at every meeting until
> the two are merged. Corrected in `.claude/workflows/sunday-board-meeting.js`.
>
> - [ ] **Merge the two parking lots, or make the meeting read both.** One purpose, two
>   stores, and only one of them gets looked at. Trevor's is the one that matters — it's
>   the half of the meeting agenda he can't otherwise get into the room. Needs scoping.
> - [ ] **`saveParkingLot()` clears the table before re-inserting** (`src/utils/supabase.js:653`
>   → `clearParkingLot()` at :668). **This is the identical pattern to the mark-done bug
>   below that wiped the completed-jobs table.** If the page ever saves while its in-memory
>   list is empty — after a hard refresh, say — all 8 of Trevor's items go. Not observed
>   happening, but the same loaded gun. Back the table up before touching this page.

Currently-open items only — grouped by category, not by session date. Completed/dropped history lives in [`session-log.md`](session-log.md). Reviewed every Sunday.

> **Cleared out 2026-07-28.** Trevor reviewed all 46 open items and closed 40 of them in one
> pass: every bug except the Pomodoro timer, the whole Features & Ideas wishlist, all UX-friction
> items, all Scoped builds, and the Cowork IMAP item. Most had either shipped, died with the
> Firestore→Supabase move, or stopped mattering. **Nothing is lost** — the full list is in
> `git log -- admin/context/parking-lot.md`, and the history is in `session-log.md`.
>
> This file is deliberately short now. Keep it that way: if an idea isn't something you'd
> actually start, it doesn't belong here.

---

## Bugs

- [ ] **Google Calendar appointments stopped showing on the board** (reported by Trevor 2026-07-29, deferred by him — "we can fix it later"). **Not caused by Brief G Build 1a**: that merge touched no calendar or scheduling file, and `scheduled_slots` is intact at 26 rows. The app's own bookings still display; it's the Google-sourced appointments that are missing. Production has the Google credentials baked in, so it isn't a missing Vercel env var. **My first theory was the in-memory access token** — `src/utils/googleCalendar.js:87` never persists it, so it dies on every refresh and after ~1hr — **but Trevor says reconnecting didn't bring them back and it "worked perfect before", so that theory is unconfirmed and probably incomplete.** Next session: check the browser console for a Calendar API error, confirm which calendar id the board is reading, and whether the OAuth consent/scope or the calendar's sharing changed. Note this is `useGoogleCalendar.js` — blast-radius, full protocol, needs its own brief.
- [ ] **Mark-done wipes the completed-jobs table after a hard refresh** — **PARKED BY TREVOR 2026-07-31, do not pick this up casually.** Reproduced live this session: the table held 9 completed jobs ($780.86 ex GST); Trevor hard-refreshed the app, marked job 1687 done, and the table dropped to that 1 row. **Root cause is confirmed, not a theory:** `handleMarkDone()` in `src/hooks/useJobs.js:255` builds `newRecords` from the tab's in-memory `completedJobs`, then `saveCompletedJobs()` in `src/utils/supabase.js:1163` calls `clearCompletedJobs()` — a full `DELETE` of the table — before re-inserting that array. A hard refresh leaves the in-memory list empty, so the next mark-done replaces the whole table with one row. This also explains job 1702: marked done, no surviving record. **Why it's parked:** Trevor says revenue "has never worked properly" and the last attempt to fix it "genuinely broke the app". So this is NOT a quick patch — it's `useJobs.js` + `supabase.js`, blast-radius, and it has a history of blowing up. It needs its own brief and the full agent-team protocol, with the previous failed attempt read first (`git log -- src/utils/supabase.js`). **The fix direction is straightforward** (insert one row; never delete the table), but the risk is in what else reads that table. **Live workaround until then: after any hard refresh, reload and let the page finish loading before marking anything done — or better, don't mark done in a tab you just refreshed.** Pre-wipe snapshot of the 9 lost rows preserved this session; if restoring later, the figures are in the 2026-07-31 board-meeting session transcript.
- [ ] **BuJo repeats a job once per split** (raised by Trevor 2026-07-31). The 2026-07-31 daily log carried "Pete Johanson — Ampeg SVT 6 Pro" six times — one bullet per scheduled split of the same job. Not a duplication bug; it's one-bullet-per-slot behaviour. **What Trevor wants instead: one bullet per job per day, with the extra splits folded into it as detail** (times/benches on the one line) rather than six near-identical lines. Small-ish UI change in the daily-log build, but confirm where the bullets are generated before scoping.
- [ ] **Pomodoro timer broken** — alarm doesn't sound at session end, and the timer itself doesn't work right (confirmed by Trevor 2026-07-01, on top of earlier alarm-only reports). Not touched yet.

---

## Parts to order

**RESOLVED 2026-07-31 — both parts now live in the `parts_to_order` table, not here.** They were
held in this file because the table rejected every insert (*"new row violates row-level security
policy"*): `docs/supabase-schema.sql` creates it and publishes it to realtime but never grants it
a policy, and unlike every other table nobody added one by hand in the dashboard. Trevor ran the
policy on 2026-07-31 and both parts inserted cleanly (ids `pto-2026-07-31-1705`,
`pto-2026-07-31-1679`).

Two things that came out of it and are NOT fixed:

- [ ] **`addPartsToOrderItems()` swallows its own failures** (`src/utils/supabase.js:981`). It
  wraps the insert in `try/catch`, logs to `console.error`, and returns normally — no throw, no
  return value. So the board meeting's "new parts → `parts_to_order`" write has been failing
  since the table was created and reporting success every time. Nobody would ever have found this
  from the app; it took a direct insert test. Worth a look at whether the other `supabase.js`
  writers do the same thing, because if they do, this is a pattern and not one bug.
- [ ] **`id` has no default** — `parts_to_order.id` is `TEXT PRIMARY KEY` with no generator, so
  every caller must invent one. That is deliberate and matches the app (`item.id ||
  \`pto-${Date.now()}-${Math.random()}\``), but it means any script or future writer that forgets
  is rejected at the database. Fine as-is; just don't be surprised by it twice.

---

## Housekeeping

- [x] Two unidentified screenshots on Desktop root — **dealt with, confirmed by Trevor 2026-07-28.**
- [x] Dangling `SCHEDULER` symlink on Desktop (old pointer to Moby's `/Users/trevorcollings/...`) — **gone, verified 2026-07-28**: no symlinks remain on Desktop root.
- [x] **Revoke the `jt-backup-ggnz-35a126beb4ca.json` service-account key in Google Cloud Console** — **done, confirmed by Trevor 2026-07-28.** The archived copy in `archive/job-tracker/` is now a dead key.
- [ ] **`/read-the-manual` (personal skill, `~/.claude/skills/`) isn't reachable from git-worktree-isolated sessions** — confirmed 2026-07-11 when the build session running on `feature/daily-log-carry-forward` (a worktree) couldn't find the command at all. Personal skills are likely local-session-scoped in a way worktree-isolated sessions don't inherit. Not blocking (worktree sessions get their context from the plan/brief directly instead), but worth understanding/fixing if this skill is meant to be usable from any session type. **On the same 8:30pm reminder as the key, as a footnote.**

---

## Skills / Tooling

- [ ] **`/next` should name the session after the brief it lands on** (raised by Trevor 2026-07-29). Every `/next` session ends up auto-titled something like "next steps", so the session list is a wall of identical names and he can't find a session later. Wanted: the title says which brief the session was working — e.g. *"Brief H — Build 2: retire the CSV pipeline"*. **Known obstacle:** the `set_session_title` tool refuses to rename the session it's running in ("must not be the current session"), so this can't just be a step added to the skill. Needs a different route — a hook, or the skill writing the name somewhere the app picks up. Worth 10 minutes of looking before assuming it's possible.
- [ ] **Build a "guitar wiring diagram" skill** (parked 2026-07-24) — bottle the approved schemdraw setup (venv, SVG backend, house style: text beside symbols, cap off volume wiper, tone ground faces right, etc.) + `guitar_draft.py` as reference + a render-and-check checklist. Scope narrow to guitar wiring, NOT general electronics. Deliberately parked until the bench switcher schematic is finished so real lessons feed in. Files live in `…/BUILDS/Bench Switcher/`. See memory `reference_schemdraw_wiring.md`.
