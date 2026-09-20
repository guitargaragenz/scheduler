---
doc_status: live
---

# Repair log — Ampeg SVT-6 PRO, job #1520

Customer: Pete Johanson · Assembly 07-699-01 · Schematic 07S699 rev A
Card: [ampeg-svt6-pro.html](../ampeg-svt6-pro.html)

What actually happened on the bench, in order. The card says what to do; this says what was done
and what it read. **Newest entry at the bottom.** One line per action, with the reading if there
was one.

---

## Done so far

- **Out-of-spec caps and resistors replaced.** (Values and positions not recorded at the time —
  add them here if they're still known.)
- **Two 16 V zeners replaced — D20 / D23** (1N5353B). Both mounted standing off the PCB. No
  sleeving fitted; not needed, nothing close enough to touch the legs.
- **C14 fitted** (47 µF 450 V, B+ reservoir). It was missing when the amp came in.
- **4 A inline fuse at J31** in place for bench work.
- **Floating BLK/WHT transformer tap** insulated.
- **Bench supply chain: isolation transformer → variac → amp.** Confirmed by Trevor, and what
  card step 14 requires. **Iso is 2300 VA — ample** for a 1000 W amp; it won't limit.
  **Variac is a Voltac SB-10 — 2 kVA, 230 V in, 0–260 V out, 10 A max** (confirmed against
  listings). Tightest link in the chain, but ~2.3 kW of headroom against an amp that idles at
  well under 1 A of mains. **Nothing in the bench chain will limit this amp.** The 0–260 V range
  also gives good resolution through the 150–180 V relay window.
- **Four 220 Ω 10 W feed resistors never lifted** — R21 / R63 and R51 / R64 all still in place, so
  card step 13 has nothing to refit.

## 2026-09-20 — light bulb limiter attempt, aborted

**Tried to power up on a light bulb limiter. Stopped: bulb stayed at full brightness and the rails
only came up to about half.**

**Not a fault — the limiter is too small.** A 200 W bulb passes 0.87 A flat out at 230 V, against
33,600 µF of filter caps and a 1000 W transformer. From the card's own dim-bulb table, at 0.5 A
drawn the amp only sees 132 V. That is the half rails, exactly.

Correcting the first read of it: the relays not pulling in doesn't make the bulb brighter —
relays out means *less* load, not more. It's the other way round. The bulb is too small, so the
rails sag, and **below about 120 V the relays can never release** — the +65 V rail scales with the
mains and D11 is a 30 V zener that has to be passed first. Result is a locked stalemate that reads
like a dead amp.

**Decision: use the variac, not the bulb.** This amp is a variac job.

## Decisions taken

- **Card steps 9–12 skipped** (bench-supply injection to prove the K1 / K2 relay chain). The
  variac ramp exercises the same chain in place, with a current limit and abort criteria.
  Accepted trade: if the relays don't click at 150–180 V, come back and do 9–12 to find out why.

## 2026-09-20 — trimmer direction traced off the print

**Anticlockwise is minimum bias on both AP1 and AP2.** Traced at high magnification; both pots are
wired identically.

- The **CW-marked leg goes to the bias transistor's base** (Q2 for AP1, Q22 for AP2), with the
  **22 K collector-to-base** above it.
- The **wiper is strapped back to the other end leg**, which goes to common — and Trevor confirmed
  from the board that the **emitter also goes to common**. That last fact is what closed it.
- So the pot sits **base-to-emitter** and the working resistance is **CW leg → wiper**. Classic Vbe
  multiplier: spread ≈ 0.65 × (1 + 22K / pot).
- **Fully anticlockwise = full 10 K in circuit = smallest spread = minimum bias.**

**Bench identification of the legs:** two of the three read a dead short — wiper and common end.
The odd leg out is the CW one, on the transistor base.

**The travel is badly non-linear** — 10 K ≈ 2.1 V spread, 5 K ≈ 3.5 V, 3 K ≈ 5.4 V, 1 K ≈ 15 V.
Dead for the first half, then up fast, vicious at the end. Working range is around the
middle-to-upper third.

## Open / next

- **Next action: wind AP1 and AP2 fully anticlockwise with the amp off, counting the turns**, then
  the step 14–17 ramp. At the 120 V pause, read bias millivolts **before touching either pot** —
  expect near zero — and take a quarter-turn feel reading.
- Bias never yet set. No bias readings taken.
- Breaker still the undersized 7 A — card step 22 wants the correct 8 A before handover.
- Card step 24: ask the customer why the previous tech fitted that fuse.

---

## Readings

Fill in as they're taken. Bias spec is **20 ±5 mVdc, averaged across the ten resistors in a
bank** — a single resistor is a proxy, not the spec.

| Date | Mains (variac) | +65 V rail | Bank 1 mV | Bank 2 mV | Mains current | Note |
|---|---|---|---|---|---|---|
| | | | | | | |
