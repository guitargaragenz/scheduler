import { useState, useRef, useEffect } from 'react';
import { HELP_ARTICLES, SECTIONS } from '../data/helpArticles.js';

const SECTION_COLORS = {
  'Scheduler':       { bg: '#0f2044', accent: '#3b82f6', label: '#93c5fd' },
  'Sidebar':         { bg: '#0f2044', accent: '#6366f1', label: '#a5b4fc' },
  'Pomodoro':        { bg: '#0f2044', accent: '#f59e0b', label: '#fcd34d' },
  'Parts Inventory': { bg: '#0f2044', accent: '#10b981', label: '#6ee7b7' },
  'CSV Pipeline':    { bg: '#0f2044', accent: '#64748b', label: '#94a3b8' },
  'Settings':        { bg: '#0f2044', accent: '#475569', label: '#94a3b8' },
};

function highlight(text, query) {
  if (!query) return text;
  const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.split(re).map((part, i) =>
    re.test(part)
      ? <mark key={i} style={{ background: '#854d0e', color: '#fef3c7', borderRadius: 2, padding: '0 1px' }}>{part}</mark>
      : part
  );
}

export default function HelpDrawer({ onClose }) {
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState(null);
  const [section, setSection] = useState('All');
  const searchRef = useRef(null);

  useEffect(() => { searchRef.current?.focus(); }, []);

  const q = search.toLowerCase().trim();

  const filtered = HELP_ARTICLES.filter(a => {
    if (section !== 'All' && a.section !== section) return false;
    if (!q) return true;
    return (
      a.title.toLowerCase().includes(q) ||
      a.body.toLowerCase().includes(q) ||
      a.keywords.some(k => k.toLowerCase().includes(q)) ||
      a.section.toLowerCase().includes(q)
    );
  });

  // Auto-expand when only one result
  useEffect(() => {
    if (filtered.length === 1) setOpenId(filtered[0].id);
    else if (q === '') setOpenId(null);
  }, [q, section]);

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, width: 460, height: '100vh',
      background: '#0a1628', borderLeft: '1px solid #1e3a5f',
      display: 'flex', flexDirection: 'column', zIndex: 200,
      fontFamily: 'system-ui, sans-serif',
      boxShadow: '-8px 0 32px rgba(0,0,0,0.6)',
    }}>

      {/* Header */}
      <div style={{
        padding: '16px 18px 12px', borderBottom: '1px solid #1e3a5f',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#e2e8f0', letterSpacing: -0.3 }}>
            Help & Reference
          </div>
          <div style={{ fontSize: 11, color: '#475569', marginTop: 1 }}>
            {filtered.length} of {HELP_ARTICLES.length} articles
          </div>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 20, cursor: 'pointer', padding: '2px 6px' }}
        >×</button>
      </div>

      {/* Search */}
      <div style={{ padding: '12px 18px 0', flexShrink: 0 }}>
        <input
          ref={searchRef}
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search — try 'low stock', 'drag', 'PB tag', 'CSV'…"
          style={{
            width: '100%', boxSizing: 'border-box',
            background: '#1e293b', border: '1px solid #334155',
            borderRadius: 6, padding: '8px 12px', fontSize: 13,
            color: '#e2e8f0', outline: 'none',
          }}
        />
      </div>

      {/* Section pills */}
      <div style={{
        padding: '10px 18px 12px', borderBottom: '1px solid #1e3a5f',
        display: 'flex', flexWrap: 'wrap', gap: 6, flexShrink: 0,
      }}>
        {['All', ...SECTIONS].map(s => (
          <button
            key={s}
            onClick={() => setSection(s)}
            style={{
              fontSize: 10, padding: '3px 9px', borderRadius: 99, cursor: 'pointer', border: 'none',
              background: section === s
                ? (SECTION_COLORS[s]?.accent || '#1d4ed8')
                : '#1e293b',
              color: section === s
                ? '#fff'
                : '#64748b',
              fontWeight: section === s ? 700 : 400,
            }}
          >{s}</button>
        ))}
      </div>

      {/* Articles */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.length === 0 && (
          <div style={{ padding: 28, textAlign: 'center', color: '#475569', fontSize: 13 }}>
            No articles match "{search}"
          </div>
        )}

        {filtered.map(article => {
          const isOpen = openId === article.id;
          const colors = SECTION_COLORS[article.section] || SECTION_COLORS['Settings'];

          return (
            <div
              key={article.id}
              style={{ borderBottom: '1px solid #0f1e35' }}
            >
              {/* Title row */}
              <button
                onClick={() => setOpenId(isOpen ? null : article.id)}
                style={{
                  width: '100%', textAlign: 'left', background: 'none', border: 'none',
                  padding: '11px 18px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}
              >
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
                  background: isOpen ? colors.accent : '#1e293b',
                  color: isOpen ? '#fff' : colors.label,
                  flexShrink: 0, letterSpacing: 0.3, textTransform: 'uppercase',
                }}>
                  {article.section}
                </span>
                <span style={{
                  fontSize: 13, fontWeight: 600,
                  color: isOpen ? '#e2e8f0' : '#94a3b8',
                  flex: 1,
                }}>
                  {highlight(article.title, q)}
                </span>
                <span style={{ color: '#334155', fontSize: 12, flexShrink: 0 }}>
                  {isOpen ? '▲' : '▼'}
                </span>
              </button>

              {/* Body */}
              {isOpen && (
                <div style={{
                  padding: '0 18px 16px 18px',
                  borderTop: `1px solid ${colors.accent}22`,
                }}>
                  {article.body.split('\n').map((line, i) => {
                    if (!line.trim()) return <div key={i} style={{ height: 8 }} />;
                    const isBullet = line.trimStart().startsWith('•');
                    return (
                      <div key={i} style={{
                        fontSize: 12, lineHeight: 1.7,
                        color: isBullet ? '#94a3b8' : '#64748b',
                        paddingLeft: isBullet ? 0 : 0,
                        marginTop: isBullet ? 2 : 0,
                        fontFamily: line.match(/^\s{2,}/) ? 'monospace' : 'system-ui, sans-serif',
                      }}>
                        {highlight(line, q)}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
