---
doc_status: live
---

# Session refresh — Ampeg SVT-6 PRO #1520, variac ramp

Continuing work in `/Users/admin/Desktop/1. PROJECTS/Business/AI FILES/GGNZ SCHEDULER PROJECT`.
Goal of this session: **run the variac ramp — the first time this amp sees mains since it was repaired.**

Customer Pete Johanson. Assembly 07-699-01, schematic 07S699 rev A. 230 V / 50 Hz.

## Where things stand

**The amp has never been powered since any part was replaced.** Everything logged since is
desk work or dead-amp bench work. There is no earlier test log to consult, because no test
was run. The ramp is the first live test.

**Parts replaced:** R21 / R51 / R63 / R64 (220 Ω 10 W wirewound, all four were out of spec —
these feed the ±16 V rail), D20 / D23 (1N5353B 16 V zeners), C24 / C25 (47 µF 35 V), C14
(47 µF 450 V, was missing entirely), and a full electrolytic recap of the supply and preamp
boards.

**Board-out checks all passed** — R50, D14–D17, F1, and both bias transistors Q2 / Q22
(checked in circuit, not with a leg lifted). Step 13's standoff work is done: the new feed
resistors sit ~2 mm off the board on silicone. **Nothing needs the board open.**

**Both bias pots are wound fully anticlockwise to minimum.** Anticlockwise is minimum on both
— traced off the print, the pot sits base-to-emitter on the bias transistor. Travel is badly
non-linear: dead for the first half, then up fast, vicious at the end.

**Decisions taken:**
- **Card steps 9–12 skipped** (bench-supply test of the relay chain). The ramp exercises the
  same chain in place. Accepted because stage B needs the amp open and the ramp needs it
  assembled, so each attempt costs a full reassembly.
- **Variac, not the light bulb limiter.** A 200 W bulb is far too small for a 1000 W amp with
  33,600 µF of filter caps — it gives half rails and reads like a dead amp. Iso → variac →
  amp, and nothing in that chain will limit this amp.
- **Step 24 closed.** Pete bought the amp second-hand and has no history to give.

## Next steps

1. ~~Confirm the eight non-polarised cap positions~~ — **done 2026-09-24, all eight are
   non-polarised.**
2. **Reassemble** — transformer leads landed, board mounted.
3. **Ramp per card steps 14–17.** Pause 30 s per step and log each reading into the log's
   Readings table.
4. **At the 120 V pause, read bias millivolts before touching either pot.** Near zero is
   expected. **30 mV+ with the pots hard anticlockwise is a leaky bias transistor — variac
   straight down.** Then take a quarter-turn feel reading and put it back.
5. **Relays should click in at 150–180 V.** Give it 1–3 seconds — C12 charging through D11
   delays it. **If nothing by 200 V, stop there.** Don't push to 230. That's the point where
   stage B becomes worth the strip-down.
6. Then bias: steps 18–21, 20 ±5 mVdc averaged across the ten resistors in a bank.

**Before handover:** fit the correct 8 A breaker (currently 7 A), and **fit a fresh 4 A fuse
at J31 before any speaker load goes on** — the one in there is blown and always was.

## Files to open (read these, don't re-derive)

- `job-cards/ampeg-svt6-pro.html` — the 24-step bench card. The procedure, hazards, abort
  criteria, reference tables. **Its tick-boxes save to browser storage only, not the file** —
  they will read as unticked.
- `job-cards/logs/ampeg-svt6-pro-1520.html` — the repair log. **This is the file of record**
  for what has been done, not the card's ticks. Newest entry at the bottom; readings table at
  the end.

## Standing rules for this job

- **Variac down first, trimmer second.** Both directions, no exceptions.
- **Millivolts across a source resistor, never volts.** Any reading in whole volts means
  variac straight down.
- **Never a grounded scope probe on either output leg** — the output is bridged, neither side
  sits at ground. DMMs floating are fine.
- **Abort immediately** on current climbing at constant voltage, or source-resistor millivolts
  drifting up on their own.
- **Date log entries by when the work happened**, not when it was written up. Say so in the
  entry where they differ.
