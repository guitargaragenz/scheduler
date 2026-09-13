---
doc_status: live
---

# Bench job cards

A step-by-step card for one repair. It works on screen (tick boxes, notes, saves as you go) and
prints clean on A4. `ampeg-svt6-pro.html` is the master copy of the layout — every new card
copies it.

## How a new card gets made

1. **Talk the job through first.** Trevor and Claude discuss the unit, the fault, and what the
   repair means: risks, what could go wrong, what order is safe, what needs measuring. Nothing
   gets written until that's agreed.
2. **Copy the master.** Copy `ampeg-svt6-pro.html` to `<brand>-<model>.html`.
3. **Replace the content, keep the frame.**
   - Keep: all the styling, the print section, and the script at the bottom.
   - Change: the title, the heading and ID block (assembly, schematic, board date), the hazard
     box, the stages and steps, any reading tables, and the reference data.
   - Change the save key (`var KEY = "..."`) to something new, or two cards will share ticks.
4. **Structure stays the same:** hazards up top, then stages (0, A, B, C…) that go from safest to
   riskiest. Each step gets a tick box, one plain instruction, a short "why" where it matters,
   and a notes box. Reading tables go inside the step that takes the readings.
5. **Publish it as an artifact** so it opens on the bench, and send the file too.

## Printing and exporting

Inside the artifact viewer the Print and Export buttons are blocked, and that can't be fixed.
To print, open the `.html` file in Safari and use File > Print (Save as PDF works too). Ticks
are saved in the browser you used, so they don't carry over to another browser or device.
