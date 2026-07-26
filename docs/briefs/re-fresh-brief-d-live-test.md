# Session refresh — Live Test the Brief D focus-list fix

Continuing work in the **GGNZ SCHEDULER PROJECT**, which has just been relocated to
`/Users/admin/Desktop/1. PROJECTS/Business/AI FILES/GGNZ SCHEDULER PROJECT`
(it used to live on the iCloud Desktop — that copy no longer exists). Branch:
**`brief-d-sunday-board-meeting-supabase`**, HEAD `a0133e3`, pushed to GitHub.

Goal of this session: **run the Live Test of the focus-list auto-wipe fix with Trevor at the
keyboard, then stop.** Do not merge. Merge happens only on Trevor's explicit "yp" after the
test passes, and only the assistant runs git — Trevor never does.

Trevor is **not a developer**. Explain in plain English. Don't push process decisions onto
him; make the technical calls yourself and tell him what you decided.

## Where things stand

**The bug that was fixed.** The Focus list (job IDs Trevor picks in the Sunday board meeting)
was being silently wiped. Root cause: `loadFocusList()` returned `[]` on a failed read, which
the app couldn't tell apart from "the list is genuinely empty" — and then the auto-save wrote
that emptiness back, clearing the table for good.

**The fix** (commits `4170c75` and `a0133e3`, in `src/utils/supabase.js` and
`src/hooks/useFocusList.js`):
- a failed read now returns `null`, not `[]`
- a `null` read never arms the auto-save — the app goes read-only for that session
- `saveFocusList()` snapshots the old rows and restores them (via `upsert`) if the write fails
- a `saveTick` counter re-diffs after each save, so a change made mid-save isn't stranded
- 3 consecutive failed saves stops the auto-save rather than retrying forever

**Verification so far.** An independent Verifier passed items 1, 2, 3, 4, 6 and 8, flagged
item 7, and the flagged bug was then fixed in `a0133e3`. `npm run build` is clean from the new
location. The Supabase SQL migration has been run and confirmed.

**The one thing still unproven.** That a *failed read* genuinely refuses to arm the auto-save
was verified by reading the code, not by running it. That is the single most important thing
this Live Test exists to prove.

**Current data.** The focus list was recovered from the old Firestore data and restored — it
holds **10 job IDs**: `1520, 1621, 1626, 1632, 1679, 1698, 1702, 1703, 1582, 1505`.

**Known non-bug, needs Trevor's preference.** The pill reads "🎯 Focus (10)" but the shelf
shows 7. The three missing (#1626 Griffin Beach, #1698 Matt Packard, #1702 Sheep as Chips) are
all `done: true` and already on the calendar, and the shelf only lists jobs still *waiting*.
Ask Trevor whether he wants the pill to count all 10, or only the ones actually shown.

**Also worth knowing:** `setFocusList` currently has no UI caller anywhere in `src/` — nothing
in the app writes to the focus list yet. That gets wired up later in Brief D. So the save path
can't be exercised through the interface today; test it the way step 3 below describes.

## Next steps

1. **Start the dev server** — double-click `Start Scheduler Dev.command` in
   `1. PROJECTS/Business/AI FILES/`, or run `npm run dev` in the project folder. It should come
   up on `http://localhost:5173/`. (`node_modules` was reinstalled after the move; if anything
   looks off, `npm install` again.)
2. **Confirm the read path.** The Focus pill should read "🎯 Focus (10)". Click it — it filters
   the shelf down to focus jobs only. Note: one click toggles on, a second toggles it back off,
   so if it looks like nothing happened, that's what occurred.
3. **Prove the failed-read protection.** With the app open, cut network access to Supabase
   (offline mode / block the request in devtools), then reload. Expected: the console logs
   `Focus list failed to load — auto-save disabled this session to protect existing data.`
   and **the `focus_list` table in Supabase still holds all 10 rows**. Check the table directly
   to confirm — that's the actual pass/fail.
4. **Restore network, reload,** and confirm the pill returns to 10 and the table is untouched.
5. **Ask Trevor the pill-count question** above and note his answer.
6. **Update the stale status line** at the top of `.claude/pending-brief.md` — it still says
   item 7 is "not yet independently verified", which is out of date. It has been verified,
   flagged, and re-fixed.
7. **Stop.** Report the result. Merge only if Trevor says "yp".

## Files to open (read these, don't re-derive)

- `src/hooks/useFocusList.js` — the whole fix lives here; every comment explains a specific
  failure mode. Read this before touching anything focus-list related.
- `src/utils/supabase.js` — `loadFocusList()` / `saveFocusList()` / `clearFocusList()`, the
  `null`-vs-`[]` contract and the restore-on-failure path.
- `.claude/pending-brief.md` — the authoritative scope document. "Scope item 7" covers this
  fix in full, including the two issues accepted-but-not-fixed. Its status line is stale.
- `src/App.jsx:194` — `const { focusList } = useFocusList();`, the only consumer today.
- `docs/supabase-schema.sql:82` — the `focus_list` table. `id` is a `TEXT PRIMARY KEY`, which
  is why the restore path uses `upsert` rather than `insert`.

## Avoid repeating

- Don't take a Verifier's "dead code" / "safe to ignore" conclusion at face value — grep and
  read the actual call chain first. That has been wrong twice in this Brief already.
- Don't confuse DB/CSV *column* casing (uppercase `VB`/`BL`/`PJ`, correct, unchanged) with
  in-app *job object* casing (lowercase `vb`/`backlog`/`project`). Two real bugs came from this.
- Don't save new files or create folders outside
  `1. PROJECTS/Business/AI FILES/GGNZ SCHEDULER PROJECT`. Scattered files across two Desktops
  is exactly the problem that was just cleaned up.
- HMR can throw "change in the order of Hooks" errors in the console after editing
  `useFocusList.js`. That's a hot-reload artifact — do a hard reload before believing it.
