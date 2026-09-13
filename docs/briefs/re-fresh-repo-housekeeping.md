---
doc_status: closed
---

# Re-fresh — repo housekeeping

**Written:** 2026-07-27. **Rewritten:** 2026-07-29 — most of it was already done.
**Closed 2026-07-30 — everything left in this brief shipped:** `SplitDrawer.jsx` deleted
(`096986e`), the two spent scripts deleted and their dangling comment refs fixed
(`7b7848e`), `cowork-context-summary.md` deleted (`9c0605b`), the pre-migration backup
JSON deleted (`c44f2db`), and the two merged local branches removed. Section 3's
twenty-branch list and Section 2's `rebuild_csv.py` were already stale by the time this
session read them — both gone before this session started. Nothing left to do here.
**For:** a fresh session, any machine. Nothing here needs a dev server.
**Task:** clear the last few dead files out of the repo.

---

## What changed on 2026-07-29

This brief was written as a 5-section sweep. Re-checked against the live filesystem on
2026-07-29, **Sections 1, 2 and 5 are finished and Section 3's blocker is gone.** The old
text was still telling readers to delete files that no longer exist and to wait on a build that
merged two days ago — so it has been cut down to what's actually left.

Also gone: the **STOP header** about branch `staging/job-blocking` being mid-build. Brief E
merged. There is no live build in this tree. `git worktree list` shows the main checkout only.

**Done already, nothing to do (verified gone / verified applied 2026-07-29):**

- `admin/context/GGNZ Parts Shopping List.csv` + `.txt` — gone. `admin/claude.md` no longer
  carries the wrong "live capacitor/parts stock data" description.
- `context/runway-mockup.html` and the `context/` folder — gone.
- `.claude/worktrees/` — both dead worktrees deleted, `git worktree prune` run, and the
  `vite.config.js` comment already updated to say so (`vite.config.js:57`). The
  `.claude/worktrees/**` test exclude stays, deliberately.
- `pipeline.log` — gone from the repo root. The 2.5 MB forensic one in `SCHEDULER_old/` is
  outside this repo and stays where it is.
- `DESIGN.md` (the Matakana Superfoods capture) — gone from the repo root.
- The twelve stale local branches — **not** cleared, but see Section 3 below; the list has
  changed enough that the old one was misleading.

---

## Section 1 — dead component

| File | State |
|---|---|
| `src/components/SplitDrawer.jsx` | **CONFIRMED unreferenced**, re-verified 2026-07-29 |

A whole-repo grep for `SplitDrawer` across `.js` / `.jsx` / `.md` returns two hits: its own
`export default function` line at `src/components/SplitDrawer.jsx:7`, and this brief. Nothing
imports it. Splitting runs through a different path.

The old blocker — "Brief E is mid-build in `src/`" — no longer applies. Safe to delete on a
"yp". Re-run the grep first anyway; it costs nothing.

---

## Section 2 — scripts that have finished their job

All three say so in their own header comments. Read them before deleting.

| File | The header says |
|---|---|
| `scripts/backfill_daily_logs_to_supabase.mjs` | *"THROWAWAY one-shot backfill — Brief C… Safe to delete once the migration is signed off."* Brief C shipped. |
| `scripts/rebuild_csv.py` | Recovery tool for the 26 July truncation. *"once."* |
| `scripts/seed_focus_list.mjs` | *"One-time seed."* Also writes to the **Firestore** path `ggnz/focusList`; the focus list is on Supabase, so it points at nothing. |

**One catch:** `scripts/board_meeting_export.mjs` names the first file in comments at lines 11
and 59 — comments only, no import, so deleting won't break the export. Update those two lines in
the same commit so they don't point at a file that's gone.

| File | State | Notes |
|---|---|---|
| `scripts/backups/pre-migration-2026-07-12T07-31-25-896Z.json` | still there | A safety net from before the 12 July migration. Trevor's call, not a technical one. Ask. |

---

## Section 3 — git clutter, cosmetic

**Twenty local-only branches** as of 2026-07-29, all merged or abandoned, existing on this Mac
and nowhere else. The old brief listed twelve; eight more have accumulated since.

```
brief-b-poller-save-daily-log        fix/manual-split-persistence
brief-c-daily-log-supabase           fix/phase0-data-loss
brief-d-status-shipped               fix/supabase-auto-split-regen
brief-d-sunday-board-meeting-supabase fix/supabase-job-column-state-write
claude/focused-liskov-54aeed         fix/supabase-persistence-gaps
feature/split-piece-completion       jobsmaster-jobsstate-build
fix/bench-keywords-finishing         split/app-jsx-hooks
fix/conflict-bump-log                staging/brief-g-pdf-drop
fix/csv-manual-split-drift           staging/job-blocking
```

Harmless clutter. Low priority. `staging/brief-g-pdf-drop` merged as `f927248` and
`staging/job-blocking` merged before that, so **nothing in this list is live** — but confirm
each is merged before deleting, and delete in one reviewed batch with Trevor's "yp", not
piecemeal.

---

## Section 4 — the two pipeline scripts. Don't delete. Ask.

> **Updated 2026-07-29.** Build 1b merged (`f2ee449`), so only **Build 1c** still blocks anything
> here — and it only blocks `start_watcher.command`, whose parser 1c is porting.

| File | Why it's uncertain |
|---|---|
| `scripts/sheet_to_csv.command` (21 KB) | **Unblocked 2026-07-29 — Build 1b shipped at `f2ee449`.** The app is now master for Trevor's six hand-kept fields (Tag/Hours/Action/VB/BL/PJ) and the CSV import path can no longer write them, so the Sheet is no longer master for anything. Two things still need doing before this moves to `archive/`: it holds 21 KB of hand-tuned bench-keyword logic that CLAUDE.md protects, and `MANUAL_FIELDS` at line 32 was the only written record of which columns Trevor maintains by hand — that record now lives in the code and in Brief G, so check both before relying on it. **Also note the CSV upload button is still live in the UI** (`JobShelf.jsx:207`, `DailyLogPage.jsx:1064`, `Sidebar.jsx:250`) — retiring the script does not remove the button. Ask Trevor before moving it. |
| `scripts/start_watcher.command` (13 KB) | Must not be *run* — its parser is what truncated the jobs list on 26 July. But it is still the reference implementation, and **Brief G's Build 1c needs it**: the Jobs-by-Age parser being ported comes from here. Keep until 1c ships. |

**When both are genuinely finished, move them to `archive/` rather than deleting** — same
pattern as `archive/job-tracker/`.

`scripts/reauth_google.command` and `scripts/board_meeting_export.mjs` are live. Leave them.

### Related, and a real problem: `SCHEDULER-ARCHITECTURE.md` is stale on the import chain

Lines 15–21 still describe the old automated chain — PDF into `SCHEDULER_old/DropBox/` →
`start_watcher.command` → `sheet_to_csv.command` → **"pushes to Firebase"**. Two things wrong
with that: the app has been on Supabase for months, and since `f927248` the real import route is
Trevor dropping the PDF into the Scheduler in his browser. Line 21 also hands the reader a
`curl` that installs `sheet_to_csv.command` to a path outside the repo.

That file is named in CLAUDE.md as the thing to read when working on Scheduler code, so a wrong
description there gets acted on. **Fix it when Build 1b ships and the pipeline actually retires**
— not before, or it will just be wrong in the other direction.

---

## Do NOT touch

- `archive/job-tracker/` — deliberately archived, documented in CLAUDE.md.
- `docs/briefs/` — the 2026-07-28 cull is done. Don't re-do it.
- `api/partsbox.js` — live serverless proxy.
- `marketing/index.html` — the real GGNZ site page.
- `dist/`, `node_modules/` — build output, regenerate, not in git.
- `src/components/PartsDrawer.jsx` — despite the name, the **PartsBox inventory** drawer
  (`utils/partsbox.js`), fully live. Unrelated to the `parts_to_order` table.
- `cowork-context-summary.md` — written for Cowork, a separate tool. Drifted, but it's Trevor's
  call whether he still uses Cowork. Ask before binning.

---

## Suggested order

1. Section 1 — delete `SplitDrawer.jsx` after re-running the grep. Smallest, cleanest win.
2. Section 2 — the three finished scripts, plus the two comment lines in
   `board_meeting_export.mjs`. Ask about the backup JSON.
3. Section 3 — the branch batch, once Trevor confirms.
4. Section 4 — leave until Brief G's Builds 1b and 1c ship. Then archive both scripts and fix
   `SCHEDULER-ARCHITECTURE.md` in the same pass.

**Confirm scope before any bulk delete** — state exactly what will be removed and get a "yp"
first, per group. Commit in small groups with the reason in the message. `git add <specific
file>`, never `git add -A`. **Trevor never runs git** — Claude runs every command.
