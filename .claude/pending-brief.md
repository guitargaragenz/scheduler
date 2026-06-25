# GGNZ Pending Brief

_This file is written by the Mac session when a fix brief is ready for Trevor's approval._
_Open claude.ai/code on iPhone → select guitargaragenz/scheduler → read this file → reply "yp" to proceed or "no" to cancel._

---

## Status: AWAITING APPROVAL

**Root cause:** `withSplitsExpanded()` in `useFirebase.js` skips all stored sub-tasks with a `parentId` on load and regenerates them from `createSubtasks()` — auto-splits recover fine (same IDs) but manual drawer splits (IDs like `1628_Luthier_0`, session notes like "Make cleats") can't be regenerated and are lost on hard refresh even though Firebase has them.

**Fix scope:** `src/hooks/useFirebase.js` only — before processing parents, collect stored sub-tasks from `rawJobs` into a lookup map; for parent jobs with `isSplit: true` use the stored sub-tasks instead of calling `createSubtasks()`; auto-splits (no `isSplit`) keep existing behaviour.

**Rollback:** `git reset --hard ab5c83f && git push origin main --force`

Reply "yp" to proceed or "no" to cancel.
Brief expires 4 hours from: 2026-06-25T14:00 NZST
