import { useMemo, useState } from 'react';
import { useLibrary, useStore, addCard } from '../lib/store.js';
import { autoBlanks } from '../lib/text.js';
import ClozeEditor from './ClozeEditor.jsx';

export default function Browse() {
  const lib = useLibrary();
  const cards = useStore((s) => s.cards);
  const [codeId, setCodeId] = useState(lib.codes[0]?.id);
  const [q, setQ] = useState('');
  const [allCodes, setAllCodes] = useState(false);
  const [editing, setEditing] = useState(null);
  const [toast, setToast] = useState('');

  const code = lib.codeMap.get(codeId) || lib.codes[0];

  const byProvision = useMemo(() => {
    const m = new Map();
    for (const c of Object.values(cards)) {
      if (c.deleted) continue;
      if (!m.has(c.provisionId)) m.set(c.provisionId, []);
      m.get(c.provisionId).push(c);
    }
    return m;
  }, [cards]);

  const list = useMemo(() => {
    const src = allCodes ? lib.codes.flatMap((c) => c.provisions) : code?.provisions || [];
    const needle = q.trim().toLowerCase();
    if (!needle) return src;
    return src.filter((p) => `${p.label} ${p.heading} ${p.text}`.toLowerCase().includes(needle));
  }, [lib, code, q, allCodes]);

  const flash = (m) => {
    setToast(m);
    setTimeout(() => setToast(''), 1800);
  };

  const addIdentify = (p) => {
    addCard({ provisionId: p.id, type: 'identify' });
    flash(`"What article is this?" card added for ${p.label}`);
  };

  const addAll = () => {
    let n = 0;
    for (const p of list) {
      const existing = byProvision.get(p.id) || [];
      if (!existing.some((c) => c.type === 'cloze')) {
        addCard({ provisionId: p.id, type: 'cloze', blanks: autoBlanks(p.text, undefined, p.heading) });
        n++;
      }
      if (!existing.some((c) => c.type === 'identify')) {
        addCard({ provisionId: p.id, type: 'identify' });
        n++;
      }
    }
    flash(n ? `Added ${n} cards` : 'All shown provisions already have both card types');
  };

  let lastHeading = null;

  return (
    <div className="browse">
      <aside className="codes">
        {lib.codes.map((c) => (
          <button
            key={c.id}
            className={!allCodes && c.id === code?.id ? 'active' : ''}
            onClick={() => {
              setCodeId(c.id);
              setAllCodes(false);
            }}
          >
            <span>{c.short}</span>
            <small>{c.provisions.length}</small>
          </button>
        ))}
      </aside>

      <section className="provisions">
        <div className="browse-head">
          <div>
            <h2>{allCodes ? 'All codals' : code?.name}</h2>
            {!allCodes && code?.law && <p className="muted small">{code.law}</p>}
          </div>
          <div className="row wrap">
            <input
              className="search"
              placeholder="Search text, article no., topic…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <label className="check">
              <input type="checkbox" checked={allCodes} onChange={(e) => setAllCodes(e.target.checked)} /> all codals
            </label>
            <button className="ghost" onClick={addAll} disabled={!list.length}>
              + Cards for all {list.length} shown
            </button>
          </div>
        </div>

        {list.length === 0 && <p className="empty">No provisions match. Try another search, or import more codal text.</p>}

        {list.map((p) => {
          const showHeading = !allCodes && p.heading && p.heading !== lastHeading;
          lastHeading = p.heading;
          const existing = byProvision.get(p.id) || [];
          const hasId = existing.some((c) => c.type === 'identify');
          const nCloze = existing.filter((c) => c.type === 'cloze').length;
          return (
            <div key={p.id}>
              {showHeading && <h4 className="heading">{p.heading}</h4>}
              <article className="provision">
                <div className="prov-label">
                  {allCodes && <span className="code-tag">{lib.codeMap.get(p.codeId)?.short}</span>}
                  {p.label}
                </div>
                <p className="provision-text">{p.text}</p>
                {p.note && <p className="note">Note: {p.note}</p>}
                <div className="row wrap actions">
                  <button className="small" onClick={() => setEditing(p)}>
                    + Fill-in-the-blank{nCloze ? ` (${nCloze})` : ''}
                  </button>
                  <button className="small" disabled={hasId} onClick={() => addIdentify(p)}>
                    {hasId ? '✓ "What article?" added' : '+ "What article is this?"'}
                  </button>
                </div>
              </article>
            </div>
          );
        })}
      </section>

      {editing && (
        <ClozeEditor
          provision={editing}
          onClose={(saved) => {
            if (saved) flash(`Fill-in-the-blank card added for ${editing.label}`);
            setEditing(null);
          }}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
