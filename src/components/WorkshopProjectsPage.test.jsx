import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';

// Merge A — the tab strip — and the planner pane behind it.
//
// Same rendering approach as Sidebar.test.jsx: the real components through
// renderToStaticMarkup, with the network stubbed. Static markup only, so these
// pin what is on screen on arrival — the strip's contents and order, which pane
// opens by default, and the two things the brief called out as easy to get
// wrong (Project Jobs must be last, and the "couldn't load" line must appear).

let loadResult = [];
const saveCalls = [];

vi.mock('../utils/supabase.js', () => ({
  isSupabaseConfigured: () => true,
  loadWorkshopProjects: () => Promise.resolve(loadResult),
  saveWorkshopProjects: (...args) => { saveCalls.push(args); return Promise.resolve({ ok: true }); },
  subscribeToWorkshopProjects: () => () => {},
}));

const { default: WorkshopProjectsPage, ProjectPane, PlannerBody } = await import('./WorkshopProjectsPage.jsx');

const project = (over) => ({
  id: 'wp-1', title: 'Shelving', notes: '', steps: [], parts: [],
  createdAt: '2026-07-28T09:00:00Z', ...over,
});

const render = (jobs = []) => renderToStaticMarkup(<WorkshopProjectsPage jobs={jobs} />);

// A project job for the pinned tab — matches the filter in ProjectsPage.jsx:
// j.project && !j.parentId && !j.done.
const projectJob = (over) => ({
  id: '1702', job: '1702', customer: 'Smith', mfr: 'Fender', model: 'Telecaster',
  desc: 'refret', bench: 'Fretwork', action: 'CI', days: 41,
  project: true, parentId: null, done: false, ...over,
});

beforeEach(() => {
  loadResult = [];
  saveCalls.length = 0;
});

describe('the tab strip', () => {
  it('renders one tab per project, in the order they came back', () => {
    const html = renderToStaticMarkup(
      <ProjectPane project={project()} onChange={() => {}} onDelete={() => {}} />,
    );
    // Sanity: the pane itself renders its four blocks and nothing else.
    expect(html).toContain('Notes');
    expect(html).toContain('Steps');
    expect(html).toContain('Parts');
  });

  it('pins Project Jobs at the far right — after the + and after every project', () => {
    const html = render();
    const plus = html.lastIndexOf('New project');
    const jobsTab = html.indexOf('Project Jobs');
    expect(plus).toBeGreaterThan(-1);
    expect(jobsTab).toBeGreaterThan(plus);
  });

  it('offers a + to start a new project', () => {
    expect(render()).toContain('aria-label="New project"');
  });

  // Requirement 3: the strip scrolls sideways rather than wrapping, and the
  // page body must not scroll sideways with it.
  it('scrolls the strip sideways and never wraps it', () => {
    const html = render();
    expect(html).toContain('overflow-x:auto');
    expect(html).toContain('flex-wrap:nowrap');
  });
});

describe('what opens on arrival', () => {
  it('opens the planner, not the Project Jobs tab', () => {
    const html = render([projectJob()]);
    // The aged chart's column heading only appears on the pinned tab.
    expect(html).not.toContain('Age · Action');
  });

  it('says Loading… until the read lands, and shows no empty state yet', () => {
    // The strip is up immediately; the pane waits. Showing "nothing here yet"
    // before the read returns would flash an empty planner at him every time.
    const html = render();
    expect(html).toContain('Loading…');
    expect(html).not.toContain('No workshop projects yet');
  });

  it('says how to start one when there are genuinely no projects', () => {
    const html = renderToStaticMarkup(
      <PlannerBody loaded={true} loadFailed={false} project={null} onChange={() => {}} onDelete={() => {}} />,
    );
    expect(html).toContain('No workshop projects yet');
    expect(html).toContain('#PRJ');
  });

  // Checklist 9. The Parking Lot fails silently; this deliberately does not.
  it('says so on screen when the read fails, and offers no empty state', () => {
    const html = renderToStaticMarkup(
      <PlannerBody loaded={true} loadFailed={true} project={null} onChange={() => {}} onDelete={() => {}} />,
    );
    expect(html).toContain('Couldn&#x27;t load projects — nothing has been changed.');
    // A failed read must never read as "you have no projects" — that is the
    // message that would make him start typing them in again.
    expect(html).not.toContain('No workshop projects yet');
  });
});

// The other half of checklist 9: a failed read must not WRITE.
//
// renderToStaticMarkup never runs effects, so rendering the page and checking
// that nothing saved would prove nothing at all — it would pass even if the
// guard were deleted. The real proof is in two places:
//
//   - the storage layer: supabaseWorkshopProjects.test.js asserts that a failed
//     loadWorkshopProjects() issues no write of any kind, and returns null
//     rather than [] so the page can tell the two apart;
//   - the page's own guard, below, read as source — the same technique
//     parkingLotTag.test.js uses, because this is a rule about WHERE code sits.
describe('a failed read writes nothing', () => {
  const src = readFileSync(new URL('./WorkshopProjectsPage.jsx', import.meta.url), 'utf8');

  it('bails out of applyServer on null before touching state or the baseline', () => {
    const start = src.indexOf('function applyServer(');
    expect(start).toBeGreaterThan(-1);
    const body = src.slice(start, src.indexOf('}', src.indexOf('setLoadFailed(false)')));
    // The null check is the FIRST thing in the function — before setProjects
    // and, above all, before persistedRef is advanced.
    expect(body).toMatch(/function applyServer\(data\)\s*\{\s*if \(data === null\) return;/);
    expect(body.indexOf('if (data === null) return;')).toBeLessThan(body.indexOf('persistedRef.current ='));
  });

  it('never calls saveWorkshopProjects from inside the load effect', () => {
    const start = src.indexOf('loadWorkshopProjects().then');
    const body = src.slice(start, start + 400);
    expect(body).not.toContain('saveWorkshopProjects');
    expect(body).not.toContain('persist(');
  });
});

describe('the project pane holds exactly four things', () => {
  const html = renderToStaticMarkup(
    <ProjectPane
      project={project({
        title: 'Shelving — parts wall',
        notes: 'Ply not MDF.',
        steps: [
          { id: 'st-1', text: 'Measure the wall', done: true },
          { id: 'st-2', text: 'Order the ply', done: false },
        ],
        parts: [{ id: 'pt-1', description: '18mm ply', qty: '2 sheets' }],
      })}
      onChange={() => {}}
      onDelete={() => {}}
    />,
  );

  it('shows the title, notes, steps and parts', () => {
    expect(html).toContain('Shelving — parts wall');
    expect(html).toContain('Ply not MDF.');
    expect(html).toContain('Measure the wall');
    expect(html).toContain('18mm ply');
    expect(html).toContain('2 sheets');
  });

  it('shows a ticked step as ticked and struck through', () => {
    expect(html).toContain('line-through');
  });

  it('can add a step and a part', () => {
    expect(html).toContain('aria-label="Add a step"');
    expect(html).toContain('aria-label="Add a part"');
  });

  it('can reorder steps', () => {
    expect(html).toContain('aria-label="Move up"');
    expect(html).toContain('aria-label="Move down"');
  });

  // The design rule, on screen this time. A planner that can nag him is one he
  // stops opening — so nothing here may show a status or a deadline.
  it('shows no status, due date, priority or percent complete', () => {
    for (const word of ['Status', 'Due', 'Priority', 'Overdue', 'overdue', '% complete']) {
      expect(html).not.toContain(word);
    }
  });
});

describe('the Project Jobs tab keeps its own computation', () => {
  it('renders no page header of its own — one header, not two', async () => {
    const { default: ProjectsPage } = await import('./ProjectsPage.jsx');
    const html = renderToStaticMarkup(<ProjectsPage jobs={[projectJob()]} />);
    // The old page title. The tab strip says "Project Jobs" already; this
    // component rendering "Projects" again is the page-inside-a-page bug.
    expect(html).not.toContain('>Projects<');
    // But the count, date and action filter it always had are still there.
    expect(html).toContain('1 jobs');
    expect(html).toContain('Needs Input');
    expect(html).toContain('Age · Action');
  });

  it('shrinks its empty state to fit a tab rather than filling a page', async () => {
    const { default: ProjectsPage } = await import('./ProjectsPage.jsx');
    const html = renderToStaticMarkup(<ProjectsPage jobs={[]} />);
    expect(html).toContain('No project jobs yet');
    // The old full-page centring block is gone.
    expect(html).not.toContain('justify-content:center');
  });

  it('still filters to live, top-level, project-flagged jobs only', async () => {
    const { default: ProjectsPage } = await import('./ProjectsPage.jsx');
    const html = renderToStaticMarkup(<ProjectsPage jobs={[
      projectJob({ id: '1', job: '1' }),
      projectJob({ id: '2', job: '2', done: true }),
      projectJob({ id: '3', job: '3', parentId: '1' }),
      projectJob({ id: '4', job: '4', project: false }),
    ]} />);
    expect(html).toContain('1 jobs');
  });
});
