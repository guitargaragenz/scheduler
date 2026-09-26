---
doc_status: live
---

# Scheduler audit — 27 Sept 2026

Checked against the live code and live Supabase data on 27 Sept, not against older docs.
Nothing here has been changed yet. Each item needs your yes before anyone builds it.

## Works

- **Daily Log and Weekly Log.** Both are in daily use (286 day marks, 252 week marks) and are
  where the real work gets recorded now.
- **PDF import from Multitrack.** 83 imports since 28 July, the last one on 19 Sept. No duplicate
  job numbers and no orphaned pieces.
- **Completing jobs and revenue.** 46 completed jobs recorded, the latest last night.
- **Parts to Order.** Used through to 10 Sept, and 12 of 13 items are resolved.
- **Tests.** All 838 pass and the build is clean.

## Doesn't work / at risk

1. **The Daily Log will start "forgetting" marks in roughly January.** **This is the big one.**
   The app reads the whole day-marks table in one go, and Supabase stops at 1,000 rows. You're
   at 286 and adding about 170 a month. Once it passes 1,000, the app gets back a random 1,000,
   so recent crosses can quietly go missing. It would look exactly like the "not sticking" bug
   you just had. The Weekly Log has the same problem (252 rows). That one is already parked
   as a brief, but the Daily Log was never added to it. Fix: only load the weeks on screen.
2. **Two blank job rows on 1735** (`1735-ST`, `1735-WR`). 1735 was completed 10 Sept
   (invoice $433.80, revenue week 7 Sept). The two rows were made that same evening, when
   pieces on the Daily Log for 8 Sept were crossed off. Crossing off a piece whose id no
   longer matches a job looks like it creates a blank job row. Worth a proper look before
   deleting them.
3. **1175 Allen & Heath:** in dispute, changed to Hold in Multitrack. Clears on the next upload.
4. **1520's two Electronics pieces are still booked on the calendar for 31 July.** They're done,
   so no real harm. But that booking is left over, and it's the only one ever made.
5. **Known, already parked:** the job card shows the old description after a PDF import until
   you reload. And the importer can leave a job wrongly flagged as done so it disappears
   (this happened to 1740 once).

## Needs improvement

- **"Wiring" is still stored as a bench** on 4 rows (1737 and three pieces). It's a
  sub-bench, not a bench. Several older pages still list it beside the five real benches.
- **Page names collide.** Day View, Week view, Weekly Log and Daily Log sound alike, and it
  has already caused mix-ups. Worth renaming or merging.
- **The Sidebar's "On Hold" bucket is a catch-all** (parked brief, one step left).
- **Jobs Sheet:** Enter to move down a row, and hours snapping to the nearest 30 minutes
  (parked, small).
- **The app is one big download** (about 800 KB). It loads slowly on the phone over mobile
  data. Splitting out the PDF reader and the rarely-used pages would fix that. Low priority.

## Surplus — built but not used

Each of these is built, but its data table shows nobody has used it:

| Feature | Evidence | Suggest |
|---|---|---|
| **Old Daily Log inside Day View** (bullets, Close Day, Catch-Up interview, carry forward) | Last write 1 Sept; the new Daily Log replaced it | Remove |
| **Focus list** (star a job) | 0 rows, ever | Remove |
| **Ad-hoc tasks on the calendar** | 0 rows, ever | Remove |
| **Deferred items / pull back in** | 0 rows | Goes with the old log |
| **Booking time on the calendar Board + Google Calendar sync** | 1 booking ever (31 July), Google not signed in | Ask you: still wanted? This is the highest-risk code in the app |
| **Parking Lot page** | Nothing added since 7 Aug | Keep for now (Trevor, 27 Sept) |
| **Firebase** (old database) | Nothing uses it; the leftover file and package are still there | Remove |
| **GitHub Pages deploy script** | The app lives on Vercel now | Remove |

Removing the unused parts would cut the biggest page (Day View, about 1,400 lines) roughly in
half. It would also take out a lot of code that can still break things you do use.

## Suggested order

1. Day/Week marks row cap: load only the weeks on screen. **Before January.** Full protocol.
2. Delete the two 1735 junk rows, and settle 1175. By hand, five minutes.
3. Decide on the surplus list, then remove what you say goes, in one pass.
4. The rest, as and when.
