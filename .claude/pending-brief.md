---
doc_status: live
---
# Brief — review prompt in the Pomodoro invoice box

Replaces the parked card-tag brief (bfc2792; background in docs/briefs/review-tag-on-cards.md,
code on branch `staging/review-tag` at 1c0267b, PR 110 closed unmerged).

Trevor, 2026-10-17: "now I want a prompt from invoice page instead of across all cards" ...
"I meant last stage of closing job. Which appears to be pomodoro page".

## Build

1. Branch `staging/review-prompt` from **main**. Copy (don't merge) from `staging/review-tag` with
   `git checkout staging/review-tag -- <path>` (verified in the card-tag round):
   `scripts/build-review-lookup.py`, `src/data/reviewNames.js`, `src/data/reviewMatch.js`,
   `src/data/reviewMatch.test.js`.
2. `src/components/PomoDrawer.jsx`, inside the "Job done? Invoice amount (ex-GST)" block
   (~line 346, top-level jobs only), one line under the $ input + Done button:
   - `hasReviewed(job.customer, REVIEW_NAMES)` is `'no'` →
     `💬 No Google review found for <customer> — ask them?` (amber, ~13px, wraps,
     tooltip "Review list updated <REVIEWS_UPDATED>").
   - `'yes'` → `⭐ <customer> has probably left a review` (dim green).
   - `'unknown'` → nothing.
   - useMemo on `job.customer`. No new props. Matches the drawer's inline styling.

## Not in scope

- Job cards (no tag), CloseDayModal, CatchUpInterview, RevenueReviewBanner.
- `handleMarkDone`, toasts, `jobs[]`, Supabase, `scheduledSlots`, `calendarSlot`,
  `useGoogleCalendar.js`, `useSupabase.js`, `utils/supabase.js`. Nothing stored.

## Rules

- Never commit the Takeout or review text into `src/`. Names only.
- Trevor confirmed (council question) he closes jobs in the Pomodoro drawer, so no other paths.
- Soft wording (names don't always match; list is stale until the next Takeout).

## Verifier checklist

1. The four brought-over files match `staging/review-tag` byte for byte.
2. New `src/components/PomoDrawer.test.jsx` (none exists), idle phase: 'no' customer shows the 💬 line with the name; 'yes' shows ⭐; blank, single-word ("Dave")
   or business name shows nothing; split piece (has parentId) shows no invoice box at all.
3. Diff touches only those four files, PomoDrawer.jsx and its test.
4. Full test suite passes.
