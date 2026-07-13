# Pending Brief — Split-Piece Completion Tracking

**Status:** APPROVED by Trevor (brief + council + design all complete, ready to build)
**Session:** 2026-07-14 (design phase)
**Next session:** Build phase

---

## Brief (Approved)

**Root cause:** When a job is split (Setup + Wiring + Electronics), Trevor has no persistent way to track which pieces he's completed, except in his personal bullet journal. Close Day runs at midnight; he works past it; the session rolls over and loses the tracking. Forces manual tracking outside the app.

**Goal:** Add persistent piece-completion state with three UI surfaces (Close Day modal, Pomodoro drawer, calendar card). When the last piece is marked done, parent auto-completes + toast surfaces it so invoicing isn't silently missed.

**Hard constraints (non-negotiable):**
- **(A) Auto-complete visibility** — when last piece is done, parent auto-completes + toast popup
- **(B) Pieces stay visible** — mark as done (grey out), never hide/delete
- **(C) Full job invoicing only** — all pieces must be done before any invoicing

---

## Design (Council Approved 100%)

**Three design decisions (both council members agreed):**

| Question | Decision | Reasoning |
|----------|----------|-----------|
| **Q1: Where does "piece done" live?** | NEW FIELD `pieceDone: boolean` on split children | Trevor's workflow is "mark done in journal, then invoice" (two separate acts). Constraint (A) requires auto-complete to fire when marked done, not when invoiced. This only works if done-ness lives on the piece, not derived from invoice records. Separates workflow state from accounting state. |
| **Q2: Can invoice partial pieces?** | Full job invoicing only (all pieces must be done) | Constraint (C) is explicit. Blocks partial invoicing, keeps accounting clean (one invoice per parent). Invoice gate checks `all(pieces.map(p => p.pieceDone))`. |
| **Q3: Can mark done before scheduled?** | Yes, mark done before siblings scheduled | Pieces finish independently. Setup can be done Monday, Wiring scheduled Thursday. Matches Trevor's actual workflow (bullet journal marks as they finish, independent of scheduling). |

**New field:**
```javascript
// On all split children (both auto-split and manually-split):
pieceDone: boolean  // default false
```

**Auto-complete flow:**
1. As Trevor marks pieces done (Pomodoro drawer / Close Day modal / calendar card), `pieceDone: true` persists to Firestore
2. When last piece flips to `pieceDone: true`, parent job auto-completes
3. Toast pops: "Job #XXXX (Setup + Wiring + Electronics) complete — ready to invoice"
4. Pieces stay visible, greyed out after marked done (never deleted)

**Invoicing gate:**
- Close Day modal + Pomodoro drawer invoice buttons check `all(pieces.pieceDone)` before allowing invoice
- If Setup is done but Wiring isn't → button blocked with reason text
- Works identically for auto-splits and manual splits

**Three UI surfaces (same state, different affordances):**
1. **Close Day modal:** "Setup ✓ · Wiring ○ · Electronics ○" status line + inline checkbox to mark a piece done
2. **Pomodoro drawer:** "Mark piece done" button when a scheduled split piece finishes
3. **Calendar card:** Checkbox on split piece itself (fastest, right where work is)

**Edge cases considered:**
- ✅ Re-splitting a job that's already been split: re-split bug was fixed in last build, design works with current behavior
- ✅ Adding benches to an already-scheduled job ("+ Add bench from calendar"): new bench starts with `pieceDone: false`, marking works same as any split piece
- ✅ Manual vs auto-splits: both use `parentId` relationship, `pieceDone` works identically

---

## Blast Radius

Touches:
- `jobs[]` shape (add `pieceDone` field to split children)
- Close Day modal logic (add status line + checkbox)
- Pomodoro drawer state (add "Mark piece done" button)
- Calendar card rendering (add checkbox on split pieces)
- Invoice validation (gate on all pieces done)

**Blast-radius files per [[project_agent_team]]:**
- `jobs[]` shape → **MANDATORY council** ✅ Done

---

## Next Session (Build)

**Scope locked to:**
- Add `pieceDone: boolean` field to split children in Firestore schema + React state
- Close Day modal: add status line + inline checkboxes
- Pomodoro drawer: add "Mark piece done" button
- Calendar card: add checkbox on split pieces
- Invoice gate: check `all(pieces.pieceDone)` before allowing invoice
- Auto-complete + toast when last piece is done

**Do NOT include in this build:**
- The "+ Add bench from calendar" feature (parking-lot item, separate)
- Pomodoro timer fixes (separate parking-lot bug)
- Any other cosmetic/UX polish beyond the core three surfaces

**Tag before first commit:**
```bash
git tag pre-split-piece-completion-stable c5cff63
git push origin pre-split-piece-completion-stable
```

**Rollback command (if needed):**
```bash
git reset --hard pre-split-piece-completion-stable && git push origin main --force
```

**Independent Verifier Checklist (run after each blast-radius commit):**
- [ ] Fixed feature works as described (pieces mark done, auto-complete fires, toast appears)
- [ ] Calendar slot integrity — create/edit/delete a slot, verify persists after hard refresh
- [ ] Firebase job state — hard refresh, confirm jobs load correctly with `pieceDone` field
- [ ] Split/sub-task rendering — pieces show, checkboxes render, no ghost buttons
- [ ] Scheduled flag persistence — scheduled jobs stay scheduled after hard refresh
- [ ] Invoice gate — button blocked when pieces incomplete, allowed when all done
- [ ] Manual splits — verify "Mark piece done" works on manually-split jobs, not just auto-splits
- [ ] Close Day modal — status line shows correctly, checkboxes save state
- [ ] Browser: Close Day modal, Pomodoro drawer (both paths), calendar card (at least one split piece)

---

## Session Notes

- Trevor approved brief + council + design on 2026-07-14
- Council unanimously recommended NEW FIELD + FULL JOB INVOICING + YES ON SEQUENCING
- Design stress-tested against manual-split edge cases; all pass
- Ready to proceed to build
