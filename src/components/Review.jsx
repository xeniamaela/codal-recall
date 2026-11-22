import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStore, useLibrary, buildQueue, activeCards, answerCard, getState } from '../lib/store.js';
import { GRADES, nextLabel, weakness, isNew } from '../lib/srs.js';
import { labelMatches, wordMatches, tokenize } from '../lib/text.js';
import ClozeText from './ClozeText.jsx';
import ClozeEditor from './ClozeEditor.jsx';

export default function Review({ goBrowse }) {
  const s = useStore();
  const lib = useLibrary();
  const [session, setSession] = useState(null); // { ids: [], mode, done, correct }

  const dueQueue = useMemo(() => buildQueue(s), [s]);
  const weakCards = useMemo(
    () => activeCards(s).filter((c) => weakness(c.state) > 0).sort((a, b) => weakness(b.state) - weakness(a.state)).slice(0, 20),
    [s]
  );
  const total = activeCards(s).length;

  const start = (mode) => {
    const ids = (mode === 'weak' ? weakCards : dueQueue).map((c) => c.id);
    setSession({ ids, mode, done: 0, again: 0 });
  };

  if (session && session.ids.length) {
    return <Session session={session} setSession={setSession} lib={lib} />;
  }

  if (session && !session.ids.length) {
    return (
      <div className="panel center">
        <h2>Session complete</h2>
        <p className="big">{session.done} reviews</p>
        <p className="muted">
          {session.done ? `${Math.round(((session.done - session.again) / session.done) * 100)}% recalled on the first try` : ''}
        </p>
        <div className="row center">
          <button className="primary" onClick={() => setSession(null)}>Back</button>
        </div>
      </div>
    );
  }

  const newCount = dueQueue.filter((c) => isNew(c.state)).length;
  return (
    <div className="panel center">
      {total === 0 ? (
        <>
          <h2>No flashcards yet</h2>
          <p className="muted">Browse a codal and turn provisions into fill-in-the-blank or "What article is this?" cards.</p>
          <button className="primary" onClick={goBrowse}>Browse codals</button>
        </>
      ) : (
        <>
          <h2>Today’s review</h2>
          <div className="stat-row">
            <div className="stat"><b>{dueQueue.length - newCount}</b><span>due</span></div>
            <div className="stat"><b>{newCount}</b><span>new</span></div>
            <div className="stat"><b>{total}</b><span>total cards</span></div>
          </div>
          <div className="row center wrap">
            <button className="primary" disabled={!dueQueue.length} onClick={() => start('due')}>
              {dueQueue.length ? `Start review (${dueQueue.length})` : 'All caught up 🎉'}
            </button>
            <button className="ghost" disabled={!weakCards.length} onClick={() => start('weak')}>
              Drill weak provisions ({weakCards.length})
            </button>
          </div>
          <p className="muted small">
            Cards you miss come back in 10 minutes and then more often. Cards you know well get pushed out to days, weeks or months.
          </p>
        </>
      )}
    </div>
  );
}

function Session({ session, setSession, lib }) {
  const cards = useStore((s) => s.cards);
  const typeAnswers = useStore((s) => s.settings.typeAnswers);
  const card = cards[session.ids[0]];
  const provision = card && lib.provisions.get(card.provisionId);
  const code = provision && lib.codeMap.get(provision.codeId);

  const [revealed, setRevealed] = useState(false);
  const [answers, setAnswers] = useState({});
  const [idGuess, setIdGuess] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setRevealed(false);
    setAnswers({});
    setIdGuess('');
    setShowHint(false);
  }, [session.ids[0], session.done]);

  const skipMissing = !card || !provision;
  useEffect(() => {
    if (skipMissing) setSession((ss) => ({ ...ss, ids: ss.ids.slice(1) }));
  }, [skipMissing, setSession]);

  const grade = useCallback(
    (g) => {
      answerCard(card.id, g);
      setSession((ss) => {
        const rest = ss.ids.slice(1);
        // "Again" puts the card back at the end of this session.
        return { ...ss, ids: g === 1 ? [...rest, card.id] : rest, done: ss.done + 1, again: ss.again + (g === 1 ? 1 : 0) };
      });
    },
    [card, setSession]
  );

  // Auto-assess typed answers to suggest a grade.
  const verdict = useMemo(() => {
    if (!revealed || !card || !provision) return null;
    if (card.type === 'identify') return idGuess.trim() ? labelMatches(idGuess, provision.label) : null;
    if (!typeAnswers) return null;
    const tokens = tokenize(provision.text);
    const typed = card.blanks.filter((i) => answers[i]?.trim());
    if (!typed.length) return null;
    return card.blanks.every((i) => answers[i] && wordMatches(answers[i], tokens[i]?.t || ''));
  }, [revealed, card, provision, idGuess, answers, typeAnswers]);

  useEffect(() => {
    const onKey = (e) => {
      if (editing) return;
      const inInput = e.target.tagName === 'INPUT';
      if (!revealed && e.key === 'Enter' && !inInput) {
        e.preventDefault();
        setRevealed(true);
      } else if (revealed && !inInput) {
        const g = GRADES.find((x) => x.hotkey === e.key);
        if (g) grade(g.value);
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          grade(verdict === false ? 1 : 4);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [revealed, grade, verdict, editing]);

  if (skipMissing) return null;

  const now = Date.now();
  const progress = session.done / (session.done + session.ids.length);

  return (
    <div className="review">
      <div className="progress"><div style={{ width: `${progress * 100}%` }} /></div>
      <div className="row between small muted">
        <span>{session.mode === 'weak' ? 'Weak-provision drill' : 'Review'} · {session.ids.length} left</span>
        <button className="link" onClick={() => setSession(null)}>End session</button>
      </div>

      <div className="flashcard">
        <div className="card-meta">
          <span className="code-tag">{code?.short}</span>
          <span className="type-tag">{card.type === 'cloze' ? 'Fill in the blank' : 'What article is this?'}</span>
        </div>

        {card.type === 'cloze' ? (
          <>
            <div className="prov-label">{provision.label}</div>
            <ClozeText
              text={provision.text}
              blanks={card.blanks}
              mode={revealed ? 'reveal' : 'ask'}
              answers={answers}
              setAnswer={(i, v) => setAnswers((a) => ({ ...a, [i]: v }))}
              onEnter={() => setRevealed(true)}
              typeAnswers={typeAnswers}
            />
          </>
        ) : (
          <>
            <p className="provision-text">{provision.text}</p>
            {!revealed && (
              <div className="row wrap">
                <input
                  className="id-input"
                  autoFocus
                  placeholder={`e.g. ${provision.label.replace(/\d+/g, '___')}`}
                  value={idGuess}
                  onChange={(e) => setIdGuess(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && setRevealed(true)}
                />
                {provision.heading && !showHint && (
                  <button className="link" onClick={() => setShowHint(true)}>Show hint</button>
                )}
              </div>
            )}
            {showHint && !revealed && <p className="muted small">Hint: {provision.heading}</p>}
            {revealed && (
              <div className={`answer-label ${verdict === true ? 'ok' : verdict === false ? 'bad' : ''}`}>
                {provision.label}
                {idGuess && verdict === false && <span className="typed"> (you said: {idGuess})</span>}
                {provision.heading && <small>{provision.heading}</small>}
              </div>
            )}
          </>
        )}

        {revealed && provision.note && <p className="note">Note: {provision.note}</p>}

        {!revealed ? (
          <button className="primary wide" onClick={() => setRevealed(true)}>Show answer <kbd>Enter</kbd></button>
        ) : (
          <>
            {verdict !== null && (
              <p className={`verdict ${verdict ? 'ok' : 'bad'}`}>
                {verdict ? 'Correct. Grade yourself Good or Easy.' : 'Not quite. "Again" will bring this back soon.'}
              </p>
            )}
            <div className="grades">
              {GRADES.map((g) => (
                <button
                  key={g.key}
                  className={`grade ${g.key} ${(verdict === false && g.value === 1) || (verdict === true && g.value === 4) ? 'suggested' : ''}`}
                  onClick={() => grade(g.value)}
                >
                  <b>{g.label}</b>
                  <small>{nextLabel(card.state, g.value, now)}</small>
                  <kbd>{g.hotkey}</kbd>
                </button>
              ))}
            </div>
            {card.type === 'cloze' && (
              <button className="link small" onClick={() => setEditing(true)}>Edit blanks for this card</button>
            )}
          </>
        )}
      </div>

      {editing && <ClozeEditor provision={provision} card={getState().cards[card.id]} onClose={() => setEditing(false)} />}
    </div>
  );
}
