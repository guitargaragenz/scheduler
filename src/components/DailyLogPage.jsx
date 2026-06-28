import { useState, useRef, useEffect } from 'react';
import JobShelf from './JobShelf';

const DATE_LABEL = new Date().toLocaleDateString('en-NZ', {
  weekday: 'long', day: 'numeric', month: 'long',
});

function Bullet({ bullet, locked, onToggle }) {
  const done = bullet.done;
  return (
    <div
      onClick={() => !locked && onToggle(bullet.id)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        padding: '7px 0', cursor: locked ? 'default' : 'pointer',
        borderBottom: '1px solid #161616',
      }}
    >
      <div style={{
        width: 6, height: 6, borderRadius: '50%',
        background: done ? '#2a2a2a' : '#555',
        flexShrink: 0, marginTop: 6,
      }} />
      <div style={{
        flex: 1, fontSize: 14, lineHeight: 1.5,
        color: done ? '#3a3a3a' : '#ccc',
        textDecoration: done ? 'line-through' : 'none',
      }}>
        {bullet.text}
      </div>
      <div style={{
        fontSize: 12, color: done ? '#2a2a2a' : '#222',
        flexShrink: 0, marginTop: 3, userSelect: 'none',
      }}>
        {done ? '✓' : '○'}
      </div>
    </div>
  );
}

export default function DailyLogPage({ jobs, todayLog, onAddBullet, onToggleDone, onRequestCloseDay }) {
  const [input, setInput] = useState('');
  const [shelfOpen, setShelfOpen] = useState(false);
  const inputRef = useRef(null);

  const bullets = todayLog?.bullets || [];
  const locked = !!todayLog?.locked;
  const hasBullets = bullets.length > 0;

  useEffect(() => {
    if (!locked) inputRef.current?.focus();
  }, [locked]);

  function handleKeyDown(e) {
    if (e.key === 'Enter' && input.trim()) {
      onAddBullet(input.trim(), null);
      setInput('');
    }
  }

  function handlePull(job) {
    const text = `${job.customer ? job.customer + ' — ' : ''}${job.mfr} ${job.model}`;
    onAddBullet(text, job.id);
  }

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const leftPanel = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        padding: '24px 24px 16px', flexShrink: 0, borderBottom: '1px solid #1a1a1a',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 22, fontWeight: 600, color: '#e0e0e0', lineHeight: 1.2 }}>
              {DATE_LABEL}
            </div>
            {locked && (
              <span style={{
                fontSize: 10, color: '#444', background: '#1a1a1a',
                border: '1px solid #2a2a2a', borderRadius: 4, padding: '2px 7px',
              }}>
                Locked
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: '#444', marginTop: 4 }}>Today's log</div>
        </div>

        {hasBullets && !locked && (
          <button
            onClick={onRequestCloseDay}
            style={{
              border: '1px solid #2a2a2a', borderRadius: 20, padding: '5px 14px',
              fontSize: 11, color: '#555', background: 'none', cursor: 'pointer',
              flexShrink: 0, marginTop: 4,
            }}
          >
            Close day
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 24px' }}>
        {bullets.length === 0 ? (
          <div style={{
            color: '#2a2a2a', fontStyle: 'italic', fontSize: 13,
            padding: '24px 0', textAlign: 'center',
          }}>
            · pull a job from the shelf, or type a note ·
          </div>
        ) : (
          bullets.map(b => (
            <Bullet key={b.id} bullet={b} locked={locked} onToggle={onToggleDone} />
          ))
        )}
      </div>

      <div style={{ padding: '12px 24px 20px', flexShrink: 0, borderTop: '1px solid #1a1a1a' }}>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={locked}
          placeholder="quick note — hit enter"
          style={{
            width: '100%', boxSizing: 'border-box',
            background: locked ? '#141414' : '#1a1a1a',
            border: '1px solid #2a2a2a', borderRadius: 8,
            padding: '10px 14px', fontSize: 14,
            color: locked ? '#333' : '#ccc',
            outline: 'none', cursor: locked ? 'not-allowed' : 'text',
          }}
        />
      </div>
    </div>
  );

  const rightPanel = (
    <div style={{ height: '100%', overflow: 'hidden', borderLeft: '1px solid #1a1a1a' }}>
      <JobShelf jobs={jobs} onPull={handlePull} />
    </div>
  );

  const mobileShelf = (
    <div style={{ borderTop: '1px solid #1a1a1a' }}>
      <button
        onClick={() => setShelfOpen(o => !o)}
        style={{
          width: '100%', background: 'none', border: 'none',
          borderBottom: shelfOpen ? '1px solid #1a1a1a' : 'none',
          padding: '12px 20px', fontSize: 12, color: '#555',
          cursor: 'pointer', textAlign: 'left',
          display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        <span>Job shelf</span>
        <span style={{ fontSize: 10 }}>{shelfOpen ? '↑' : '↓'}</span>
      </button>
      {shelfOpen && (
        <div style={{ height: 320, overflow: 'hidden' }}>
          <JobShelf jobs={jobs} onPull={handlePull} />
        </div>
      )}
    </div>
  );

  return (
    <div style={{
      flex: 1, background: '#111', color: '#ccc',
      display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0,
    }}>
      <div style={{
        flex: 1,
        display: isMobile ? 'flex' : 'grid',
        gridTemplateColumns: isMobile ? undefined : '1fr 280px',
        flexDirection: isMobile ? 'column' : undefined,
        minHeight: 0, overflow: 'hidden',
      }}>
        <div style={{
          minHeight: 0, overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          flex: isMobile ? '1 1 auto' : undefined,
        }}>
          {leftPanel}
        </div>
        {!isMobile && rightPanel}
      </div>
      {isMobile && mobileShelf}
    </div>
  );
}
