# Re-fresh: SVT-6 Pro — bias pots do nothing (job #1520)

Start a fresh session, read this, then carry on. Trevor is at the bench, customer waiting.

## Where we are
- Mains fault fixed: open circuit was the switch wired wrong + dirty switch contacts/pins (now L 0.2 Ω, N 0.5 Ω on the switch). Primary windings 0.67 Ω and 0.62 Ω, good.
- Variac ramp is clean. Mains is 240 V here.
  - 120 V: mains 0.1 A, A 0.012 A, B ~0, rails +35.1 / −34.3
  - 200 V: mains 0.25 A, A 0.020 A, B ~0, rails +58 / −57
  - 230 V: mains 0.25 A, A 0.023 A, B 0.374 mV, rails +66 / −65
- Relays click together at ~160 V. Relay supply (D13 / D42 cathodes) 39 V at 200 V, 45 V at 230 V. Spec says +60 V. Low but relays hold; look at later.

## The fault now
- **Turning AP1 or AP2 fully clockwise does nothing**: Meter A and Meter B don't move. Both pots are single-turn.
- Pots were left at max: **Trevor told to put both back fully anticlockwise before any power-up.**
- The pots sweep in-circuit (wiper reads 7.5 → 6 kΩ), so they work.
- **Not yet proved that anticlockwise = minimum on this amp** (card says so). Once bias responds, confirm a small clockwise turn raises Meter A before setting it.
- +100 V supply OK: D32 cathode 90 V (D32 is in the +100 V supply, schematic sheet 2).
- Both halves dead the same way → look for something shared.

## Next step (waiting on Trevor's reading)
- Measure the **−100 V rail** at C17 or the −100 V end of R19 / R54, to chassis. Expect about −91 V.
  - Missing or low → D18, D19, C16, C17 (the −100 V supply, sheet 2). Amp was fully recapped; Trevor confirmed C16/C17 go in to match the board's + marking.
  - OK → look at the bias circuits: Q2 (+ half, with AP1) and Q22 (− half, with AP2), plus current sources Q3/Q4 and Q19/Q18.

## Bias target once it works
- Meter A in series at J37. Target = baseline at 240 V with pots at minimum (~23 mA) + 210 mA, so about 233 mA.
- Meter B across R141: about 20 mV. Then a 15–20 min warm-up watching A and B. Heatsinks can't be reached (sandwiched between boards).
- Meter A is a UNI-T UT61E: about 15 min auto-off, press RS232 to stop it.

## Paperwork to fix afterwards (not done yet)
- Wiring card: **item 74 is the cover on the unused Black/White lead**, not an in-line part on Black at J21.
- Wiring card + repair log: there **is** a wire from the breaker straight to the switch input. J25/J15 track not used. Log currently says there's no such wire.
- Switch: N contact 0.5 Ω after cleaning. Feel it after the soak; replace if warm.
