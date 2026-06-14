import { useEffect } from 'react';

export default function Toast({ message, onDismiss }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDismiss, 3000);
    return () => clearTimeout(t);
  }, [message, onDismiss]);

  if (!message) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      background: '#1e293b', border: '1px solid #334155',
      borderLeft: '4px solid #22c55e', borderRadius: 8,
      padding: '12px 20px', maxWidth: 380, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      color: '#e2e8f0', fontSize: 14, lineHeight: 1.5,
      animation: 'slideIn 0.2s ease',
    }}>
      <style>{`@keyframes slideIn { from { transform: translateX(100%); opacity:0 } to { transform: translateX(0); opacity:1 } }`}</style>
      {message}
      <button onClick={onDismiss} style={{
        position: 'absolute', top: 8, right: 8, background: 'none',
        border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 16,
      }}>×</button>
    </div>
  );
}
