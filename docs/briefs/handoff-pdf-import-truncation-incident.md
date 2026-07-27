# Handoff — PDF import truncation incident, 2026-07-26

> # ⛔ CLOSED — HISTORY ONLY. DO NOT ACT ON ANYTHING BELOW THIS LINE.
>
> **Closed 2026-07-28 by Trevor.** Everything in this file describes a situation that no
> longer exists. It is kept only as a record of what happened. **Nothing below is a live
> instruction, a live warning, or a live to-do** — including the "Recommended order of
> work" and "Do not do next" sections, which are both dead.
>
> **Corrections Trevor made on 2026-07-28 — these override the body of this file:**
>
> | The file says | Actually |
> |---|---|
> | Multitrack changed its PDF column layout | **It didn't.** It was a one-off glitch, not a layout change and not a recurring hazard. |
> | Firestore holds `jobsMaster`; pipeline writes to Firestore | **Firestore is deleted.** Everything runs on Supabase. |
> | Truncation is unfixed; don't drop a PDF; don't restart the watcher | **Fixed and pushed.** Those warnings are retired. |
> | 10 Supabase jobs have a blank `mfr` | **Repaired.** Verified 2026-07-28: zero blanks across customer / mfr / model / status / desc / tag / hours / action / vb / bl. |
>
> **If you are a session looking for what to do next, this is the wrong file.** Go to
> [`.claude/pending-brief.md`](../../.claude/pending-brief.md) (Brief G) and the index at
> [README.md](README.md).
>
> *Written because a session on 2026-07-28 read past the one-line "RESOLVED" note into the
> detail below and started re-testing a problem that was already fixed. The banner is
> deliberately this loud so that can't happen twice.*

---

## What Trevor sees

- Dropped a 45-job PDF, got 12 jobs through.
- The 12 survivors happened to all be BL-marked (this is a coincidence — see below).
- Before that, an earlier import worked but left 2 recently-closed jobs still showing
  as open in the Scheduler. Trevor re-imported a couple more times to try to clear
  them; that is when the truncation happened.

---

## The pipeline, in Trevor's words

1. Trevor drops a Multitrack PDF into the DropBox folder inside the iCloud
   `SCHEDULER_old` folder.
2. The watcher converts the PDF to `jobs.csv`.
3. It pushes to the Google Sheet.
4. The Sheet's edited CSV comes back down to the `SCHEDULER_old` folder.

Trevor's stated goal: **stop doing this and use the in-app PDF drop** built during the
previous scheduler attempt. See [handoff-board-meeting-and-pdf-drop.md](handoff-board-meeting-and-pdf-drop.md)
section 2, which already scopes exactly that port.

---

## Root cause of the 45 → 12 truncation

The Multitrack PDF's table layout changed between the 2:13pm export and the 4:51pm one.

**2:13pm PDF (worked, 45 jobs) — page 1 header:**
`Customer | Manufacturer | Model | Status | Job`  (5 columns, Job last)

**4:51pm PDF (broke, 12 jobs) — page 1 header:**
`Customer | (blank) | Manufacturer | Model | Status | Job`  (6 columns, Job last)

An empty column got inserted after Customer on **page 1 only**. Pages 2 and 3 stayed
5 columns wide.

The parser (inline Python inside `start_watcher_fixed.command`) learns the job-number
column index once, from the first header row it sees, and stores it in `col_job`.
**Only page 1 of the PDF carries a header row** — pages 2 and 3 begin mid-table on a
`Fault:` row. So:

- Page 1 sets `col_job = 5`.
- Pages 2 and 3 have 5 columns, so `len(row) <= col_job` is true for every row.
- The guard `if len(row) <= col_job: continue` **silently skips every row on pages 2
  and 3.**
- Only page 1's 12 jobs survive.

The same blank column also sits where Mfr is read from (`row[1]`), which is why the
log shows manufacturers being blanked and customer names being sliced:

```
Updated #97:   mfr: 'DB Tech' → ''
Updated #321:  customer: 'Sheep as Chips Ltd' → 'Sheep', mfr: 'Trident' → 'as Chips Ltd'
Updated #1175: desc: 'In Dispute: price Appears dead...' → 'replace nut with bone nut'
```

**The BL thing is a red herring.** Page 1 holds the oldest jobs (output is sorted by
days waiting descending), and those are the ones Trevor has backlogged. Nothing in the
parser looks at BL.

Verified by parsing the archived PDFs directly, outside the watcher:
`SCHEDULER_old/DropBox/processed/Guitar Garage NZ Ltd_20260726_141418.pdf` (good) vs
`..._20260726_165146.pdf` (bad).

---

## Damage

| Store | State |
|---|---|
| Google Sheet | **33 rows deleted at 16:51**, with their FirstSeen/Days/Tag/Hours/Action/VB/BL/PJ |
| `jobs.csv` (SCHEDULER_old) | truncated to 12 rows |
| Firestore `jobsMaster` | 43 docs intact — delete pass self-aborted on its 30% sanity floor |
| Supabase `jobs` | **CHECKED 2026-07-26 — 57 rows, nothing deleted.** 33 rows last written 04:45Z, 12 rows last written 04:51Z (the bad import). Only damage is field corruption on those 12: 10 of them now have a blank `mfr`. |

The 33 job numbers deleted from the Sheet are listed in `pipeline.log` under
`Removing 33 completed job(s) from Sheet:` around line 40640.

---

## The bigger finding — the pipeline is half-migrated

**The app is on Supabase. The pipeline still writes to Firebase.**

- Every app hook reads `src/utils/supabase.js`. `src/hooks/useFirebase.js` is a legacy
  filename that imports Supabase internally — the name misleads.
- The live `SCHEDULER_old/sheet_to_csv.command` has **zero** mentions of Supabase and
  writes to `https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/...` (line 232).

So every PDF drop has been maintaining `jobs.csv` and the Google Sheet correctly, then
pushing the result into a database the app no longer reads.

**This is almost certainly why 2 closed jobs stayed visible as open** — the pipeline
had no way to clear them out of the store the app actually reads.

**Open question — now ANSWERED (2026-07-26).** The 📂 upload button was indeed the only
route. Confirmed:

- `SCHEDULER_old/*.command` — zero mentions of Supabase across all 7 scripts;
  `sheet_to_csv.command` mentions Firestore 5×. The pipeline never touches Supabase.
- `handleCsvUpload` in `src/hooks/useJobs.js:267` → `saveJobsMasterBatch`
  (= `upsertJobsBatch`, `src/utils/supabase.js:1100`) is the write path.
- The Supabase write times (04:45Z / 04:51Z) line up exactly with the two PDF drops,
  i.e. Trevor hit 📂 after each one.

**This also revises the diagnosis of the 2 stuck closed jobs.** It is not the
Firebase/Supabase split. `handleCsvUpload` is **upsert-only — it has no delete or
absent-job pass at all** (lines 280–294: existing jobs are merged, brand-new ones
appended, nothing is ever removed). A job that disappears from the CSV stays in
Supabase as open, forever. Fixing the pipeline's target database would not have fixed
this; the app-side import needs a "job is gone from the CSV" decision. That decision is
the same one `pendingRevenueReview` was built for but never surfaced in the UI.

Note: an earlier statement in the session that "Firestore was saved, that guard did its
job" was misleading and has been corrected — the guard fired correctly, but it was
protecting a store that no longer matters.

---

## Second problem — two watchers were running

Two instances of `start_watcher_fixed.command` were live (started 2:12PM and 4:54PM),
which is why every line in `pipeline.log` is doubled. Both write the same `jobs.csv`
and both run the Sheet delete pass.

This did **not** cause the truncation (the blank column is in the PDF file itself), but
two processes writing one file is a live hazard.

**Both were killed during this session** (PIDs 6236, 6241, 9189, 9194). They are not
running now. Trevor was told not to restart them or re-drop the PDF, because restoring
the Sheet while a watcher is live would let the Sheet delete pass wipe the restored
rows again within the 2-minute poll.

---

## Third problem — asymmetric safety guards

The Firestore delete pass has a 30% sanity floor and correctly refused to delete 31 of
43 docs. **The Google Sheet delete pass has no equivalent guard**, so it deleted 33 of
45 rows without complaint. That asymmetry is the reason this incident cost real data.

---

## Fourth problem — `sheet_to_csv.command` re-wipes a restored Sheet

Found the hard way: Trevor restored the Sheet, ran `sheet_to_csv.command`, and it
deleted the same 33 rows again (log line 41374 onward, 17:35 run —
`Sheet: 45 jobs loaded` … `Removing 33 completed job(s) from Sheet`). It also pushed 5
corrupted values into the Sheet first, via the PDF-fields write-back.

**The script's name is misleading in the same way `useFirebase.js` is.** It is not
Sheet → CSV. `jobs.csv` is authoritative for *which jobs exist*; the Sheet only supplies
the manual columns for jobs the CSV already lists, and **any Sheet row absent from the
CSV is assumed complete and deleted** (line 203 onward — no sanity floor, no prompt).

Consequences to remember:
- Restoring the Sheet while `jobs.csv` is truncated is a guaranteed re-wipe. Rebuild the
  CSV **first**, then the Sheet and CSV agree and the delete pass finds nothing.
- Nothing in `SCHEDULER_old/` can move rows Sheet → CSV. That direction had to be written
  from scratch to recover.
- `firstseen_col = col('FirstSeen')` is always `None` — the Sheet's column is named
  `Date`. FirstSeen has therefore always been blank in `jobs.csv`. Pre-existing, not part
  of this incident, but don't "fix" it blind: something downstream may rely on the blank.
- The Sheet also carries a `Key` column (an action-code legend, not job data). Any
  Sheet-reading code must map columns by header name, never by position.

This problem is the same root shape as step 5, so treat the sanity floor as covering both
delete passes, not just the Firestore one.

---

## ~~Recommended order of work~~ — DEAD LIST, 2026-07-28

> ⛔ **None of the following is outstanding work.** Items 1–4 were done in July 2026.
> Items 5–6 concern the DropBox/watcher/CSV pipeline, which Brief G retires outright —
> they are not worth fixing in something being deleted. Item 7 became Brief G and is
> approved and in build. **This list is here to show what was considered at the time.
> Do not pick anything up from it.**

1. ~~**Check Supabase state.**~~ **DONE 2026-07-26** — see Damage table above. No data
   lost; 10 blank `mfr` values to repair once the Sheet is restored.
2. ~~**Restore the Google Sheet.**~~ **DONE 2026-07-26** — but it took two attempts, see
   "Fourth problem" below. Sheet now holds 45 clean rows.
3. ~~**Rebuild `jobs.csv`** from the restored Sheet.~~ **DONE 2026-07-26** — 45 rows, all
   corruption gone (0 blank Mfr, #592/#321 customer+mfr split repaired, #1175 desc
   restored). Old truncated file kept as `jobs.csv.bak-truncated-14col`. Rebuilt with a
   one-off read-only script, `scratchpad/rebuild_csv.py` — **not in the repo, and not
   reusable as-is** if a future session needs it (see below).
   **Still outstanding:** Supabase's 10 blank `mfr` values are NOT yet fixed — that needs
   a 📂 upload of the rebuilt CSV in the app.
4. ~~**Confirm how the CSV reaches Supabase today.**~~ **DONE 2026-07-26** — 📂 button,
   upsert-only. See the answered open question above. Add to scope: what the import
   should do about jobs that vanish from the source.
5. **Add a sanity floor to the Sheet delete pass**, matching the Firestore one. This is
   the highest-value small fix — it would have prevented the whole incident.
6. **Fix the parser** to read column positions per page rather than once per document,
   and to tolerate blank columns. Note this only matters if the external pipeline
   survives step 7.
7. **Decide on the in-app PDF drop.** Trevor wants this. It removes the watcher, the
   iCloud folder, the duplicate-process hazard, and the Firebase/Supabase split in one
   move. Scope already written up in
   [handoff-board-meeting-and-pdf-drop.md](handoff-board-meeting-and-pdf-drop.md) §2 —
   port `lib/parseMultitrackPdf.ts` (pdfjs-dist) from the workshop-scheduler build into
   this app as a real import page.

Steps 5–7 touch `jobs[]` shape and identity, so per CLAUDE.md they need the full
agent-team protocol: brief in `.claude/pending-brief.md`, Trevor's "yp", council,
builder, independent verifier, browser test, merge.

---

## Files touched

No app code, no commits. Repo is unchanged — `main` is still `d0e3a2c`.

Outside the repo, on 2026-07-26:
- `SCHEDULER_old/jobs.csv` — rebuilt from the restored Sheet, 12 rows → 45 clean rows.
  Truncated original preserved as `jobs.csv.bak-truncated-14col` in the same folder.
- This handoff file — Supabase check, answered write-path question, Fourth problem.

Watchers confirmed not running throughout (`pgrep -fl start_watcher` empty).

## ~~Do not do next~~ — RETIRED WARNINGS, 2026-07-28

> ⛔ **These warnings no longer apply and must not be quoted at Trevor as if they do.**
> The truncation is fixed and pushed. Kept struck through only so the record is complete.

- ~~**Do not drop another Multitrack PDF** until the parser is fixed (step 6) or replaced
  (step 7). A PDF with the 4:51pm column layout re-truncates `jobs.csv` immediately, and
  the next `sheet_to_csv.command` run then re-wipes the Sheet from that truncated CSV.~~
- ~~**Do not restart the watcher** for the same reason — it runs the same delete pass on a
  2-minute poll, with no one watching.~~
- ~~`sheet_to_csv.command` is currently *safe* to run only because CSV and Sheet both hold
  the same 45 jobs. That safety evaporates the moment a bad PDF lands.~~

The last commit on `main` is `d0e3a2c` (day-view resize fix + on-card focus toggle),
pushed and unrelated to this incident.
