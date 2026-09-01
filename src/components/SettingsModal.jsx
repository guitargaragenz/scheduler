import { useState } from 'react';
import { buildAndKeyword, andKeywordWords } from '../data/jobs.js';

const BENCHES = ['Fretwork', 'Luthier', 'Electronics', 'Setup', 'Wiring', 'Finishing'];

const BENCH_ACCENT = {
  Fretwork:    '#a78bfa',
  Luthier:     '#34d399',
  Electronics: '#60a5fa',
  Setup:       '#fbbf24',
  Finishing:   '#d97706',
};

// The chip itself, lifted out of KeywordEditor unchanged so the Suppliers list
// below is literally the same control and not a lookalike. `onRename` is the one
// addition — keywords have no rename (you delete the wrong word and type the
// right one), suppliers do.
function Chip({ label, onRemove, onRename }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 11, padding: '2px 7px', borderRadius: 4,
      background: '#1e293b', border: '1px solid #334155', color: '#cbd5e1',
    }}>
      {onRename ? (
        <button
          onClick={onRename}
          title="Click to rename"
          style={{
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            color: '#cbd5e1', fontSize: 11,
          }}
        >{label}</button>
      ) : label}
      <button onClick={onRemove} style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: '#64748b', fontSize: 12, lineHeight: 1, padding: 0,
      }}>×</button>
    </span>
  );
}

// Text box + Add button, also shared between the two editors.
function AddRow({ placeholder, onAdd }) {
  const [input, setInput] = useState('');
  function submit() {
    const val = input.trim();
    if (!val) { setInput(''); return; }
    onAdd(val);
    setInput('');
  }
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submit()}
        placeholder={placeholder}
        style={{
          flex: 1, fontSize: 12, padding: '4px 8px',
          background: '#0f172a', border: '1px solid #334155',
          borderRadius: 5, color: '#e2e8f0', outline: 'none',
        }}
      />
      <button onClick={submit} style={{
        padding: '4px 10px', background: '#1e3a5f', border: '1px solid #2563eb',
        borderRadius: 5, color: '#bfdbfe', fontSize: 12, cursor: 'pointer',
      }}>Add</button>
    </div>
  );
}

// Two plain words joined by "and". Trevor types `install` and `pickup`; the job
// only lands on this bench when the description has BOTH. He never sees, and
// never has to type, the pattern that gets stored — buildAndKeyword makes it.
function AndRow({ onAdd }) {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const box = {
    flex: 1, minWidth: 0, fontSize: 12, padding: '4px 8px',
    background: '#0f172a', border: '1px solid #334155',
    borderRadius: 5, color: '#e2e8f0', outline: 'none',
  };
  function submit() {
    if (!a.trim() || !b.trim()) return;
    onAdd(a, b);
    setA(''); setB('');
  }
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 10, color: '#475569', marginBottom: 4 }}>
        Only when the description has both words
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input
          value={a}
          onChange={e => setA(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="first word"
          style={box}
        />
        <span style={{ fontSize: 11, color: '#64748b' }}>and</span>
        <input
          value={b}
          onChange={e => setB(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="second word"
          style={box}
        />
        <button onClick={submit} style={{
          padding: '4px 10px', background: '#1e3a5f', border: '1px solid #2563eb',
          borderRadius: 5, color: '#bfdbfe', fontSize: 12, cursor: 'pointer',
        }}>Add</button>
      </div>
    </div>
  );
}

function KeywordEditor({ bench, keywords, defaultKeywords, onChange }) {
  const [open, setOpen] = useState(false);
  // An empty stored array counts as "no entry" and shows the defaults, matching
  // what inferBench() actually does with it. Emptying a bench therefore puts the
  // default words back rather than leaving a blank box that would match every job.
  const stored = keywords[bench];
  const hasStored = Array.isArray(stored) && stored.length > 0;
  const effective = hasStored ? stored : (defaultKeywords[bench] ?? []);
  const isDefault = !hasStored;

  function add(raw) {
    // Keywords are matched lowercase, so they are stored lowercase.
    const val = raw.trim().toLowerCase();
    if (!val || effective.includes(val)) return;
    onChange(bench, [...effective, val]);
  }

  // The "and" box. Stored as one entry, so removing its chip removes the whole
  // thing — there is no half of it left behind.
  function addAnd(a, b) {
    const val = buildAndKeyword(a, b);
    if (!val || effective.includes(val)) return;
    onChange(bench, [...effective, val]);
  }

  function remove(kw) {
    onChange(bench, effective.filter(k => k !== kw));
  }

  function reset() {
    onChange(bench, null);
  }

  const accent = BENCH_ACCENT[bench];

  return (
    <div style={{ marginBottom: 6, borderRadius: 6, border: '1px solid #334155', overflow: 'hidden' }}>
      {/* Accordion header */}
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', background: '#0f172a', border: 'none', cursor: 'pointer',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, color: accent,
            background: accent + '22', borderRadius: 4,
            padding: '2px 8px', letterSpacing: '0.05em',
          }}>{bench.toUpperCase()}</span>
          <span style={{ fontSize: 11, color: '#475569' }}>{effective.length} keywords</span>
        </div>
        <span style={{ color: '#475569', fontSize: 12 }}>{open ? '▲' : '▼'}</span>
      </button>

      {/* Accordion body */}
      {open && (
        <div style={{ padding: '10px 12px', borderTop: '1px solid #1e293b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            {!isDefault && (
              <button onClick={reset} style={{
                fontSize: 10, color: '#64748b', background: 'none', border: 'none',
                cursor: 'pointer', padding: '1px 6px', borderRadius: 3,
                borderColor: '#334155', borderWidth: 1, borderStyle: 'solid',
              }}>reset to defaults</button>
            )}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
            {effective.map(kw => {
              // An "and" entry reads as `install + pickup`. What is stored is
              // never shown.
              const pair = andKeywordWords(kw);
              return (
                <Chip key={kw} label={pair ? `${pair[0]} + ${pair[1]}` : kw} onRemove={() => remove(kw)} />
              );
            })}
          </div>
          <AddRow placeholder="add keyword…" onAdd={add} />
          <AndRow onAdd={addAnd} />
        </div>
      )}
    </div>
  );
}

// The supplier list. Same chips, different label — no new editor was designed.
function SupplierEditor({ suppliers = [], onAdd, onRename, onRemove }) {
  return (
    <div>
      <p style={{ fontSize: 12, color: '#64748b', marginBottom: 12, lineHeight: 1.5 }}>
        The suppliers offered when adding a part. Click a name to rename it, × to remove it.
      </p>
      <p style={{ fontSize: 11, color: '#475569', marginBottom: 12, lineHeight: 1.5 }}>
        Removing or renaming a supplier here never changes parts you have already saved —
        they keep the name they were saved with and still group under it. It only changes
        what is offered from now on.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
        {suppliers.length === 0 && (
          <span style={{ fontSize: 12, color: '#475569' }}>No suppliers yet.</span>
        )}
        {suppliers.map(s => (
          <Chip
            key={s.id}
            label={s.name}
            onRemove={() => onRemove(s.id)}
            onRename={() => {
              const next = window.prompt('Rename supplier:', s.name);
              if (next !== null && next.trim() && next.trim() !== s.name) onRename(s.id, next);
            }}
          />
        ))}
      </div>
      <AddRow placeholder="add supplier…" onAdd={onAdd} />
    </div>
  );
}

const BENCH_HOUR_DEFAULTS = { Luthier: 1.5, Setup: 1.5, Finishing: 1.5 };

export default function SettingsModal({
  // A settings write that failed. Shown at the top of the modal rather than
  // logged, because a setting that looks saved and isn't is the whole reason
  // this moved off localStorage.
  saveError,
  suppliers = [], supplierError, onAddSupplier, onRenameSupplier, onRemoveSupplier,
  benchKeywords = {}, defaultBenchKeywords = {}, onBenchKeywordsChange,
  hourlyRate = 85, onHourlyRateChange,
  weeklyRevenueTarget = 1500, onWeeklyTargetChange,
  benchHours = {}, onBenchHoursChange,
  onOpenSummary, onOpenParkingLot,
}) {
  const [activeTab, setActiveTab] = useState('keywords');
  const [rateInput, setRateInput] = useState(String(hourlyRate));
  const [targetInput, setTargetInput] = useState(String(weeklyRevenueTarget));
  const [benchHourInputs, setBenchHourInputs] = useState(
    Object.fromEntries(Object.entries(BENCH_HOUR_DEFAULTS).map(([b, def]) => [b, String(benchHours[b] ?? def)]))
  );

  function handleKeywordChange(bench, keywords) {
    if (keywords === null) {
      const next = { ...benchKeywords };
      delete next[bench];
      onBenchKeywordsChange(next);
    } else {
      onBenchKeywordsChange({ ...benchKeywords, [bench]: keywords });
    }
  }

  return (
    // A page in the body, not a fixed modal over the whole app. It used to sit
    // at zIndex 1000 behind a backdrop, covering the ⚙ button that closes it and
    // leaving the small × as the way out. Now the header stays visible and
    // reachable, exactly like Sheet, Projects and Parts to Order.
    <div style={{
      flex: 1, overflow: 'auto', background: '#111827',
      display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
      padding: '24px 20px',
    }}>
      <div style={{
        background: '#1e293b', border: '1px solid #334155', borderRadius: 12,
        width: 560, maxWidth: '100%', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0' }}>Settings</h2>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #334155' }}>
          {/* Changelog tab removed 2026-08-01 — it was read-only, months out of
              date, and the git history is the real record. */}
          {/* Calendar tab removed 2026-08-03 — connect/disconnect already lives in
              the main header, so this was a second door to the same switch. The
              two pages that were buried inside the old "pages" tab now sit in the
              row it left behind: they are one click, not a tab with a panel. */}
          {['keywords', 'suppliers', 'rates'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: '10px 18px', background: 'none', border: 'none',
              borderBottom: activeTab === tab ? '2px solid #3b82f6' : '2px solid transparent',
              color: activeTab === tab ? '#e2e8f0' : '#64748b',
              fontSize: 13, fontWeight: activeTab === tab ? 600 : 400,
              cursor: 'pointer', textTransform: 'capitalize',
            }}>{tab}</button>
          ))}
          {[['Summary', onOpenSummary], ['Parking Lot', onOpenParkingLot]].map(([label, onOpen]) => (
            <button key={label} onClick={onOpen} style={{
              padding: '10px 18px', background: 'none', border: 'none',
              borderBottom: '2px solid transparent',
              color: '#64748b', fontSize: 13, fontWeight: 400, cursor: 'pointer',
            }}>{label}</button>
          ))}
        </div>

        <div style={{ padding: '16px 20px' }}>

          {(saveError || supplierError) && (
            <div style={{
              marginBottom: 14, padding: '8px 12px', borderRadius: 6,
              background: '#450a0a', border: '1px solid #ef4444',
              color: '#fca5a5', fontSize: 12, lineHeight: 1.5,
            }}>
              {saveError || supplierError}
            </div>
          )}

          {activeTab === 'suppliers' && (
            <SupplierEditor
              suppliers={suppliers}
              onAdd={onAddSupplier}
              onRename={onRenameSupplier}
              onRemove={onRemoveSupplier}
            />
          )}

          {activeTab === 'keywords' && (
            <div>
              <p style={{ fontSize: 12, color: '#64748b', marginBottom: 16, lineHeight: 1.5 }}>
                Keywords in job descriptions that determine bench assignment. Edit to add your own terms. Changes re-classify all jobs immediately.
                <br /><br />
                <strong style={{ color: '#94a3b8' }}>Put a keyword in quotes to make it win.</strong>{' '}
                Benches are checked in a fixed order, so a general word on an earlier bench normally beats a more specific one later — <em>jack</em> on Electronics beats <em>output jack</em> on Wiring. A keyword in quotes, like <code style={{ color: '#94a3b8' }}>"output jack"</code>, jumps that order and wins over every unquoted keyword on every bench. Unquoted keywords keep working exactly as they always have.{' '}
                The <em>and</em> box under each bench's keywords does the same for two words at once: the job only comes here when the description has <strong>both</strong>, and like a quoted keyword it jumps the bench order.
              </p>
              {BENCHES.map(bench => (
                <KeywordEditor
                  key={bench}
                  bench={bench}
                  keywords={benchKeywords}
                  defaultKeywords={defaultBenchKeywords}
                  onChange={handleKeywordChange}
                />
              ))}
            </div>
          )}

          {activeTab === 'rates' && (
            <div>
              <p style={{ fontSize: 12, color: '#64748b', marginBottom: 16, lineHeight: 1.5 }}>
                Used to estimate revenue for jobs without a manual Price set in the sheet.
              </p>
              {[
                { label: 'Hourly rate (NZD)', value: rateInput, set: setRateInput, save: onHourlyRateChange, prefix: '$' },
                { label: 'Weekly revenue target (NZD)', value: targetInput, set: setTargetInput, save: onWeeklyTargetChange, prefix: '$' },
              ].map(({ label, value, set, save, prefix }) => (
                <div key={label} style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>{label}</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ color: '#475569', fontSize: 13 }}>{prefix}</span>
                    <input
                      type="number"
                      min="0"
                      value={value}
                      onChange={e => set(e.target.value)}
                      onBlur={() => { const n = parseFloat(value); if (!isNaN(n) && n >= 0) save(n); }}
                      style={{
                        width: 120, fontSize: 13, padding: '6px 10px',
                        background: '#0f172a', border: '1px solid #334155',
                        borderRadius: 6, color: '#e2e8f0', outline: 'none',
                      }}
                    />
                  </div>
                </div>
              ))}

              <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #334155' }}>
                <p style={{ fontSize: 12, color: '#64748b', marginBottom: 14, lineHeight: 1.5 }}>
                  Default hours for split sub-cards. Used as the fixed allocation when a job auto-splits.
                </p>
                {Object.entries(BENCH_HOUR_DEFAULTS).map(([bench, def]) => (
                  <div key={bench} style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>{bench} sub-card hours</label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        type="number"
                        min="0.5"
                        step="0.5"
                        value={benchHourInputs[bench]}
                        onChange={e => setBenchHourInputs(prev => ({ ...prev, [bench]: e.target.value }))}
                        onBlur={() => {
                          const n = parseFloat(benchHourInputs[bench]);
                          if (!isNaN(n) && n >= 0.5) onBenchHoursChange({ ...benchHours, [bench]: n });
                        }}
                        style={{
                          width: 80, fontSize: 13, padding: '6px 10px',
                          background: '#0f172a', border: '1px solid #334155',
                          borderRadius: 6, color: '#e2e8f0', outline: 'none',
                        }}
                      />
                      <span style={{ fontSize: 11, color: '#475569' }}>default {def}h</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
