import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Why this test exists (2026-08-20): the Daily Log build dropped
// `setMark={weekMarks.setMark}` from the <BenchWeekPage> tag in App.jsx. Every
// unit test still passed and the build was clean — the page rendered fine, the
// day columns just silently did nothing when tapped, because handleCell() was
// calling an undefined prop.
//
// There is no DOM test setup in this project (no jsdom, no testing-library), so
// a click cannot be simulated. This reads the source instead: it checks that
// every handler BenchWeekPage needs from useWeekMarks is actually handed to it.
// Crude, but it catches exactly the failure that shipped.

const src = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

function propsPassedTo(component, appSource) {
  const open = appSource.indexOf(`<${component}`);
  if (open === -1) throw new Error(`<${component}> is not rendered in App.jsx`);
  const close = appSource.indexOf('/>', open);
  return appSource.slice(open, close);
}

describe('App wires the Weekly Log up', () => {
  const app = src('../App.jsx');
  const tag = propsPassedTo('BenchWeekPage', app);

  for (const prop of ['marks', 'ready', 'saveError', 'setMark', 'clearJobKeys']) {
    it(`passes ${prop} from weekMarks`, () => {
      expect(tag).toContain(`${prop}={weekMarks.${prop}}`);
    });
  }

  // Build 1, 2026-08-23. The week has to be able to tell the day to drop its
  // "keep it off" note, or a job taken off a day can never be booked back onto
  // it. Losing this prop looks exactly like the failure above: the page renders,
  // and the job silently stays off.
  it('passes onBookedOnDay, so a removal cannot outlive a rebooking', () => {
    expect(tag).toContain('onBookedOnDay=');
  });
});
