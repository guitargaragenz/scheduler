---
doc_status: closed
---
# Record (shipped) — DG/WP labels on the Daily and Weekly Logs
Shipped PR #107; tests 963 → 970. Trevor cut it to DG (green) + WP (red) only after seeing it.
Render points were ~1341/1364 in DailyLogPanel, not ~1403. Follow-up (Trevor yes, 2026-10-13):
lit DG card chip turns green to match, `JobCard.jsx` ActionChips only.

Trevor, 2026-10-13: "lets discuss ways that we can transfer this to weekly and daily bc I can't
see these tags there" — after card action chips shipped (PR #105; that lock closed in git at `8d7da04`).
He chose show-only (no tapping) from a mockup.

## Build

- A small read-only label beside the job name on Daily Log (`DailyLogPanel.jsx`) and Weekly Log
  (`BenchWeekPage.jsx`) rows — ONLY for DG (green, "good to go") and WP (red, "held up").
  Every other action and blank → no label. (Trevor 2026-10-13 after first build.)
- Label is its own span OUTSIDE the ellipsis-clipped name, small and fixed-size, never clipped.
  Never put it inside `rowName()` / `row.name` / `row.label` — those feed aria-labels, tooltips,
  the Remove confirm and stored Daily Log labels.
- Find the job by id, never by parsing label text.
  Weekly: `row.job.action` (name at ~1345 split via `SplitName`, ~1352 plain).
  Daily: `displayJobById.get(id)` (~690, holds live + departed). Label on the split group header
  (~1364) and plain `JobLine` (~564, new optional `action` prop from ~1403); none on piece lines (~1379).
- Split jobs show the parent's action. Departed jobs carry `action` already
  (`useSupabase.js:159`, `:205`) — they get labels, no new read.

## Not in scope

- No tapping: display only. Setting/clearing stays on cards and the sheet.
- No change to log marks (· × >), carry-forward, rows, ordering or grouping.
- No new Supabase reads or writes. `useSupabase.js`, `utils/supabase.js`, `scheduledSlots`,
  `calendarSlot`, jobs[] shape untouched.
- Typed admin rows (no job) get no label.

## Verifier checklist

1. A job with DG shows a DG label on the Daily Log and the Weekly Log.
2. DG shows green, WP shows red; GTS, INC, CI, RS, RS-C, FB and blank show none.
3. Setting/clearing a chip on a card updates both logs' labels without a reload.
4. Split jobs: label on the parent/header, not on piece lines.
5. A long job name on the desktop Weekly Log and on the phone: label still fully visible.
6. Marks, carry-forward, row order, aria-labels and Remove confirm text unchanged.
7. Typed admin rows show no label; departed jobs do.
8. Full suite passes, plus new tests: label shown, none when blank, split uses parent.

## Council changes (2026-10-13)

R1 go, R2 not-yet on layout only. Added: label outside clipped name, find job by id, render
points, departed jobs answered yes, long-name check (item 5). No Trevor decision needed.
