# Re-fresh — repo housekeeping

**Date written:** 2026-07-27
**For:** a fresh session, Micky. Nothing here needs a dev server.
**Task:** verify and then clear out misplaced, dead and stale files. **Nothing has been
deleted or moved yet.** This brief is a list of candidates plus what's been proven about each.

---

## STOP — read this before touching anything

**A different session is mid-build in this same working tree.** Branch `staging/job-blocking`,
Brief E (job blocking), agent-team protocol in progress. A builder agent was running when this
brief was written and may still be.

**Do not touch, at all:**

- Anything under `src/`, including the dead-code candidate. It waits.
- `scripts/sheet_to_csv.command` — the builder edited it this session.
- `.claude/pending-brief.md`, `docs/superpowers/plans/`, `docs/superpowers/specs/`.
- The branch. Do not switch branches, do not stash, do not rebase.

**Check first:** run `git status` and `git log --oneline -5`. If the tree has uncommitted
changes under `src/` that aren't yours, the build is still live — **do only the sections marked
SAFE NOW below, and leave the rest.** Ask Trevor whether Brief E has merged before doing
anything else.

**Trevor never runs git himself.** Claude runs every git command, from this session. If he
starts typing git commands, stop him and take it back. (A hand-run git command deleted 35 app
files on 2026-06-14 — that's why the rule exists.)

**Confirm scope before any bulk delete.** State exactly what will be removed and get a "yp"
before removing it. This applies to every group below, individually.

---

## How the list was produced

A sweep on 2026-07-27: directory listing plus sizes, a whole-repo grep for each candidate's
filename, an import check across `src/`, `git worktree list`, and a read of each script's own
header comment. Everything marked CONFIRMED came from a command, not from memory.

**The verification was cut short.** Roughly a third of the reference-checking was done before
the session ended. Items marked **UNVERIFIED** below still need the check described against
each one. **Do not delete an UNVERIFIED item on the strength of this brief.** Prove it first.

---

## Section 1 — SAFE NOW, no dependency on Brief E

### 1a. Two files that aren't business data

| File | State |
|---|---|
| `admin/context/GGNZ Parts Shopping List.csv` | CONFIRMED |
| `admin/context/GGNZ Parts Shopping List.txt` | CONFIRMED |

Trevor confirmed 2026-07-27: **this is his personal pedalboard build list.** Nothing to do with
the shop. It was swept into `admin/context/` during the May department reorganisation (see
`admin/context/session-log.md` line 116 — it came off the Desktop).

**Also fix, and this is the important part:** `admin/claude.md` line 11 currently describes
these files as *"live capacitor/parts stock data with model cross-refs"*. **That description is
wrong**, and `admin/claude.md` loads automatically for every Admin session — it is why an
earlier session started reasoning about the file as shop inventory. Correct or delete that line
whether or not the files themselves move.

**Action:** ask Trevor where he wants the two files moved to (outside the repo), move them,
then fix `admin/claude.md`.

### 1b. Stale mockup

| File | State |
|---|---|
| `context/runway-mockup.html` (root `context/`, 30 KB) | CONFIRMED |

A mockup of the "Runway" page, which was **renamed to Projects on 14 July**. It is a picture of
a screen that no longer exists. The only reference to it anywhere is the historical note in
`admin/context/session-log.md` recording that it was moved there.

The root `context/` folder contains **nothing else**. Delete the folder with the file.

### 1c. Finder junk

`docs/.DS_Store`, `.claude/.DS_Store`, `.claude/worktrees/.DS_Store` — CONFIRMED.
`.DS_Store` is already in `.gitignore`, so these are untracked. Just delete them.

### 1d. 267 MB of dead worktrees

| Path | Size | State |
|---|---|---|
| `.claude/worktrees/agent-a678e9cbeaa000e99` | **264 MB** | CONFIRMED |
| `.claude/worktrees/reverent-feynman-176147` | 3.4 MB | CONFIRMED |

**Both are broken, not live.** Proof: `cat .claude/worktrees/agent-a678e9cbeaa000e99/.git`
returns a gitdir pointing at
`/Users/admin/Library/Mobile Documents/com~apple~CloudDocs/Desktop/GGNZ SCHEDULER PROJECT/.git/...`
— the **old iCloud path, which no longer exists** (the project moved to Desktop). `git worktree
list` still advertises that dead path.

This is what was inflating the test count: vitest was collecting a 21 July copy of
`joinJobs.test.js` out of the snapshot. `vite.config.js` now excludes `.claude/worktrees/**`
(commit `01a0404`) — **once the directories are gone, that exclude line can stay**; it costs
nothing and stops the problem recurring if another worktree is ever created.

**Before deleting, prove nothing is lost:**
```bash
git log --oneline -1 jobsmaster-jobsstate-build
```
That branch is what the snapshot held. It lives in the main repo's object store, so the
directory is just duplicate files. Confirm it resolves, then delete both directories, then:
```bash
git worktree prune
```
to clear the stale registration. Expect `+ jobsmaster-jobsstate-build` in `git branch` to
become a normal branch afterwards.

### 1e. `pipeline.log`

4 KB at the repo root, untracked, `*.log` is gitignored, regenerates on its own. Delete.

---

## Section 2 — SAFE NOW, but needs Trevor's call on destination

| File | State | Notes |
|---|---|---|
| `DESIGN.md` (repo root, 12 KB) | CONFIRMED | A **Matakana Superfoods** creatine product-page design capture dated 5 July. Not GGNZ content. Sitting at the top level of the Scheduler repo under a name that reads like the app's own design doc — the single most misleading file in the tree. |

**This is already a logged open item**, not a new discovery: `admin/context/parking-lot.md`
line 85 records it, noting Trevor said at the time it was being worked on and to relocate or
delete once finished. Ask him whether that work is done. Then move it to `marketing/` or delete
it — **and tick off the parking-lot item either way**, so it stops resurfacing.

---

## Section 3 — WAIT for Brief E to merge

### 3a. Dead component

| File | State |
|---|---|
| `src/components/SplitDrawer.jsx` | CONFIRMED unreferenced |

A whole-repo grep for `SplitDrawer` returns exactly one hit: its own `export default function`
line. Nothing imports it. Splitting runs through a different path now.

**But it is inside `src/`, which the Brief E builder is actively editing.** Do not delete it
until that build has merged to `main`. Re-run the grep to confirm before deleting — a build
touching split behaviour could in principle wire it back up.

### 3b. Scripts that have finished their job

All three say so in their own header comments — read them yourself to confirm.

| File | State | The header says |
|---|---|---|
| `scripts/backfill_daily_logs_to_supabase.mjs` | CONFIRMED | *"THROWAWAY one-shot backfill — Brief C… Safe to delete once the migration is signed off."* Brief C shipped. |
| `scripts/rebuild_csv.py` | CONFIRMED | Recovery tool for the 26 July truncation. *"once."* |
| `scripts/seed_focus_list.mjs` | CONFIRMED | *"One-time seed."* Also writes to the **Firestore** path `ggnz/focusList`; the focus list moved to Supabase, so it now points at nothing. Two briefs already call it stale — `handoff-board-meeting-and-pdf-drop.md` line 23 and `brief-d-board-meeting-full-record.md` line 144, which explicitly parked "deciding its fate" as a separate task. **This brief is that task.** |

**One catch on the first one:** `scripts/board_meeting_export.mjs` **references it in comments**
at lines 11 and 59 — *"the same way scripts/backfill_daily_logs_to_supabase.mjs does, using the
SAME…"*. Comments only, no import, so deleting won't break the export. But update those two
comment lines so they don't point at a file that's gone.

These are in `scripts/`, which the builder also touched this session. Wait for the merge.

| File | State | Notes |
|---|---|---|
| `scripts/backups/pre-migration-2026-07-12T07-31-25-896Z.json` | UNVERIFIED | A backup from before the 12 July migration. It's a safety net, so this is Trevor's call, not a technical one. Ask. |

---

## Section 4 — UNVERIFIED, do not delete without proving it

These two look retired but carry real risk, and the check was not finished.

| File | Why it's uncertain |
|---|---|
| `scripts/sheet_to_csv.command` (21 KB) | The Google Sheet pipeline. Everything says the Sheet is retired (Multitrack + Scheduler only). **But** `SCHEDULER-ARCHITECTURE.md` lines 15–21 still document it as a live part of the import chain, including a `curl` command that installs it to a path outside the repo, and the Brief E builder just added a warning that running it now would write stale `Admin` benches over the app's new nulls. It is also 21 KB of hand-tuned bench-keyword logic that CLAUDE.md explicitly protects. |
| `scripts/start_watcher.command` (13 KB) | The Multitrack PDF watcher. **The parser is still broken** — this is what truncated the jobs list on 26 July (`handoff-pdf-import-truncation-incident.md`). It must not be *run*. That is not the same as it being safe to *delete*: it's still the reference implementation for the PDF import rebuild that's on the backlog. |

**What to do:** don't delete either. Ask Trevor directly whether jobs still arrive by any route
that touches these, and whether the PDF import rebuild still needs `start_watcher.command` as a
reference. If both are genuinely finished, **move them to `archive/` rather than deleting** —
same as `archive/job-tracker/`, which is the established pattern here.

`scripts/reauth_google.command` and `scripts/board_meeting_export.mjs` are live. Leave them.

---

## Section 5 — git clutter, cosmetic

Twelve local-only branches, all merged or abandoned, existing on this Mac and nowhere else:

```
brief-b-poller-save-daily-log      fix/manual-split-persistence
brief-d-status-shipped             fix/phase0-data-loss
feature/split-piece-completion     fix/supabase-persistence-gaps
fix/bench-keywords-finishing       jobsmaster-jobsstate-build
fix/conflict-bump-log              split/app-jsx-hooks
worktree-agent-a678e9cbeaa000e99   staging/job-blocking  ← IN USE, do not touch
```

Harmless; they just clutter every branch listing. Low priority. **Leave
`staging/job-blocking` alone** — that's the live build.

---

## Do NOT touch

- `archive/job-tracker/` — deliberately archived, documented in CLAUDE.md.
- `docs/briefs/` — 19 briefs, 14 of them history, kept on purpose. The index says which are
  live. Ones dated 14 July and earlier describe Firebase and the old iCloud path; the README
  already warns about that. **Old briefs are not clutter here — they're the project's memory.**
- `api/partsbox.js` — live serverless proxy.
- `marketing/index.html` — the real GGNZ site page.
- `dist/` — build output, regenerates, not in git.
- `cowork-context-summary.md` — written for Cowork, a separate tool. Untouched since 16 July so
  it will have drifted, but it's Trevor's call whether he still uses Cowork. Ask before binning.
- `src/components/PartsDrawer.jsx` — despite the name, this is the **PartsBox inventory**
  drawer (`utils/partsbox.js`), fully live. Unrelated to the `parts_to_order` table.

---

## Separate item, not housekeeping — flag it, don't fix it

The Vercel preview for the job-blocking build is **four commits behind** this Mac. The branch is
`staging/job-blocking` locally but `staging-job-blocking` on GitHub — slash versus dash, so git
treats them as different branches, and no upstream is set. **The Brief E session owns this.**
Recorded here only so it isn't lost if that session ends first.

---

## Suggested order

1. `git status` — confirm whether the Brief E build is still live.
2. Section 1, in order, each with its own scope confirmation. Worktrees give the biggest win
   for the least risk — 264 MB, nothing lost.
3. Fix `admin/claude.md` line 11. This one matters more than the file moves.
4. Section 2 — ask about `DESIGN.md`, act, tick the parking-lot item.
5. Ask the Section 4 questions so the answers are on record even if nothing is deleted.
6. Sections 3 and 5 only after Brief E merges.

Commit in small groups with the reason in the message. `git add <specific file>`, never
`git add -A`.
