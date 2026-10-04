---
doc_status: live
---

# Jobs Sheet: fix huge row height on a phone

**Build:** on a phone the Desc column gets a 240px width (it collapsed to 0, stacking every word),
and the ticked-off marker becomes a small ✓ instead of the words "ticked off".

**Out of scope:** desktop layout, editing on mobile, any write.

**Binding rules:** display only. One file: `JobsSheetPage.jsx`. Not blast-radius.
Trevor reported it 2026-10-04.
