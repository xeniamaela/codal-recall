// Local-first store. Everything is saved in localStorage so the app works offline with no account.
// If Supabase is configured, lib/sync.js mirrors cards/reviews to the cloud.
import { useSyncExternalStore } from 'react';
import { SEED_CODES } from '../data/seed.js';
import { newState, schedule, isDue, isNew, startOfDay } from './srs.js';
import { slug, numberPath } from './text.js';

const KEY = 'codal-recall:v1';

const DEFAULT = {
  v: 1,
  customCodes: [], // codes imported by the user (same shape as SEED_CODES)
  remoteCodes: [], // codes pulled from the shared Supabase library (cached for offline)
  cards: {},
  log: [],
  settings: { newPerDay: 20, typeAnswers: true },
};

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT);
    const s = JSON.parse(raw);
    return { ...structuredClone(DEFAULT), ...s, settings: { ...DEFAULT.settings, ...(s.settings || {}) } };
  } catch {
    return structuredClone(DEFAULT);
  }
}

let state = load();
const listeners = new Set();

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full or unavailable — keep working in memory */
  }
}

export function setState(updater) {
  state = typeof updater === 'function' ? updater(state) : { ...state, ...updater };
  save();
  listeners.forEach((l) => l());
}

export function getState() {
  return state;
}

export function useStore(selector = (s) => s) {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => selector(state)
  );
}

// ---------- Library (codes + provisions) ----------

function cmpLabels(a, b) {
  const pa = numberPath(a);
  const pb = numberPath(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if (pa[i] === undefined) return -1;
    if (pb[i] === undefined) return 1;
    const na = parseInt(pa[i], 10);
    const nb = parseInt(pb[i], 10);
    if (na !== nb) return na - nb;
    if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
  }
  return a.localeCompare(b);
}

let libCache = { key: null, value: null };

export function getLibrary(s = state) {
  const key = [s.customCodes, s.remoteCodes];
  if (libCache.key && libCache.key[0] === key[0] && libCache.key[1] === key[1]) return libCache.value;

  const codes = new Map();
  for (const src of [SEED_CODES, s.remoteCodes, s.customCodes]) {
    for (const c of src) {
      const existing = codes.get(c.id);
      const byLabel = new Map(existing ? existing.provisions.map((p) => [p.label, p]) : []);
      for (const p of c.provisions) {
        byLabel.set(p.label, { ...p, id: `${c.id}:${slug(p.label)}`, codeId: c.id });
      }
      codes.set(c.id, {
        id: c.id,
        name: existing?.name || c.name,
        short: existing?.short || c.short,
        law: existing?.law || c.law,
        provisions: [...byLabel.values()].sort((a, b) => cmpLabels(a.label, b.label)),
      });
    }
  }
  const provisions = new Map();
  for (const c of codes.values()) for (const p of c.provisions) provisions.set(p.id, p);
  const value = { codes: [...codes.values()], codeMap: codes, provisions };
  libCache = { key, value };
  return value;
}

export function useLibrary() {
  useStore((s) => s.customCodes);
  useStore((s) => s.remoteCodes);
  return getLibrary();
}

export function importProvisions({ codeId, name, short, law, provisions }) {
  setState((s) => {
    const others = s.customCodes.filter((c) => c.id !== codeId);
    const prev = s.customCodes.find((c) => c.id === codeId);
    const merged = new Map((prev?.provisions || []).map((p) => [p.label, p]));
    for (const p of provisions) merged.set(p.label, p);
    return {
      ...s,
      customCodes: [
        ...others,
        {
          id: codeId,
          name: name || prev?.name,
          short: short || prev?.short,
          law: law || prev?.law || '',
          provisions: [...merged.values()],
        },
      ],
    };
  });
}

export function deleteCustomCode(codeId) {
  setState((s) => ({ ...s, customCodes: s.customCodes.filter((c) => c.id !== codeId) }));
}

// ---------- Cards ----------

const uid = () =>
  (globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);

export function addCard({ provisionId, type, blanks = [] }) {
  const now = Date.now();
  const card = { id: uid(), provisionId, type, blanks, createdAt: now, updatedAt: now, deleted: false, state: newState(now) };
  setState((s) => ({ ...s, cards: { ...s.cards, [card.id]: card } }));
  return card;
}

export function updateCard(id, patch) {
  setState((s) => ({ ...s, cards: { ...s.cards, [id]: { ...s.cards[id], ...patch, updatedAt: Date.now() } } }));
}

export function deleteCard(id) {
  updateCard(id, { deleted: true });
}

export function resetCard(id) {
  updateCard(id, { state: newState() });
}

export function answerCard(id, grade) {
  const now = Date.now();
  setState((s) => {
    const card = s.cards[id];
    if (!card) return s;
    const next = { ...card, state: schedule(card.state, grade, now), updatedAt: now };
    const log = [...s.log, { id: uid(), cardId: id, grade, at: now }].slice(-5000);
    return { ...s, cards: { ...s.cards, [id]: next }, log };
  });
}

export function activeCards(s = state) {
  const lib = getLibrary(s);
  return Object.values(s.cards).filter((c) => !c.deleted && lib.provisions.has(c.provisionId));
}

/** Due reviews first (most overdue first), then new cards up to the daily limit. */
export function buildQueue(s = state, now = Date.now()) {
  const cards = activeCards(s);
  const today = startOfDay(now);
  // Cards whose very first review happened today count against the new-cards-per-day limit.
  const firstSeen = new Map();
  for (const l of s.log) if (!firstSeen.has(l.cardId)) firstSeen.set(l.cardId, l.at);
  let introducedToday = 0;
  for (const at of firstSeen.values()) if (at >= today) introducedToday++;
  const due = cards.filter((c) => !isNew(c.state) && isDue(c.state, now)).sort((a, b) => a.state.due - b.state.due);
  const fresh = cards
    .filter((c) => isNew(c.state))
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(0, Math.max(0, s.settings.newPerDay - introducedToday));
  return [...due, ...fresh];
}

export function exportBackup() {
  return JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2);
}

export function restoreBackup(json) {
  const data = JSON.parse(json);
  if (!data || typeof data !== 'object' || !data.cards) throw new Error('Not a Codal Recall backup file.');
  setState({ ...structuredClone(DEFAULT), ...data, settings: { ...DEFAULT.settings, ...(data.settings || {}) } });
}
