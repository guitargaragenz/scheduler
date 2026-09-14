---
doc_status: closed
---

# Record (closed) — `#tag` search on the Jobs Sheet

Shipped 2026-09-14 on PR #68, build `214a9d5`. 810/810 tests, 41 files; 8 new.
Browser-tested live by Trevor: "#M and #WP both work".

Approved by Trevor ("yp"-equivalent: "thats brilliant", 2026-09-14). **Council
skipped on his call, agreed in the session** — one pure function under unit
test, not blast-radius, and the search box it changes was already live and
proven the same day. Verifier skipped for the same reason; the browser test
was not.

## What shipped
- A word starting with `#` in the search box is a code, not text. `#EZ` means
  the row's Tag **is** EZ.
- `#` matches Tag **or** Action. WP is an Action and EZ is a Tag, but nobody
  typing `#WP` is thinking about which list it lives in, and no code appears
  in both, so there is nothing to disambiguate.
- Exact: `#M` never matches the M in "Marshall", and `#RS` never drags in
  `RS-C`.
- Mixes with plain words — `fender #ez` is the Fenders on EZ. Every word still
  has to match.
- A bare `#`, or a code that isn't real, matches nothing. It never falls back
  to a text search.
- Reads the draft Tag and Action, same as the rest of the search.
- Placeholder reads "Search jobs or #tag"; the Key panel carries a line saying
  what `#` does.

## Why, and why not a dropdown
Trevor asked for a tag dropdown after seeing plain search find EZ, then
replaced his own idea with this: "instead of DD we just use hashtag for tag
search way easier". He was right, and for a reason the dropdown brief had
missed — the tags are `EZ`, `M`, `T`, `H`. Three of the four are single
letters, so plain text search cannot find them at all: "M" matches every
Marshall and half the descriptions. The dropdown existed to work around that.
`#M` fixes it with nothing new on screen.

## Where it lives
`matchesCode()` and the `#` branch of `matchesSearch()` in
`src/data/jobsSheet.js`; placeholder and `SEARCH_HINT` in
`src/components/JobsSheetPage.jsx`. Nothing that decides what saves was
touched — `rows`, `dirty`, `commit` and `discard` are unchanged.
