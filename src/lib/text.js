// Tokenising, auto-blank selection and answer checking.

const TOKEN_RE = /[\p{L}\p{N}][\p{L}\p{N}'’-]*|[^\p{L}\p{N}]+/gu;

export function tokenize(text) {
  return (text.match(TOKEN_RE) || []).map((t) => ({ t, word: /^[\p{L}\p{N}]/u.test(t) }));
}

const STOP = new Set(
  ('a an the and or nor but of to in on at by for with from as is are was were be been being this that these ' +
    'those it its his her their he she they them who whom which what when where shall may must not no any all ' +
    'such other than upon under into unless provided same said also only either neither there here so if then ' +
    'one two three four five first second third has have had do does done would should could will can after before ' +
    'following person persons law laws article section').split(' ')
);

// Words that are usually the "point" of a provision — preferred as blanks.
const KEY = new Set(
  ('juridical necessity give do obligation obligations contract contracts quasi-contracts quasi-delicts quasi-delict ' +
    'consent object cause fault negligence deceit dolo culpa felony felonies consummated frustrated attempted ' +
    'conspiracy proposal aggression necessity provocation retroactive waived waiver ignorance repealed void voidable ' +
    'judicial decisions justice honesty good faith damage indemnify compensate morals customs policy ownership ' +
    'determinate price certain money due process equal protection probable cause personally searches seizures ' +
    'privacy inadmissible jeopardy just compensation sovereignty democratic republican grave abuse discretion ' +
    'liberally construed just speedy inexpensive real party interest relevant excluded psychologically incapacitated ' +
    'special permanent union inviolable fifteen publication theft intent gain reclusion temporal homicide').split(' ')
);

export function autoBlanks(text, count, heading = '') {
  const topic = new Set((heading.toLowerCase().match(/[a-z]+/g) || []).map((w) => w.replace(/s$/, '')));
  const tokens = tokenize(text);
  const words = tokens.map((tk, i) => ({ ...tk, i })).filter((tk) => tk.word);
  const n = count ?? Math.min(5, Math.max(words.length >= 8 ? 2 : 1, Math.round(words.length / 12)));
  const scored = words
    .filter((w) => !STOP.has(w.t.toLowerCase()) && w.t.length >= 3 && !/^\d+$/.test(w.t))
    .map((w) => {
      const lw = w.t.toLowerCase();
      const inTopic = topic.has(lw.replace(/s$/, ''));
      return { i: w.i, lw, score: (KEY.has(lw) ? 10 : 0) + Math.min(w.t.length, 12) - (inTopic ? 8 : 0) + (w.i % 7) * 0.01 };
    })
    .sort((a, b) => b.score - a.score);
  const seen = new Set();
  const picked = [];
  for (const s of scored) {
    if (seen.has(s.lw)) continue;
    seen.add(s.lw);
    picked.push(s.i);
    if (picked.length >= n) break;
  }
  return picked.sort((a, b) => a - b);
}

export function norm(s) {
  return s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
}

function lev(a, b) {
  if (a === b) return 0;
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

/** Lenient word match: case/punctuation-insensitive, allows one typo on longer words. */
export function wordMatches(input, answer) {
  const a = norm(input);
  const b = norm(answer);
  if (!a) return false;
  if (a === b) return true;
  return b.length >= 5 && lev(a, b) <= 1;
}

const ROMAN = { i: 1, v: 5, x: 10, l: 50, c: 100 };
function romanToInt(s) {
  let total = 0;
  for (let k = 0; k < s.length; k++) {
    const v = ROMAN[s[k]];
    const next = ROMAN[s[k + 1]] || 0;
    total += v < next ? -v : v;
  }
  return total;
}

/** "Art. III, Sec. 2" -> [3, 2];  "art 1156" -> [1156];  "Rule 110 sec 1" -> [110, 1] */
export function numberPath(s) {
  const out = [];
  for (const tok of s.toLowerCase().split(/[^a-z0-9]+/)) {
    if (!tok) continue;
    if (/^\d+$/.test(tok)) out.push(Number(tok));
    else if (/^\d+[a-z]$/.test(tok)) out.push(tok); // e.g. 266-A -> "266a" handled below
    else if (/^[ivxlc]+$/.test(tok) && tok.length <= 7) out.push(romanToInt(tok));
    else if (/^[a-z]$/.test(tok) && out.length && typeof out[out.length - 1] === 'number') {
      // suffix letter, e.g. "266-A"
      out[out.length - 1] = `${out[out.length - 1]}${tok}`;
    }
  }
  return out.map(String);
}

export function labelMatches(input, label) {
  const a = numberPath(input);
  const b = numberPath(label);
  return a.length > 0 && a.length === b.length && a.every((x, i) => x === b[i]);
}

export function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
