# Session refresh — Wire up the focus-list write path, then Live Test

Continuing work in the **GGNZ SCHEDULER PROJECT** at
`/Users/admin/Desktop/1. PROJECTS/Business/AI FILES/GGNZ SCHEDULER PROJECT`
(recently relocated off the iCloud Desktop — that copy no longer exists). Branch
**`brief-d-sunday-board-meeting-supabase`**, HEAD `a0133e3`, pushed to GitHub.

Goal of this session: **build the missing write path so Trevor can actually pick focus jobs in
the app**, then Live Test it. Do not merge — merge only on Trevor's explicit "yp", and only the
assistant runs git. Trevor never runs git himself.

Trevor is **not a developer**. Plain English. Make the technical calls yourself and tell him
what you decided rather than asking him to choose between implementations.

## Where things stand

**The gap.** The focus list is fully readable and fully persisted, but **nothing in the UI can
set it**. Confirmed by grep, not assumed:

- `useFocusList()` returns `{ focusList, setFocusList }` — `setFocusList` has **zero callers**
  outside the hook itself.
- `App.jsx:194` destructures only `focusList`, dropping the setter on the floor.
- Three components read it and are purely display/filter: `Sidebar.jsx`, `JobShelf.jsx`,
  `DailyLogPage.jsx` (each builds a `focusSet` and filters).
- `CatchUpInterview.jsx` is the weekly catch-up ritual, but its props are
  `{ days, logs, jobs, completedJobs, onJobComplete, onClose }` — **no focus handling at all.**

So the Sunday board meeting can be *run* as a conversation, but Trevor's picks can't reach the
app. The current 10 IDs in the table were written manually during recovery.

**The storage layer underneath is done and safe.** Commits `4170c75` and `a0133e3` fixed an
auto-wipe bug in `src/utils/supabase.js` and `src/hooks/useFocusList.js`: a failed read returns
`null` (not `[]`), a `null` read never arms the auto-save, failed writes restore the previous
rows via `upsert`, and 3 consecutive failures stop the auto-save. An independent Verifier passed
items 1,2,3,4,6,8; item 7 was flagged and re-fixed in `a0133e3`. Build is clean.

**Current data:** 10 job IDs — `1520, 1621, 1626, 1632, 1679, 1698, 1702, 1703, 1582, 1505`.

**Open preference question for Trevor:** the pill reads "🎯 Focus (10)" but the shelf shows 7.
The three missing (#1626, #1698, #1702) are `done: true` and already on the calendar, and the
shelf only lists jobs still *waiting*. Ask whether the pill should count all 10 or only what's
shown.

## Recommended approach

Do this in two phases, smallest useful thing first. **Phase 1 alone makes Sunday work.**

**Phase 1 — a focus toggle on jobs.** Pass `setFocusList` down from `App.jsx` and add a
toggle (a star/target control) on the job card or in `JobDrawer`, so Trevor can add or remove
any job from the focus list at any time. This is the whole write path; everything else is
convenience on top. Keep it a pure add/remove of an ID in the array — the hook already handles
debounce, persistence, failure recovery and realtime.

**Phase 2 — a "Plan the coming week" step in `CatchUpInterview.jsx`**, which presents candidate
jobs at the end of the ritual and lets Trevor pick, writing through the same setter.

Don't build Phase 2 until Phase 1 is working and Trevor has seen it.

## Next steps

1. **Add a brief entry before committing** — repo norm is "no brief entry, no commit". Add a
   "Scope item 8" (or similar) to `.claude/pending-brief.md` covering the write path. While
   you're in that file, its status line is stale: it still says item 7 is "not yet
   independently verified", which is out of date.
2. **Build Phase 1.** Not blast-radius work (see the list in `CLAUDE.md`) — `useFocusList.js`
   and the focus block of `supabase.js` are not on it, so this does not need the full
   Brief → Council → Builder → Verifier cycle. Build it directly.
3. **`npm run build`** — the only check in this repo, there is no lint script.
4. **Live Test with Trevor at the keyboard.** Dev server via `Start Scheduler Dev.command` in
   `1. PROJECTS/Business/AI FILES/`, or `npm run dev` → `http://localhost:5173/`.
   - Toggle a job into focus. The pill count rises. Reload — it persists.
   - Toggle it back out. Count drops. Reload — still gone.
   - Check the `focus_list` table in Supabase directly to confirm rows match.
   - **The one thing never proven by running it:** cut Supabase network access and reload.
     Expected — console logs `Focus list failed to load — auto-save disabled this session to
     protect existing data.` and **the table still holds every row**. Verify in Supabase. This
     is the single most important check; it was only ever verified by reading the code.
5. **Ask the pill-count question** above and note the answer.
6. **Stop and report.** Merge only on "yp".

## Files to open (read these, don't re-derive)

- `src/hooks/useFocusList.js` — the whole persistence fix, with comments explaining each
  failure mode. Read before touching anything focus-related. Exports `setFocusList`, unused.
- `src/App.jsx:194` — where `setFocusList` is currently dropped; the wiring starts here.
  Lines 595 and 633 show how `focusList` is already passed down.
- `src/components/JobShelf.jsx:45` and `src/components/Sidebar.jsx:12` — the existing
  `focusSet` filter pattern, and the count comment explaining the 10-vs-7 discrepancy.
- `src/components/CatchUpInterview.jsx:46` — the ritual component and its current props, for
  Phase 2.
- `src/utils/supabase.js` — `loadFocusList()` / `saveFocusList()`, the `null`-vs-`[]` contract.
- `.claude/pending-brief.md` — authoritative scope doc; "Scope item 7" covers the storage fix.
- `docs/supabase-schema.sql:82` — the `focus_list` table; `id` is `TEXT PRIMARY KEY`, which is
  why the restore path uses `upsert` not `insert`.

## Avoid repeating

- Don't take a Verifier's "dead code" / "safe to ignore" conclusion at face value — grep and
  read the actual call chain. That has been wrong twice in this Brief.
- Don't confuse DB/CSV *column* casing (uppercase `VB`/`BL`/`PJ`, correct) with in-app *job
  object* casing (lowercase `vb`/`backlog`/`project`). Two real bugs came from this.
- Don't create files or folders outside the project folder above. Scattered files across two
  Desktops was just cleaned up and Trevor was explicit about not repeating it.
- HMR throws "change in the order of Hooks" errors after editing `useFocusList.js`. That's a
  hot-reload artifact — hard reload before believing it.
- One click on the Focus pill toggles on, a second toggles back off. If it looks like nothing
  happened, that's what occurred — it's not a bug.
