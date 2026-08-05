import { useState, useMemo } from 'react';
import { blockedPile, blockedReason, benchColors } from '../data/jobs.js';

// A read-only board of the open work, cut two ways: by what's stopping a card,
// or by which bench it belongs to.
//
// READ-ONLY, DELIBERATELY. This page renders the `jobs` array it is handed and
// writes nothing — no Supabase call, no `scheduledSlots` touch, no mutation of
// `jobs[]`. That is the whole reason it sits outside the agent-team protocol:
// it cannot disturb live job state because it never reaches it. Anything that
// later adds dragging changes that, and goes through the full protocol.
//
// The unit on this board is a BENCH CARD, not a job. A job split across
// Fretwork and Luthier appears as two cards, one under each bench. Every
// bench filter in the app today reads the parent job's single `bench` field,
// so a Fretwork session buried inside a Luthier job is invisible — that gap is
// what this closes.

const BENCH_ORDER = ['Electronics', 'Fretwork', 'Setup', 'Luthier', 'Wiring', 'Admin'];

// Expand jobs into bench cards.
//
// A split job contributes its children, not itself — counting both would
// double the hours. Splits come in two shapes (JobsPage.getSubtasks has the
// same pair): auto-splits list child ids on the parent's `subtasks`, manual
// splits give each child a `parentId`. Children are matched by id from the
// same array, so a parent whose children were filtered out (done, say)
// falls back to contributing itself rather than vanishing.
export function toBenchCards(jobs) {
  const open = (jobs || []).filter(j => !j.done);
  const byId = new Map(open.map(j => [j.id, j]));
  const cards = [];

  for (const job of open) {
    // Children are reached through their parent, never as top-level cards.
    if (job.parentId) continue;

    let kids = [];
    if (job.hasSubtasks && Array.isArray(job.subtasks)) {
      kids = job.subtasks.map(id => byId.get(id)).filter(Boolean);
    } else if (job.isSplit) {
      kids = open.filter(j => j.parentId === job.id);
    }

    if (kids.length === 0) {
      cards.push({ card: job, parent: job, piece: null });
      continue;
    }
    for (const kid of kids) {
      // The piece keeps its own bench and hours; everything used to decide
      // which column it lands in is read off the parent, because that is
      // where status and action actually live.
      cards.push({ card: kid, parent: job, piece: kid.bench || 'piece' });
    }
  }
  return cards;
}

// Which column a card belongs in, first match wins — so every card lands in
// exactly one column and none is silently dropped.
//
// Blocked-ness is read through blockedPile()/blockedReason(), the app's single
// source of truth, rather than re-testing status and action here. Four screens
// keeping their own copy of "is this job blocked" is exactly the drift those
// functions exist to stop, and a board that disagreed with the Sidebar about
// what is workable would be worse than no board.
export function columnFor({ card, parent }) {
  if (card.calendarSlot || parent.calendarSlot) return 'bench';

  const pile = blockedPile(parent);
  if (pile === null) return 'ready';
  if (pile === 'planning') return 'thinking';

  const act = (parent.action || '').trim().toUpperCase();
  if (act === 'WP') return 'parts';
  if (act === 'CI') return 'customer';

  if (pile === 'hold') return 'parked';
  return 'other';
}

// `other` is a catch-all, not a designed column: it holds the In Transit and
// plain-Waiting cards that match none of the five named reasons. It renders
// only when it has cards in it. Without it those jobs would fall off the board
// entirely, which is the one thing a board must never do — a card you cannot
// see is worse than a card in an awkward column.
const COLUMNS = [
  { key: 'ready',    name: 'Ready to start',       colour: '#34d399' },
  { key: 'bench',    name: 'On the bench',         colour: '#fbbf24' },
  { key: 'thinking', name: 'Still working it out', colour: '#a5b4fc' },
  { key: 'parts',    name: 'Waiting on a part',    colour: '#fb923c' },
  { key: 'customer', name: 'Waiting on customer',  colour: '#f87171' },
  { key: 'parked',   name: 'Parked',               colour: '#94a3b8' },
  { key: 'other',    name: 'Waiting — other',      colour: '#64748b' },
];

// Cap on "On the bench", from the mock-up: without one the board quietly
// becomes a second backlog and gives the same crowded feeling as the calendar.
// It is a warning only — nothing is hidden, because hiding booked work would
// make the board lie about what the week holds.
const BENCH_CAP = 4;

const hrs = n => `${Math.round((n || 0) * 10) / 10}h`;
const totalHours = cards => cards.reduce((s, c) => s + (Number(c.card.hours) || 0), 0);

export default function BenchBoardPage({ jobs }) {
  const [cut, setCut] = useState('blocking');
  const cards = useMemo(() => toBenchCards(jobs), [jobs]);

  const columns = useMemo(() => {
    if (cut === 'blocking') {
      const buckets = new Map(COLUMNS.map(c => [c.key, []]));
      for (const c of cards) buckets.get(columnFor(c)).push(c);
      return COLUMNS
        .map(c => ({ ...c, cards: buckets.get(c.key) }))
        // Only the catch-all is allowed to disappear when empty. The named
        // columns stay put so the board doesn't reshuffle as work moves.
        .filter(c => c.key !== 'other' || c.cards.length > 0);
    }

    const benches = BENCH_ORDER
      .map(b => ({
        key: b,
        name: b,
        colour: benchColors(b).border,
        cards: cards.filter(c => c.card.bench === b),
      }))
      .filter(c => c.cards.length > 0);

    const none = cards.filter(c => !c.card.bench);
    if (none.length) {
      benches.push({ key: '__none', name: 'No bench set', colour: '#475569', cards: none });
    }
    return benches;
  }, [cards, cut]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#0f172a' }}>

      {/* Cut toggle + totals */}
      <div style={{ flexShrink: 0, padding: '12px 16px', borderBottom: '1px solid #1e293b' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {[
            ['blocking', "What's stopping it"],
            ['bench', 'By bench'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={cut === key}
              onClick={() => setCut(key)}
              style={{
                padding: '6px 16px', borderRadius: 20, cursor: 'pointer',
                border: `1px solid ${cut === key ? '#0369a1' : '#334155'}`,
                background: cut === key ? '#0c4a6e' : 'transparent',
                color: cut === key ? '#7dd3fc' : '#64748b',
                fontSize: 13, fontWeight: cut === key ? 700 : 400,
              }}
            >{label}</button>
          ))}
          <span style={{ color: '#475569', fontSize: 12, marginLeft: 4 }}>
            {cards.length} bench cards · {hrs(totalHours(cards))} · read-only
          </span>
        </div>
      </div>

      {/* Board */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', minHeight: '100%' }}>
          {columns.map(col => (
            <Column key={col.key} col={col} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Column({ col }) {
  const total = totalHours(col.cards);
  const over = col.key === 'bench' && col.cards.length > BENCH_CAP;

  return (
    <section style={{
      flex: '0 0 240px', background: '#0b1220', border: '1px solid #1e293b',
      borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <header style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '2px 2px 8px', borderBottom: '1px solid #1e293b',
      }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: col.colour, flexShrink: 0 }} />
        <span style={{
          flex: 1, fontSize: 11.5, fontWeight: 700, letterSpacing: '.08em',
          textTransform: 'uppercase', color: '#cbd5e1', lineHeight: 1.3,
        }}>{col.name}</span>
        <span style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>
          {col.cards.length} · {hrs(total)}
        </span>
      </header>

      {over && (
        <div style={{
          fontSize: 11, color: '#fcd34d', background: '#451a03',
          border: '1px solid #b45309', borderRadius: 4, padding: '5px 8px', lineHeight: 1.4,
        }}>
          {col.cards.length} on the bench — more than {BENCH_CAP} at once is how the week gets crowded.
        </div>
      )}

      {col.cards.length === 0 && (
        <div style={{ fontSize: 12, color: '#475569', padding: '8px 2px' }}>Nothing here.</div>
      )}

      {col.cards.map(c => <Card key={c.card.id} entry={c} colour={col.colour} />)}
    </section>
  );
}

function Card({ entry, colour }) {
  const { card, parent, piece } = entry;
  const booked = Boolean(card.calendarSlot || parent.calendarSlot);
  // The reason is the parent's — a split piece has no status of its own.
  const reason = blockedReason(parent);

  return (
    <article style={{
      background: '#1e293b', border: '1px solid #334155', borderLeft: `3px solid ${colour}`,
      borderRadius: 6, padding: '9px 10px 8px',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 2 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#f1f5f9' }}>{parent.job}</span>
        {piece && <span style={{ fontSize: 10.5, color: '#fcd34d' }}>{piece}</span>}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#64748b' }}>{hrs(card.hours)}</span>
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: '#e2e8f0', lineHeight: 1.3 }}>
        {parent.customer}
      </div>
      <div style={{ fontSize: 11.5, color: '#64748b', lineHeight: 1.35, marginTop: 1 }}>
        {[parent.mfr, parent.model].filter(Boolean).join(' ')}
      </div>

      <div style={{ display: 'flex', gap: 5, marginTop: 7, flexWrap: 'wrap' }}>
        {card.bench && <Chip colors={benchColors(card.bench)}>{card.bench}</Chip>}
        {booked && <Chip colors={{ bg: '#0c4a6e', border: '#0369a1', text: '#7dd3fc' }}>booked</Chip>}
        {/* The reason is shown on the card as well as implied by the column,
            because "waiting — see Multitrack" and "backlog" both land in the
            same column and mean different things to chase. */}
        {reason && !booked && (
          <Chip colors={{ bg: '#0f172a', border: '#334155', text: '#64748b' }}>{reason}</Chip>
        )}
      </div>
    </article>
  );
}

function Chip({ colors, children }) {
  return (
    <span style={{
      fontSize: 10, letterSpacing: '.05em', textTransform: 'uppercase', fontWeight: 600,
      padding: '2px 6px', borderRadius: 3,
      background: colors.bg, color: colors.text, border: `1px solid ${colors.border}`,
    }}>{children}</span>
  );
}
