doc_status: live

# Parts arrived — surface WP jobs Multitrack has already unstuck

**Raised by Trevor 2026-08-03.** Awaiting his approval. Scope-locked below.

> Previous occupant of this file — "The board follows the printout (departed jobs)" — shipped
> 2026-08-02 via PR #8 (`335ad8a`, follow-up `7a2e5ea`) and is closed. Its record is in
> `docs/briefs/README.md` and in git history.

## The problem

> "I could miss jobs that come free when scheduling."

A job tagged **WP** (Waiting Parts) keeps that tag until Trevor deletes it by hand. Multitrack
flips the job's status back to Active on the next PDF drop, but the tag stays. So a job that is
genuinely ready to book still reads as parts-blocked while he's picking the week's work, and it
just doesn't get chosen. The failure is silent.

## Why the app can't clear it for him

The PDF import writes six fields only — `PDF_IMPORT_FIELDS`, `src/utils/supabase.js:203`:
job, customer, mfr, model, status, desc. Action (WP/INC/CI/FB…), Tag, Hours, VB and BL are his
hand-kept columns, and `writePdfImportBatch`'s allow-list makes the import *incapable* of
reaching them, not merely careful about it. That is what stops one bad drop blanking every
hand-set field in the workshop. **Do not weaken it.**

So this build surfaces the contradiction. It never writes.

## Scope — all of it, and nothing else

One new group in the Sidebar, following the existing BACKLOG / ✅ READY TO START / 📞 WAITING
pattern (`src/components/Sidebar.jsx:261–300`): a labelled header with a count, hidden entirely
when empty, cards rendered by the same `renderJob`.

- **Membership:** `action === 'WP'` **and** the job is not in a blocked pile — i.e.
  `blockedPile(job) === null` (`src/data/jobs.js:105`). Multitrack no longer says it's waiting.
- **These jobs must be REMOVED from the main unscheduled list**, not shown twice. WP does not
  change `schedulable` (`src/data/jobsSheet.js:41–46`), so they are in `displayed` today.
- Cards stay draggable and schedulable exactly as now. This is a relabel, not a lock.
- Hidden in focus mode, like every other group.
- Suggested header: `🔧 PARTS ARRIVED?` — the question mark is the point. The app is saying
  "Multitrack says this isn't waiting any more", not "your parts are here".

## Out of scope — do not build

- Clearing or editing the WP tag. Not automatically, not with a button. He clears it in the
  Sheet, and the group empties itself.
- Any change to the import, `PDF_IMPORT_FIELDS`, or `writePdfImportBatch`.
- Chips on job cards. He chose a list; the chip would vanish on the same edit anyway.
- FB, INC, CI or any other action code. WP only.

## Verify before building — true as of 2026-08-03, check anyway

| Fact | Where |
|---|---|
| `PDF_IMPORT_FIELDS` is the six-field allow-list | `src/utils/supabase.js:203` |
| `'WP'` is in `ACTION_OPTIONS` | `src/data/jobsSheet.js:51` |
| WP is a label only, does not change `schedulable` | `src/data/jobsSheet.js:41–46` |
| `blockedPile()` returns null for workable jobs | `src/data/jobs.js:105` |
| The group pattern to copy | `src/components/Sidebar.jsx:261–300` |

## Done means

- A WP job whose status is Active appears in the new group and **not** in the main list.
- A WP job still `Waiting`/`On Hold`/`In Transit` stays where it is today — not in the group.
- A job with no WP tag is unaffected.
- Clearing WP in the Jobs Sheet moves the job back to the main list, no reload.
- Group is invisible when nothing qualifies.
- Full test suite passes. New tests cover the membership rule and the not-shown-twice rule.

Protocol: builder → verifier → browser test → merge. **Council dropped on Trevor's call,
2026-08-03** ("no council I thought this was a quick fix?") — and he was right: this reads
`jobs[]` but changes no shape and touches no blast-radius file (`scheduledSlots`,
`calendarSlot`, `useGoogleCalendar.js`, `useSupabase.js`/`utils/supabase.js`, the `jobs[]`
shape). An earlier draft of this line called for the full protocol; that overcalled it.
