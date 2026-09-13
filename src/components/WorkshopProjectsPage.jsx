import { useState, useEffect, useCallback, useRef } from 'react';
import {
  isSupabaseConfigured,
  loadWorkshopProjects,
  saveWorkshopProjects,
  subscribeToWorkshopProjects,
} from '../utils/supabase.js';
import { newWorkshopProjectId } from '../utils/workshopProjectTag.js';
import ProjectsPage from './ProjectsPage.jsx';

// The Projects nav button opens this. It is a tab strip with one tab per
// workshop project, a `+` after them, and the old Projects view pinned at the
// far right as "Project Jobs".
//
// Two different things wanted the same word. The pinned tab is customer jobs
// Multitrack flagged — paying work, aged, with an action filter. The project
// tabs are Trevor's own shop work — shelving, the cutting room, jigs — which
// isn't paying and isn't bookable. "Jobs" is the honest distinguisher.
//
// A project holds exactly four things: title, notes, steps, parts. It has no
// status, due date, priority, percent complete or notion of "overdue", and
// that is the design, not an omission. Trevor asked for a planner, not a
// tracker: the moment it can nag him is the moment he stops opening it. Do not
// add one of those without a brief that says to.

const JOBS_TAB = '__project_jobs__';

// Text fields write on a short delay so a paragraph of notes isn't one Supabase
// upsert per keystroke. Structural edits (add, delete, tick, reorder) write
// immediately — they're rare and they're the ones worth never losing. Any
// pending text write is flushed on unmount, so leaving the page mid-sentence
// still saves.
const TEXT_SAVE_DELAY_MS = 600;

function newStepId() {
  return 'st-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function newPartId() {
  return 'pt-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// Move an item within an array. Returns the same array reference when the move
// would fall off either end, so a no-op reorder doesn't trigger a save.
function moveItem(list, index, delta) {
  const target = index + delta;
  if (target < 0 || target >= list.length) return list;
  const next = list.slice();
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);
  return next;
}

const inputStyle = {
  width: '100%', background: '#0d1117', border: '1px solid #1e293b',
  borderRadius: 6, padding: '8px 10px', color: '#e2e8f0', fontSize: 13,
  boxSizing: 'border-box', fontFamily: 'inherit',
};

function BlockLabel({ children }) {
  return (
    <div style={{
      fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em',
      color: '#64748b', marginBottom: 8, fontWeight: 700,
    }}>
      {children}
    </div>
  );
}

function IconButton({ title, onClick, children, disabled }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        background: 'none', border: 'none', color: disabled ? '#1e293b' : '#475569',
        fontSize: 12, cursor: disabled ? 'default' : 'pointer', padding: '0 4px', lineHeight: 1,
      }}
    >
      {children}
    </button>
  );
}

export function ProjectPane({ project, onChange, onDelete }) {
  const [newStep, setNewStep] = useState('');
  const [newPartDesc, setNewPartDesc] = useState('');
  const [newPartQty, setNewPartQty] = useState('');

  const steps = project.steps || [];
  const parts = project.parts || [];

  const setSteps = (next, immediate) => onChange({ ...project, steps: next }, immediate);
  const setParts = (next, immediate) => onChange({ ...project, parts: next }, immediate);

  function addStep() {
    if (!newStep.trim()) return;
    setSteps([...steps, { id: newStepId(), text: newStep.trim(), done: false }], true);
    setNewStep('');
  }

  function addPart() {
    if (!newPartDesc.trim()) return;
    setParts([...parts, { id: newPartId(), description: newPartDesc.trim(), qty: newPartQty.trim() }], true);
    setNewPartDesc('');
    setNewPartQty('');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 760 }}>

      {/* Title */}
      <div>
        <input
          value={project.title}
          placeholder="Name this project…"
          onChange={e => onChange({ ...project, title: e.target.value })}
          style={{
            ...inputStyle, background: 'transparent', border: 'none', padding: 0,
            fontSize: 19, fontWeight: 600, color: '#f1f5f9',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
          <div style={{ fontSize: 11, color: '#475569' }}>
            {project.createdAt
              ? `Started ${new Date(project.createdAt).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })}`
              : 'Started just now'}
          </div>
          <button
            type="button"
            onClick={onDelete}
            style={{
              background: 'none', border: 'none', color: '#334155',
              fontSize: 11, cursor: 'pointer', padding: 0,
            }}
          >
            Delete project
          </button>
        </div>
      </div>

      {/* Notes — the brain dump. This is the point of the whole feature. */}
      <div>
        <BlockLabel>Notes</BlockLabel>
        <textarea
          value={project.notes}
          placeholder="What's the job, what's in the way, what have you worked out so far…"
          rows={6}
          onChange={e => onChange({ ...project, notes: e.target.value })}
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6, color: '#cbd5e1' }}
        />
      </div>

      {/* Steps — a plain checklist. No dates, no assignment, on purpose. */}
      <div>
        <BlockLabel>Steps</BlockLabel>
        {steps.map((step, i) => (
          <div key={step.id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '6px 0', borderBottom: '1px solid #1e293b',
          }}>
            <input
              type="checkbox"
              checked={step.done}
              aria-label={`Done: ${step.text}`}
              onChange={() => setSteps(
                steps.map(s => s.id === step.id ? { ...s, done: !s.done } : s),
                true,
              )}
              style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#0d9488', flexShrink: 0 }}
            />
            <input
              value={step.text}
              onChange={e => setSteps(steps.map(s => s.id === step.id ? { ...s, text: e.target.value } : s))}
              style={{
                ...inputStyle, background: 'transparent', border: 'none', padding: 0, flex: 1,
                color: step.done ? '#475569' : '#e2e8f0',
                textDecoration: step.done ? 'line-through' : 'none',
              }}
            />
            <IconButton title="Move up" disabled={i === 0} onClick={() => setSteps(moveItem(steps, i, -1), true)}>▲</IconButton>
            <IconButton title="Move down" disabled={i === steps.length - 1} onClick={() => setSteps(moveItem(steps, i, 1), true)}>▼</IconButton>
            <IconButton title="Remove step" onClick={() => setSteps(steps.filter(s => s.id !== step.id), true)}>✕</IconButton>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <input
            value={newStep}
            placeholder="Add a step…"
            aria-label="Add a step"
            onChange={e => setNewStep(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addStep()}
            style={{ ...inputStyle, flex: 1 }}
          />
          <button type="button" onClick={addStep} style={{
            background: '#134e4a', border: '1px solid #0f766e', borderRadius: 6,
            color: '#5eead4', fontSize: 12, fontWeight: 700, padding: '6px 14px', cursor: 'pointer',
          }}>Add</button>
        </div>
      </div>

      {/* Parts — description plus quantity, free text. Deliberately NOT wired
          to PartsBox or the Parts to Order list in this build. */}
      <div>
        <BlockLabel>Parts</BlockLabel>
        {parts.map(part => (
          <div key={part.id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '6px 0', borderBottom: '1px solid #1e293b',
          }}>
            <input
              value={part.description}
              onChange={e => setParts(parts.map(p => p.id === part.id ? { ...p, description: e.target.value } : p))}
              style={{ ...inputStyle, background: 'transparent', border: 'none', padding: 0, flex: 1 }}
            />
            <input
              value={part.qty}
              placeholder="qty"
              aria-label={`Quantity for ${part.description}`}
              onChange={e => setParts(parts.map(p => p.id === part.id ? { ...p, qty: e.target.value } : p))}
              style={{
                ...inputStyle, background: 'transparent', border: 'none', padding: 0,
                width: 110, textAlign: 'right', color: '#94a3b8', fontSize: 12,
              }}
            />
            <IconButton title="Remove part" onClick={() => setParts(parts.filter(p => p.id !== part.id), true)}>✕</IconButton>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <input
            value={newPartDesc}
            placeholder="Add a part…"
            aria-label="Add a part"
            onChange={e => setNewPartDesc(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addPart()}
            style={{ ...inputStyle, flex: 1 }}
          />
          <input
            value={newPartQty}
            placeholder="qty"
            aria-label="New part quantity"
            onChange={e => setNewPartQty(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addPart()}
            style={{ ...inputStyle, width: 110 }}
          />
          <button type="button" onClick={addPart} style={{
            background: '#134e4a', border: '1px solid #0f766e', borderRadius: 6,
            color: '#5eead4', fontSize: 12, fontWeight: 700, padding: '6px 14px', cursor: 'pointer',
          }}>Add</button>
        </div>
      </div>
    </div>
  );
}

// The planner side of the pane, split out as a pure component purely so its
// three states — loading, load-failed, nothing-here-yet — can be rendered and
// tested without waiting on a network round trip.
export function PlannerBody({ loaded, loadFailed, project, onChange, onDelete }) {
  return (
    <>
      {/* Deliberately louder than the Parking Lot, which fails silently. Trevor
          should know his planner is showing him nothing because the network
          failed, not because it's empty — the two look identical otherwise. */}
      {loadFailed && (
        <div style={{ fontSize: 13, color: '#fca5a5', marginBottom: 16 }}>
          Couldn't load projects — nothing has been changed.
        </div>
      )}
      {!loaded && !loadFailed && (
        <div style={{ fontSize: 13, color: '#475569' }}>Loading…</div>
      )}
      {loaded && !project && !loadFailed && (
        <div style={{ fontSize: 13, color: '#475569', maxWidth: 520, lineHeight: 1.6 }}>
          No workshop projects yet. Hit <strong style={{ color: '#94a3b8' }}>+</strong> to start
          one, or put <code style={{
            background: '#1f2937', padding: '1px 6px', borderRadius: 4, color: '#5eead4',
          }}>#PRJ</code> on a Daily Log bullet.
        </div>
      )}
      {project && (
        <ProjectPane
          key={project.id}
          project={project}
          onChange={onChange}
          onDelete={onDelete}
        />
      )}
    </>
  );
}

export default function WorkshopProjectsPage({ jobs }) {
  const [projects, setProjects] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  // null means "whichever project is first" — so the first project is open on
  // arrival without having to guess an id before the load lands. Which tab was
  // last open deliberately does not persist.
  const [activeTab, setActiveTab] = useState(null);
  const [saving, setSaving] = useState(false);

  // Last list we know the table holds — the baseline saveWorkshopProjects()
  // diffs against. Only ever advanced by a confirmed load or a confirmed save,
  // so a failed write stays queued in the next diff instead of being forgotten.
  const persistedRef = useRef([]);
  // How many of our own saves are in flight. Non-zero means ignore realtime, or
  // a server echo would overwrite the words being typed.
  const pendingSavesRef = useRef(0);
  const saveTimerRef = useRef(null);
  const pendingProjectsRef = useRef(null);

  const writeNow = useCallback((list) => {
    if (!isSupabaseConfigured()) return;
    setSaving(true);
    pendingSavesRef.current += 1;
    const baseline = persistedRef.current;
    saveWorkshopProjects(list, baseline).then(result => {
      // Only move the baseline forward on a confirmed write. If the save
      // failed, the next one re-diffs against the same baseline and re-sends.
      if (result && result.ok) persistedRef.current = list;
      pendingSavesRef.current -= 1;
      if (pendingSavesRef.current === 0) setSaving(false);
    });
  }, []);

  const flushPending = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (pendingProjectsRef.current) {
      const list = pendingProjectsRef.current;
      pendingProjectsRef.current = null;
      writeNow(list);
    }
  }, [writeNow]);

  // `immediate` writes straight away — used for add/delete/tick/reorder.
  // Otherwise the write is debounced, so typing notes isn't one upsert per
  // keystroke. Either way the on-screen state updates instantly.
  const persist = useCallback((list, immediate = false) => {
    setProjects(list);
    if (!isSupabaseConfigured()) return;
    pendingProjectsRef.current = list;
    if (immediate) {
      flushPending();
      return;
    }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      flushPending();
    }, TEXT_SAVE_DELAY_MS);
  }, [flushPending]);

  // Leaving the page mid-sentence must not drop the sentence.
  useEffect(() => () => flushPending(), [flushPending]);

  // Load. A failed read must touch nothing and write nothing — this is the
  // exact bug the Parking Lot's Merge A existed to fix, where a failed read was
  // treated as "empty table, first run" and saved a seed over the real rows.
  useEffect(() => {
    // No Supabase keys (a local build without .env). Show an empty planner
    // rather than a fabricated one; nothing is saved in this mode anyway.
    if (!isSupabaseConfigured()) {
      setProjects([]);
      setLoaded(true);
      return;
    }

    function applyServer(data) {
      if (data === null) return;
      setProjects(data);
      persistedRef.current = data;
      setLoadFailed(false);
    }

    loadWorkshopProjects().then(data => {
      applyServer(data);
      // Unlike the Parking Lot, which fails silently, say so on screen. Trevor
      // should know his planner is showing him nothing because the network
      // failed, not because it's empty. A plain line of text, no new component.
      if (data === null) setLoadFailed(true);
      setLoaded(true);
    });

    const unsub = subscribeToWorkshopProjects(data => {
      // While one of our own saves is in flight, taking the server copy would
      // overwrite what's being typed. Same idea as ParkingLotPage.
      if (pendingSavesRef.current > 0) return;
      if (saveTimerRef.current) return;
      applyServer(data);
    });
    return () => unsub();
  }, []);

  const isJobsTab = activeTab === JOBS_TAB;
  const activeProject = isJobsTab
    ? null
    : (projects.find(p => p.id === activeTab) || projects[0] || null);

  function addProject() {
    const project = { id: newWorkshopProjectId(), title: '', notes: '', steps: [], parts: [], createdAt: null };
    persist([...projects, project], true);
    setActiveTab(project.id);
  }

  function updateProject(updated, immediate) {
    persist(projects.map(p => p.id === updated.id ? updated : p), immediate);
  }

  function deleteProject(id) {
    const remaining = projects.filter(p => p.id !== id);
    persist(remaining, true);
    setActiveTab(remaining.length > 0 ? remaining[0].id : null);
  }

  const tabBase = {
    font: 'inherit', fontSize: 12, whiteSpace: 'nowrap', cursor: 'pointer',
    background: 'transparent', border: '1px solid transparent', borderBottom: 'none',
    borderRadius: '6px 6px 0 0', padding: '7px 14px', marginBottom: -1, color: '#94a3b8',
  };
  const tabOn = {
    ...tabBase, color: '#f1f5f9', fontWeight: 700,
    background: '#111827', border: '1px solid #1e293b', borderBottomColor: '#111827',
  };

  return (
    // overflow hidden here is what stops a long tab strip making the whole page
    // scroll sideways — the strip scrolls inside itself instead.
    <div style={{
      flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column',
      overflow: 'hidden', background: '#111827', color: '#f9fafb',
    }}>

      {/* Tab strip */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', gap: 3,
        padding: '9px 12px 0', borderBottom: '1px solid #1e293b',
        background: '#0d1117', flexShrink: 0,
      }}>
        {/* The projects scroll; the pinned tab does not. Keeping Project Jobs
            outside the scrolling area is a deliberate change from the mockup,
            which used a flex spacer — with enough projects to overflow, a
            spacer collapses and the pinned tab scrolls off the right-hand
            edge, which is the one place it is supposed to always be. */}
        <div
          role="tablist"
          aria-label="Workshop projects"
          style={{
            display: 'flex', alignItems: 'flex-end', gap: 3,
            flex: 1, minWidth: 0, overflowX: 'auto', flexWrap: 'nowrap',
            scrollbarWidth: 'thin',
          }}
        >
          {projects.map(p => {
            const on = !isJobsTab && activeProject && activeProject.id === p.id;
            return (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={on ? 'true' : 'false'}
                onClick={() => setActiveTab(p.id)}
                style={on ? tabOn : tabBase}
              >
                {p.title.trim() || 'Untitled'}
              </button>
            );
          })}
          <button
            type="button"
            title="New project"
            aria-label="New project"
            onClick={addProject}
            style={{ ...tabBase, padding: '7px 12px', fontSize: 15, lineHeight: 1, flexShrink: 0 }}
          >
            +
          </button>
        </div>

        <div style={{ width: 1, height: 14, background: '#1e293b', margin: '0 10px 8px', flexShrink: 0 }} />

        <button
          type="button"
          role="tab"
          aria-selected={isJobsTab ? 'true' : 'false'}
          onClick={() => setActiveTab(JOBS_TAB)}
          style={{ ...(isJobsTab ? tabOn : tabBase), flexShrink: 0 }}
        >
          Project Jobs
        </button>
      </div>

      {/* Pane */}
      <div style={{ flex: 1, overflow: 'auto', minWidth: 0 }}>
        <div style={{ maxWidth: 1140, margin: '0 auto', padding: '22px 20px 40px' }}>
          {isJobsTab ? (
            <ProjectsPage jobs={jobs} />
          ) : (
            <PlannerBody
              loaded={loaded}
              loadFailed={loadFailed}
              project={activeProject}
              onChange={updateProject}
              onDelete={() => activeProject && deleteProject(activeProject.id)}
            />
          )}
        </div>
      </div>

      {saving && (
        <div style={{ fontSize: 10, color: '#334155', padding: '0 20px 6px', flexShrink: 0 }}>saving…</div>
      )}
    </div>
  );
}
