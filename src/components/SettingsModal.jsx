export default function SettingsModal({ changelog, onClose, isSignedIn, onSignIn, onSignOut, isConfigured }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: '#1e293b', border: '1px solid #334155', borderRadius: 12,
        width: 540, maxHeight: '80vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0' }}>Settings</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ padding: '16px 20px', borderBottom: '1px solid #334155' }}>
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

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
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
                    {new Date(entry.ts).toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {entry.msg}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
