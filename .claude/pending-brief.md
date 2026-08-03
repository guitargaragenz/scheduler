doc_status: live

# Tell him parts have arrived — don't make him find it

**Raised by Trevor 2026-08-03.** Awaiting approval.

> Previous occupant — "Parts arrived — surface WP jobs Multitrack has already unstuck" —
> shipped 2026-08-03 at `337dd5b`, merged `8aae628`, and is closed. Record in
> `docs/briefs/README.md`.

## The problem

That build put a 🔧 PARTS ARRIVED? group in the Week View sidebar. Trevor's verdict on seeing
it live: **"it's too easy to miss."** He's right — it's a group inside a panel that is closed
by default, on a view he isn't in most of the day. A notice you have to go looking for isn't
a notice.

## Scope — two pieces

### 1. Chip on the Day View job panel — pure UI

The Day View panel (`JobShelf.jsx`) has pile chips — Waiting / Planning / Hold. Add a fourth,
`🔧 Parts Arrived (n)`, in the same row and the same style. Clicking it filters the list to
those jobs, exactly like the other chips. Hidden when the count is zero.

Membership is the existing `partsMayHaveArrived()` (`src/data/jobs.js`) — no new rule.

### 2. Banner after a PDF import — has state, so this is the careful half

A bar across the top of the app after an import that turns up qualifying jobs:

> 🔧 2 jobs may have parts now — #1679, #1705   ✕

- Visible on **every** screen, not just Week View or Board.
- Clicking a job number jumps to that job.
- **Stays until he clicks ✕.** No timer, no auto-dismiss. His words: "stay until I toggle it."
- Survives a page reload while showing.
- Reappears on a later import **only for job numbers he hasn't already dismissed.** Otherwise
  it is the same nag every drop and he stops reading it — which is the exact failure this
  build exists to fix.

Dismissed job numbers are the new stored state. Store them in `app_settings` alongside the
other per-device settings, seeded the same way; a job number leaves the dismissed list when it
stops qualifying, so a genuine re-block and re-arrive notifies again.

## Out of scope — do not build

- Clearing or editing the WP tag. Still his column, still cleared in the Jobs Sheet only.
- Any change to `PDF_IMPORT_FIELDS` or `writePdfImportBatch`. The import's inability to reach
  his hand-kept columns is a safety property, not an oversight.
- Notifying on anything other than WP.
- Sound, browser notifications, email. A bar on screen, nothing else.

## Verify before building — check, don't trust this file

| Fact | Where |
|---|---|
| `partsMayHaveArrived()` exists and is exported | `src/data/jobs.js` |
| The pile chips to copy | `src/components/JobShelf.jsx` |
| How settings are stored and seeded | `app_settings`, `src/utils/supabase.js` |
| The import path that fires the banner | `writePdfImportBatch`, `src/utils/supabase.js` |

## Done means

- Day View shows `🔧 Parts Arrived (n)`; clicking it filters; hidden at zero.
- Importing the 3/8 PDF over the 2/8 state raises the banner naming Gav Comber's job.
- The banner stays through a page reload and through moving between screens.
- ✕ dismisses it; the next import does **not** raise it again for the same job.
- A job that re-blocks and comes free again **does** notify again.
- Full test suite passes, with new tests on the dismissed-list rule.

Protocol: builder → verifier → browser test (real 2/8 → 3/8 import) → merge. No council —
same reasoning as last time: no blast-radius file is touched. The banner adds a settings row;
it does not change the `jobs[]` shape or the scheduling state.

**Real test data on the Mac:** `/Users/admin/Downloads/*JOBS DROP BOX/` —
`GGNZ JBA 2:8.pdf` + `Jobs 2:8.pdf`, then `GGNZ JBA 3:8.pdf` + `Jobs 3:8.pdf`.
