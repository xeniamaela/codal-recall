import { useMemo } from 'react';
import { tokenize, wordMatches } from '../lib/text.js';

/**
 * Renders provision text with blanks.
 * mode="ask":    blanks become inputs (or "____" when typing is off)
 * mode="reveal": blanks show the answer, green/red if the user typed something
 * mode="edit":   every word is clickable to toggle a blank
 */
export default function ClozeText({ text, blanks, mode, answers = {}, setAnswer, onToggle, onEnter, typeAnswers = true }) {
  const tokens = useMemo(() => tokenize(text), [text]);
  const set = new Set(blanks);
  let firstInput = true;

  return (
    <p className={`provision-text cloze ${mode}`}>
      {tokens.map((tk, i) => {
        if (mode === 'edit') {
          if (!tk.word) return <span key={i}>{tk.t}</span>;
          return (
            <span key={i} className={`tok ${set.has(i) ? 'sel' : ''}`} onClick={() => onToggle(i)}>
              {tk.t}
            </span>
          );
        }
        if (!set.has(i)) return <span key={i}>{tk.t}</span>;
        if (mode === 'ask') {
          if (!typeAnswers) return <span key={i} className="blank">{'_'.repeat(Math.max(4, Math.min(tk.t.length, 12)))}</span>;
          const auto = firstInput;
          firstInput = false;
          return (
            <input
              key={i}
              className="blank-input"
              style={{ width: `${Math.max(4, tk.t.length + 1)}ch` }}
              value={answers[i] || ''}
              autoFocus={auto}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              aria-label="blank"
              onChange={(e) => setAnswer(i, e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onEnter?.()}
            />
          );
        }
        const typed = answers[i];
        const cls = typed == null || typed === '' ? 'ans' : wordMatches(typed, tk.t) ? 'ans ok' : 'ans bad';
        return (
          <span key={i} className={cls} title={typed ? `You wrote: ${typed}` : undefined}>
            {tk.t}
            {typed && !wordMatches(typed, tk.t) && <s className="typed">{typed}</s>}
          </span>
        );
      })}
    </p>
  );
}
