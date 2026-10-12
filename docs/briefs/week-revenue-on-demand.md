---
doc_status: closed
---
# Week revenue on demand — council record

Scope lock: `.claude/pending-brief.md`.

## Council changes (2026-10-12)

Both NOT YET. Fixed: crash from passing the line-608 const; safe default arg; stable effect key;
"blank" → "$0 until it fills"; added items 7–10. Weekly summary over-count worry checked: it uses
`weekRevenue` (already filtered), so safe.

Shipped at `d74f5ec` (PR #98). 941 tests pass. Builder call: empty viewed key = this week only. Items 9–10 passed on Trevor's preview click-through.
