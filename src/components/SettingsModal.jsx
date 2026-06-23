import { useState } from 'react';

const BENCHES = ['Fretwork', 'Luthier', 'Electronics', 'Setup', 'Wiring'];

const BENCH_ACCENT = {
  Fretwork:    '#a78bfa',
  Luthier:     '#34d399',
  Electronics: '#60a5fa',
  Setup:       '#fbbf24',
};

function KeywordEditor({ bench, keywords, defaultKeywords, onChange }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const effective = keywords[bench] ?? defaultKeywords[bench] ?? [];
  const isDefault = !keywords[bench];

  function add() {
    const val = input.trim().toLowerCase();
    if (!val || effective.includes(val)) { setInput(''); return; }
    onChange(bench, [...effective, val]);
    setInput('');
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
            {effective.map(kw => (
              <span key={kw} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 11, padding: '2px 7px', borderRadius: 4,
                background: '#1e293b', border: '1px solid #334155', color: '#cbd5e1',
              }}>
                {kw}
                <button onClick={() => remove(kw)} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#64748b', fontSize: 12, lineHeight: 1, padding: 0,
                }}>×</button>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && add()}
              placeholder="add keyword…"
              style={{
                flex: 1, fontSize: 12, padding: '4px 8px',
                background: '#0f172a', border: '1px solid #334155',
                borderRadius: 5, color: '#e2e8f0', outline: 'none',
              }}
            />
            <button onClick={add} style={{
              padding: '4px 10px', background: '#1e3a5f', border: '1px solid #2563eb',
              borderRadius: 5, color: '#bfdbfe', fontSize: 12, cursor: 'pointer',
            }}>Add</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SettingsModal({
  changelog, onClose, isSignedIn, onSignIn, onSignOut, isConfigured,
  benchKeywords = {}, defaultBenchKeywords = {}, onBenchKeywordsChange,
  hourlyRate = 85, onHourlyRateChange,
  weeklyRevenueTarget = 1500, onWeeklyTargetChange,
}) {
  const [activeTab, setActiveTab] = useState('keywords');
  const [rateInput, setRateInput] = useState(String(hourlyRate));
  const [targetInput, setTargetInput] = useState(String(weeklyRevenueTarget));

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
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: '#1e293b', border: '1px solid #334155', borderRadius: 12,
        width: 560, maxHeight: '85vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0' }}>Settings</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #334155' }}>
          {['keywords', 'rates', 'calendar', 'changelog'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: '10px 18px', background: 'none', border: 'none',
              borderBottom: activeTab === tab ? '2px solid #3b82f6' : '2px solid transparent',
              color: activeTab === tab ? '#e2e8f0' : '#64748b',
              fontSize: 13, fontWeight: activeTab === tab ? 600 : 400,
              cursor: 'pointer', textTransform: 'capitalize',
            }}>{tab}</button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

          {activeTab === 'keywords' && (
            <div>
              <p style={{ fontSize: 12, color: '#64748b', marginBottom: 16, lineHeight: 1.5 }}>
                Keywords in job descriptions that determine bench assignment. Edit to add your own terms. Changes re-classify all jobs immediately.
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
            </div>
          )}

          {activeTab === 'calendar' && (
            <div>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 10 }}>Google Calendar</h3>
              {!isConfigured ? (
                <div style={{ padding: '10px 14px', background: '#0f172a', borderRadius: 8, border: '1px solid #334155' }}>
                  <p style={{ fontSize: 12, color: '#f87171', marginBottom: 8 }}>
                    ⚠ Google API credentials not configured. Add VITE_GOOGLE_CLIENT_ID and VITE_GOOGLE_API_KEY to your .env file.
                  </p>
                  <p style={{ fontSize: 11, color: '#64748b' }}>
                    1. Go to Google Cloud Console → APIs & Services → Credentials<br/>
                    2. Create OAuth 2.0 Client ID (Web application)<br/>
                    3. Add authorized origin: https://guitargaragenz.github.io<br/>
                    4. Create API Key restricted to Calendar API<br/>
                    5. Add to .env.local: VITE_GOOGLE_CLIENT_ID=... VITE_GOOGLE_API_KEY=...
                  </p>
                </div>
              ) : isSignedIn ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 13, color: '#22c55e' }}>✓ Connected to guitargaragenz@gmail.com</span>
                  <button onClick={onSignOut} style={{
                    padding: '5px 12px', background: '#7f1d1d', border: '1px solid #ef4444',
                    borderRadius: 6, color: '#fca5a5', fontSize: 12, cursor: 'pointer',
                  }}>Sign Out</button>
                </div>
              ) : (
                <button onClick={onSignIn} style={{
                  padding: '8px 16px', background: '#1e3a5f', border: '1px solid #2563eb',
                  borderRadius: 6, color: '#bfdbfe', fontSize: 13, cursor: 'pointer', fontWeight: 600,
                }}>
                  Connect Google Calendar
                </button>
              )}
            </div>
          )}

          {activeTab === 'changelog' && (
            <div>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 10 }}>Changelog</h3>
              {changelog.length === 0 ? (
                <p style={{ color: '#475569', fontSize: 13 }}>No changes yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[...changelog].reverse().map((entry, i) => (
                    <div key={i} style={{
                      padding: '8px 12px', background: '#0f172a', borderRadius: 6,
                      borderLeft: '3px solid #334155', fontSize: 12, color: '#94a3b8',
                    }}>
                      <span style={{ color: '#64748b', marginRight: 8 }}>
                        {entry.date || new Date(entry.ts).toLocaleDateString('en-NZ')}
                      </span>
                      {entry.note || entry.msg}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
