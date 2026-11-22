import { useState } from 'react';
import ClozeText from './ClozeText.jsx';
import { autoBlanks } from '../lib/text.js';
import { addCard, updateCard } from '../lib/store.js';

export default function ClozeEditor({ provision, card, onClose }) {
  const [blanks, setBlanks] = useState(() => card?.blanks ?? autoBlanks(provision.text, undefined, provision.heading));
  const toggle = (i) => setBlanks((b) => (b.includes(i) ? b.filter((x) => x !== i) : [...b, i].sort((a, z) => a - z)));

  const save = () => {
    if (card) updateCard(card.id, { blanks });
    else addCard({ provisionId: provision.id, type: 'cloze', blanks });
    onClose(true);
  };

  return (
    <div className="modal-backdrop" onClick={() => onClose(false)}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Fill-in-the-blank editor">
        <h3>
          {card ? 'Edit' : 'New'} fill-in-the-blank · <span className="muted">{provision.label}</span>
        </h3>
        <p className="hint">Tap words to hide or show them. Hide the words you need to memorize.</p>
        <div className="editor-box">
          <ClozeText text={provision.text} blanks={blanks} mode="edit" onToggle={toggle} />
        </div>
        <div className="row between">
          <div className="row">
            <button className="ghost" onClick={() => setBlanks(autoBlanks(provision.text, undefined, provision.heading))}>Auto-pick</button>
            <button className="ghost" onClick={() => setBlanks(autoBlanks(provision.text, Math.min(blanks.length + 1, 8), provision.heading))}>
              More blanks
            </button>
            <button className="ghost" onClick={() => setBlanks([])}>Clear</button>
          </div>
          <div className="row">
            <button className="ghost" onClick={() => onClose(false)}>Cancel</button>
            <button className="primary" disabled={!blanks.length} onClick={save}>
              Save card ({blanks.length} blank{blanks.length === 1 ? '' : 's'})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
