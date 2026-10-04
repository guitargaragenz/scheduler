---
doc_status: live
---

# Jobs Sheet greys out jobs ticked off on the Weekly Log

**Build:** a job with any `close:<Monday>` mark in the week marks shows greyed on the Jobs Sheet,
with a "ticked off" label beside its job number.

**Out of scope:** removing jobs, writing anything, the PDF import's hold-back rule, any other page.

**Binding rules:** display-only — no database write, no change to `jobs[]`. Two files:
`JobsSheetPage.jsx` (new `weekMarks` prop) and `App.jsx` (passes it). Not blast-radius.
Trevor approved the brief and "any ticked job" (not just this week).
