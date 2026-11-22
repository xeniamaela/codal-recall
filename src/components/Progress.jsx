import { useMemo, useState } from 'react';
import { useStore, useLibrary, activeCards, deleteCard, resetCard } from '../lib/store.js';
import { DAY, startOfDay, weakness, isNew, formatInterval } from '../lib/srs.js';
import ClozeEditor from './ClozeEditor.jsx';

export default function Progress() {
  const s = useStore();
  const lib = useLibrary();
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState(null);
  const cards = activeCards(s);
  const now = Date.now();
  const today = startOfDay(now);

  const stats = useMemo(() => {
    const todayLogs = s.log.filter((l) => l.at >= today);
    const week = s.log.filter((l) => l.at >= today - 6 * DAY);
    const days = new Set(s.log.map((l) => startOfDay(l.at)));
    let streak = 0;
    for (let d = days.has(today) ? today : today - DAY; days.has(d); d -= DAY) streak++;
    const forecast = Array.from({ length: 7 }, (_, i) => {
      const end = today + (i + 1) * DAY;
      const startT = i === 0 ? -Infinity : today + i * DAY;
      return {
        label: i === 0 ? 'Today' : new Date(today + i * DAY).toLocaleDateString(undefined, { weekday: 'short' }),
        n: cards.filter((c) => !isNew(c.state) && c.state.due >= startT && c.state.due < end).length,
      };
    });
    return {
      reviewsToday: todayLogs.length,
      accuracy: week.length ? Math.round((week.filter((l) => l.grade >= 3).length / week.length) * 100) : null,
      streak,
      newCards: cards.filter((c) => isNew(c.state)).length,
      learning: cards.filter((c) => !isNew(c.state) && c.state.interval < 21).length,
      mature: cards.filter((c) => c.state.interval >= 21).length,
      forecast,
    };
  }, [s.log, cards, today]);

  const weak = cards.filter((c) => weakness(c.state) > 0).sort((a, b) => weakness(b.state) - weakness(a.state)).slice(0, 10);
  const maxF = Math.max(1, ...stats.forecast.map((f) => f.n));

  const rows = cards
    .map((c) => ({ c, p: lib.provisions.get(c.provisionId) }))
    .filter(({ p }) => !filter || `${p.label} ${p.text}`.toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) => a.c.state.due - b.c.state.due);

  return (
    <div className="progress-view">
      <div className="tiles">
        <Tile n={stats.reviewsToday} l="reviews today" />
        <Tile n={stats.accuracy == null ? '—' : `${stats.accuracy}%`} l="recall rate (7 days)" />
        <Tile n={`${stats.streak}🔥`} l="day streak" />
        <Tile n={stats.newCards} l="new" />
        <Tile n={stats.learning} l="learning" />
        <Tile n={stats.mature} l="mastered (21d+)" />
      </div>

      <section className="panel">
        <h3>Upcoming reviews</h3>
        <div className="forecast">
          {stats.forecast.map((f) => (
            <div key={f.label} className="fbar">
              <div className="fcol"><div style={{ height: `${(f.n / maxF) * 100}%` }} /></div>
              <b>{f.n}</b>
              <small>{f.label}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h3>Weakest provisions</h3>
        {weak.length === 0 ? (
          <p className="muted">Nothing weak yet. Provisions you forget will show up here.</p>
        ) : (
          <table className="tbl">
            <thead><tr><th>Provision</th><th>Card</th><th>Misses</th><th>Ease</th></tr></thead>
            <tbody>
              {weak.map((c) => {
                const p = lib.provisions.get(c.provisionId);
                return (
                  <tr key={c.id}>
                    <td><b>{lib.codeMap.get(p.codeId)?.short} {p.label}</b></td>
                    <td>{c.type === 'cloze' ? 'Blank' : 'Identify'}</td>
                    <td>{c.state.lapses}</td>
                    <td>{c.state.ease.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel">
        <div className="row between wrap">
          <h3>All cards ({cards.length})</h3>
          <input className="search" placeholder="Filter…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
        <table className="tbl">
          <thead><tr><th>Provision</th><th>Type</th><th>Next review</th><th>Interval</th><th></th></tr></thead>
          <tbody>
            {rows.map(({ c, p }) => (
              <tr key={c.id}>
                <td><b>{lib.codeMap.get(p.codeId)?.short} {p.label}</b><div className="muted clip">{p.text}</div></td>
                <td>{c.type === 'cloze' ? `Blank ×${c.blanks.length}` : 'Identify'}</td>
                <td>{isNew(c.state) ? 'new' : c.state.due <= now ? 'due now' : `in ${formatInterval(c.state.due - now)}`}</td>
                <td>{c.state.interval ? `${c.state.interval}d` : '—'}</td>
                <td className="nowrap">
                  {c.type === 'cloze' && <button className="link" onClick={() => setEditing({ c, p })}>edit</button>}
                  <button className="link" onClick={() => resetCard(c.id)}>reset</button>
                  <ConfirmButton onConfirm={() => deleteCard(c.id)}>delete</ConfirmButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {editing && <ClozeEditor provision={editing.p} card={editing.c} onClose={() => setEditing(null)} />}
    </div>
  );
}

function ConfirmButton({ onConfirm, children }) {
  const [armed, setArmed] = useState(false);
  return armed ? (
    <button className="link danger" onClick={onConfirm} onBlur={() => setArmed(false)} autoFocus>sure?</button>
  ) : (
    <button className="link danger" onClick={() => setArmed(true)}>{children}</button>
  );
}

function Tile({ n, l }) {
  return (
    <div className="tile">
      <b>{n}</b>
      <span>{l}</span>
    </div>
  );
}
