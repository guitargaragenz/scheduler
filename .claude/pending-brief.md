---
doc_status: closed
---

# Scope lock — New sessions add 1h instead of dividing the bench's hours

Shipped at `dc78164`, 2026-09-27. Nothing live — next session starts with `/next`.

## Build
- `src/components/JobDrawer.jsx` `setSessionCount`: + adds a 1h session, existing hours untouched.
- − removes the last session and its hours.

## Out of scope
- Mobile job sheet (already adds benches at 1h, has no session +/−).
- Anything that saves or stores jobs — this only changes the editor before Save.
