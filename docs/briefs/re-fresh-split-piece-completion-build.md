# Session refresh — Split-piece completion tracking (build phase)

Continuing work in `/Users/admin/Library/Mobile Documents/com~apple~CloudDocs/Desktop/GGNZ SCHEDULER PROJECT`. Goal of this session: design and build persistent tracking for split-job piece completion. Add `pieceDone` field to split children; when a piece finishes, mark it done (persists to Firestore); when last piece is done, parent auto-completes + toast. Three UI surfaces: Close Day modal (status line + checkboxes), Pomodoro drawer (Mark piece done button), calendar card (checkbox on piece). Invoice only when all pieces are done.

---

## Where things stand

**Design phase complete, ready to build (2026-07-14):**
- ✅ Brief written and approved ("yp" from Trevor)
- ✅ Council review: two independent agents evaluated three design questions, both unanimously agreed
  - Q1: NEW FIELD `pieceDone: boolean` (not derived from invoicing state)
  - Q2: Full job invoicing only (all pieces must be done before any invoice)
  - Q3: Yes, mark done before siblings scheduled (pieces finish independently)
- ✅ Design stress-tested against manual-split edge cases (re-splitting, adding benches to already-split jobs, manual vs auto-splits) — all pass
- ✅ Constraints locked: (A) auto-complete + toast when last piece done, (B) pieces stay visible when done (greyed out, not deleted), (C) invoice blocks until all pieces done

**Current state:**
- HEAD: `c5cff63` (2026-07-14, "Delete leftover jobsState doc when a split-piece orphan is resolved")
- No uncommitted changes to tracked files (`.claude/launch.json` and `.claude/pending-brief.md` are modified, but those are meta-files)
- Working directory clean, ready to start staging branch

**What the build phase will do:**
1. Tag current HEAD as `pre-split-piece-completion-stable`
2. Create staging branch `feature/split-piece-completion`
3. Add `pieceDone: boolean` field to split children (Firestore + React state)
4. Implement three UI surfaces: Close Day modal status line + checkboxes, Pomodoro drawer "Mark piece done" button, calendar card checkbox on pieces
5. Add invoice gate (check `all(pieces.pieceDone)` before allowing invoice)
6. Add auto-complete + toast when last piece marked done
7. Independent verifier runs blast-radius checklist after each commit
8. Browser test on Vercel preview
9. Merge to main with Trevor's final approval

---

## Next steps

1. **Tag current HEAD** before any build commits:
   ```bash
   git tag pre-split-piece-completion-stable c5cff63
   git push origin pre-split-piece-completion-stable
   ```

2. **Create staging branch:**
   ```bash
   git checkout -b feature/split-piece-completion
   ```

3. **Build three UI surfaces in order** (scope-locked per brief):
   - Close Day modal: add status line showing "Setup ✓ · Wiring ○ · Electronics ○" + inline checkboxes
   - Pomodoro drawer: add "Mark piece done" button for scheduled split pieces
   - Calendar card: add checkbox on split piece itself

4. **Add invoice gate:** block invoice buttons until `all(pieces.pieceDone)`

5. **Add auto-complete + toast:** when last piece flips to `pieceDone: true`, parent job auto-completes + toast pops

6. **Independent verifier:** after each commit that touches blast-radius files, run the checklist in `.claude/pending-brief.md`

7. **Browser test:** click through Vercel preview (Schedule a split job, mark pieces done, confirm invoice gate blocks until all done, confirm toast pops)

8. **Merge gate:** once verified, bring back to Trevor for final "yp"

---

## Files to open (read these, don't re-derive)

- `.claude/pending-brief.md` — finalized brief, scope, checklist, rollback command
- `src/components/CloseDayModal.jsx` — current Close Day implementation (lines 164–302 show action-row UI); where split-piece status line and checkboxes will be added
- `src/components/PomoDrawer.jsx` — Pomodoro drawer (or mobile equivalent `MobileJobSheet.jsx`); where "Mark piece done" button will be added
- `src/components/CalendarGrid.jsx` or `JobCard.jsx` — calendar card rendering; where checkbox on split pieces will be added
- `src/hooks/useJobs.js` — `handleSaveDrawer` shows atomic `writeBatch()` pattern for split-set changes; reference for state updates; also where invoice gate logic will go
- `src/data/jobs.js` — job/split data structures (`createSubtasks`, `getJobSplits`); verify `pieceDone` field placement
- `CLAUDE.md` — architecture notes, data structure reference (loads automatically)
- `admin/context/parking-lot.md` — context on related features (Edit a split from within the calendar, Pomodoro timer broken)

---

## Avoid repeating

- **Don't auto-delete completed split pieces from the UI** — previous attempts had pieces vanish once marked done, which broke findability. Pieces must stay visible, greyed out or marked complete, not removed.
- **Don't silently auto-complete the parent job** — Trevor needs to know it happened via a toast popup, so invoicing isn't accidentally missed (constraint A).
- **Don't track "piece done" state only locally in Close Day** — it must persist to Firestore so it survives across sessions and so calendar/Pomodoro surfaces can read it.
- **Don't skip the independent verifier checklist** — after each blast-radius commit, verifier must run all 9 checks. This is a blast-radius feature (touches `jobs[]` shape), so no self-certification.

---

## Skills to run

- `/run` — after building, to spin up dev server and test the three UI surfaces live
- `/verify` — before browser test, to confirm the feature works end-to-end
- **Do NOT run** `/code-review` or re-run council — those are post-build steps; hold for verification

