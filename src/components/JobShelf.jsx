import { useState } from 'react';

function ageDotColor(days) {
  if (days < 30) return '#3a9e5f';
  if (days <= 60) return '#c47d20';
  return '#c44040';
}

export default function JobShelf({ jobs, onPull }) {
  const [search, setSearch] = useState('');

  const q = search.toLowerCase();

  const filtered = jobs
    .filter(j => j.id && !j.done)
    .filter(j => {
      if (!q) return true;
      return [j.customer, j.mfr, j.model].some(v => String(v || '').toLowerCase().includes(q));
    })
    .slice()
    .sort((a, b) => (b.days ?? 0) - (a.days ?? 0));

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: '#181818', overflow: 'hidden',
    }}>
      <div style={{ padding: '12px 14px 8px' }}>
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
          color: '#444', textTransform: 'uppercase', marginBottom: 8,
        }}>
          Job shelf
        </div>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Customer, make, model…"
          style={{
            display: 'block', width: '100%', padding: '6px 10px',
            background: '#1e1e1e', border: '1px solid #252525', borderRadius: 7,
            color: '#ccc', fontSize: 13, outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 0' }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', marginTop: 32, fontSize: 13, color: '#333' }}>
            {search ? 'No jobs match' : 'No jobs'}
          </div>
        )}
        {filtered.map(job => {
          const name = job.customer
            ? `${job.customer} — ${job.mfr || ''} ${job.model || ''}`.trim()
            : `${job.mfr || ''} ${job.model || ''}`.trim();
          const sub = `${job.days ?? 0}d · ${job.action || '—'}`;
          const dotColor = ageDotColor(job.days ?? 0);

          return (
            <div
              key={job.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '7px 14px', borderBottom: '1px solid #1e1e1e',
              }}
            >
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: dotColor, flexShrink: 0,
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13, color: '#bbb', whiteSpace: 'nowrap',
                  overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {name}
                </div>
                <div style={{ fontSize: 11, color: '#555', marginTop: 1 }}>
                  {sub}
                </div>
              </div>
              <button
                onClick={() => onPull(job)}
                style={{
                  flexShrink: 0, padding: '3px 9px', borderRadius: 5,
                  border: '1px solid #252525', background: 'none',
                  color: '#444', fontSize: 11, cursor: 'pointer',
                }}
              >
                pull
              </button>
            </div>
          );
        })}
      </div>

      <div style={{
        padding: '8px 14px', borderTop: '1px solid #1e1e1e',
        fontSize: 10, color: '#2a2a2a', textAlign: 'center', letterSpacing: 0.5,
      }}>
        read only · you pull · it never pushes
      </div>
    </div>
  );
}
