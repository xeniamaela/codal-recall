// Splits pasted codal text (e.g. copied from lawphil.net or the Official Gazette) into provisions.
// Recognises:  "Article 1156." / "Art. 1156." / "ARTICLE 1156"       -> Art. 1156
//              "ARTICLE III" (roman, Constitution) + "Section 2."      -> Art. III, Sec. 2
//              "RULE 2" + "Section 1."                                 -> Rule 2, Sec. 1
//              "BOOK / TITLE / CHAPTER / PRELIMINARY TITLE" lines        -> used as headings

const RULE_RE = /^\s*RULE\s+(\d+)\b\.?\s*(.*)$/i;
const ROMAN_ART_RE = /^\s*ARTICLE\s+([IVXLC]+)\b\.?\s*(.*)$/; // uppercase only
const ART_RE = /^\s*(?:Article|ARTICLE|Art\.?)\s+(\d+(?:-?[A-Za-z])?)\s*[.:]?\s*(.*)$/;
const SEC_RE = /^\s*(?:Section|SECTION|Sec\.?|SEC\.?)\s+(\d+(?:-?[A-Za-z])?)\s*[.:]?\s*(.*)$/;
const HEAD_RE = /^\s*(PRELIMINARY TITLE|BOOK\.?\s+[IVXLC\d]+|TITLE\.?\s+[IVXLC\d]+|CHAPTER\.?\s+[IVXLC\d]+|SUBSECTION\.?\s+\d+|PART\.?\s+[IVXLC\d]+)\b\.?\s*[-—–:]?\s*(.*)$/i;
const SOURCE_NOTE_RE = /(\s*\((?:\d+[a-z]*|n|[a-z])\))+\s*$/;

const titleCase = (s) => s.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase()).replace(/\b(Iv|Ix|Xi|Vi|Ii|Iii|Vii|Viii|Xii|Xiv|Xv|Xx)\b/g, (r) => r.toUpperCase());

export function parseCodal(raw, { stripSourceNotes = true } = {}) {
  const lines = raw.replace(/\r/g, '').split('\n');
  const out = [];
  let container = ''; // "Rule 2" or "Art. III"
  let heading = '';
  let cur = null;
  let pendingHeading = false;
  let pendingLevel = -1;
  const levels = []; // [book, title, chapter, subsection]

  const push = () => {
    if (!cur) return;
    let text = cur.text.replace(/\s+/g, ' ').trim();
    if (stripSourceNotes) text = text.replace(SOURCE_NOTE_RE, '').trim();
    if (text) out.push({ label: cur.label, heading: cur.heading, text });
    cur = null;
  };

  for (const line of lines) {
    const l = line.trim();
    if (!l) continue;
    let m;

    if ((m = l.match(RULE_RE))) {
      push();
      container = `Rule ${m[1]}`;
      heading = m[2] ? `${container} — ${m[2]}` : container;
      pendingHeading = !m[2];
      continue;
    }
    if ((m = l.match(ROMAN_ART_RE))) {
      push();
      container = `Art. ${m[1]}`;
      heading = m[2] ? `Article ${m[1]} — ${m[2]}` : `Article ${m[1]}`;
      pendingHeading = !m[2];
      continue;
    }
    if ((m = l.match(HEAD_RE)) && !ART_RE.test(l)) {
      push();
      const kind = m[1].toUpperCase().replace(/[^A-Z]/g, ' ').trim().split(/\s+/)[0]; // BOOK / TITLE / PRELIMINARY / CHAPTER ...
      const marker = m[1].replace(/\./g, '').replace(/\s+/g, ' ').trim();
      const level = { BOOK: 0, PART: 0, PRELIMINARY: 1, TITLE: 1, CHAPTER: 2, SUBSECTION: 3 }[kind] ?? 2;
      levels.length = level;
      levels[level] = m[2] ? `${titleCase(marker)} — ${m[2].trim()}` : titleCase(marker);
      heading = levels.filter(Boolean).join(' · ');
      pendingLevel = m[2] ? -1 : level;
      pendingHeading = !m[2];
      continue;
    }
    if ((m = l.match(ART_RE))) {
      push();
      container = '';
      cur = { label: `Art. ${m[1].replace('-', '-').toUpperCase()}`, heading, text: m[2] || '' };
      pendingHeading = false;
      continue;
    }
    if ((m = l.match(SEC_RE))) {
      push();
      const sec = `Sec. ${m[1].toUpperCase()}`;
      cur = { label: container ? `${container}, ${sec}` : sec, heading, text: m[2] || '' };
      pendingHeading = false;
      continue;
    }
    // A short, mostly-uppercase line right after a heading marker is the heading's name.
    if (pendingHeading && !cur && l.length < 120) {
      if (pendingLevel >= 0) {
        levels[pendingLevel] = `${levels[pendingLevel]} — ${l}`;
        heading = levels.filter(Boolean).join(' · ');
        pendingLevel = -1;
      } else heading = `${heading} — ${l}`;
      pendingHeading = false;
      continue;
    }
    if (cur) cur.text += ' ' + l;
  }
  push();

  // Make labels unique (e.g. several "Sec. 1" when no Rule/Article container was found).
  const seen = new Map();
  for (const p of out) {
    const k = p.label;
    const n = (seen.get(k) || 0) + 1;
    seen.set(k, n);
    if (n > 1) p.label = `${k} (${n})`;
  }
  return out;
}
