---
doc_status: live
---
# Brief — review tag on job cards

Previous occupant (Finishing bench record, closed) is in git at 408533b.

Trevor, 2026-10-17: "the scheduler is an idea I hadn't thought of and definitely keeping it up to
date is important too". After council he chose: tag on every card, names are "John Smith" order,
reviewer names in the app are fine (already public).

## Build

1. `scripts/build-review-lookup.py` also writes `src/data/reviewNames.js`: frozen array of
   reviewer display names only (no text, no replies), plus `REVIEWS_UPDATED` (newest review date).
2. New pure module `src/data/reviewMatch.js`, `hasReviewed(customer, names)` → `'yes'|'no'|'unknown'`:
   - Fold case and accents, strip punctuation and anything in brackets, on BOTH sides.
   - Match = both names have 2+ words AND the same words (order ignored). "John Smith Jr" ≠ "John Smith".
   - `'unknown'` for blank customer, single-word customer, or business names (Ltd, Limited, Music,
     Studio(s), Church, School, Band, Trust, Co).
3. `src/components/JobCard.jsx`, on the customer line (~line 189, non-compact only): when
   `'no'`, append a small dim `💬` with tooltip "No Google review found under this name
   (list updated <REVIEWS_UPDATED>)". `'yes'` → small `⭐` with tooltip "Probably reviewed".
   `'unknown'` → nothing. Compute once per card (useMemo), no props added.

## Not in scope

- `useJobs.js` / `handleMarkDone`, toasts, `jobs[]` shape, Supabase, `scheduledSlots`,
  `calendarSlot`, `useGoogleCalendar.js`, `useSupabase.js`, `utils/supabase.js`. Nothing stored.
- MobileJobSheet, drawer, compact cards. Live Google feed (waits on API approval).

## Rules

- Never commit the Takeout or any review text into `src/`.
- Wording is soft (names don't match perfectly; list goes stale between Takeouts).

## Background (council rulings, verifier checklist)

[docs/briefs/review-tag-on-cards.md](../docs/briefs/review-tag-on-cards.md) — background only; don't open it to start work. The verifier uses its checklist.
