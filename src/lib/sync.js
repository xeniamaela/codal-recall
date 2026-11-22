// Optional cloud sync via Supabase (free tier). Active only when VITE_SUPABASE_URL and
// VITE_SUPABASE_ANON_KEY are set. Strategy: last-write-wins per card using updatedAt.
import { getState, setState } from './store.js';

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const syncConfigured = Boolean(URL && KEY);

let clientPromise = null;
export function getClient() {
  if (!syncConfigured) return null;
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) => createClient(URL, KEY));
  }
  return clientPromise;
}

export async function signIn(email) {
  const sb = await getClient();
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
  if (error) throw error;
}

export async function signOut() {
  const sb = await getClient();
  await sb.auth.signOut();
}

export async function onAuthChange(cb) {
  const sb = await getClient();
  if (!sb) return () => {};
  const { data } = await sb.auth.getSession();
  cb(data.session?.user ?? null);
  const { data: sub } = sb.auth.onAuthStateChange((_e, session) => cb(session?.user ?? null));
  return () => sub.subscription.unsubscribe();
}

const iso = (ms) => (ms == null ? null : new Date(ms).toISOString());
const ms = (s) => (s == null ? null : new Date(s).getTime());

function toRow(c, userId) {
  return {
    id: c.id,
    user_id: userId,
    provision_id: c.provisionId,
    type: c.type,
    blanks: c.blanks,
    created_at: iso(c.createdAt),
    updated_at: iso(c.updatedAt),
    deleted: !!c.deleted,
    ease: c.state.ease,
    interval_days: c.state.interval,
    reps: c.state.reps,
    lapses: c.state.lapses,
    due: iso(c.state.due),
    last_reviewed: iso(c.state.last),
  };
}

function fromRow(r) {
  return {
    id: r.id,
    provisionId: r.provision_id,
    type: r.type,
    blanks: r.blanks || [],
    createdAt: ms(r.created_at),
    updatedAt: ms(r.updated_at),
    deleted: r.deleted,
    state: {
      ease: r.ease,
      interval: r.interval_days,
      reps: r.reps,
      lapses: r.lapses,
      due: ms(r.due),
      last: ms(r.last_reviewed),
    },
  };
}

async function selectAll(sb, table, build) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(sb.from(table).select('*')).range(from, from + 999);
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

/** Pull the shared codal library (codes + provisions tables). */
export async function pullLibrary() {
  const sb = await getClient();
  const codes = await selectAll(sb, 'codes', (q) => q.order('id'));
  const provs = await selectAll(sb, 'provisions', (q) => q.order('code_id').order('sort'));
  const remoteCodes = codes.map((c) => ({
    id: c.id,
    name: c.name,
    short: c.short,
    law: c.law,
    provisions: provs
      .filter((p) => p.code_id === c.id)
      .map((p) => ({ label: p.label, heading: p.heading || '', text: p.text, note: p.note || undefined })),
  }));
  setState((s) => ({ ...s, remoteCodes }));
  return remoteCodes.reduce((n, c) => n + c.provisions.length, 0);
}

/** Two-way sync of cards + push of review log. Returns a short summary. */
export async function syncNow() {
  const sb = await getClient();
  const { data: auth } = await sb.auth.getUser();
  const user = auth?.user;
  if (!user) throw new Error('Sign in first.');

  const remoteRows = await selectAll(sb, 'cards', (q) => q.eq('user_id', user.id));
  const remote = new Map(remoteRows.map((r) => [r.id, fromRow(r)]));
  const local = getState().cards;

  const merged = { ...local };
  let pulled = 0;
  for (const [id, rc] of remote) {
    if (!local[id] || rc.updatedAt > local[id].updatedAt) {
      merged[id] = rc;
      pulled++;
    }
  }
  const toPush = Object.values(local).filter((c) => !remote.has(c.id) || c.updatedAt > remote.get(c.id).updatedAt);
  for (let i = 0; i < toPush.length; i += 500) {
    const { error } = await sb.from('cards').upsert(toPush.slice(i, i + 500).map((c) => toRow(c, user.id)));
    if (error) throw error;
  }

  const unsynced = getState().log.filter((l) => !l.synced);
  for (let i = 0; i < unsynced.length; i += 500) {
    const rows = unsynced.slice(i, i + 500).map((l) => ({
      id: l.id, user_id: user.id, card_id: l.cardId, grade: l.grade, reviewed_at: iso(l.at),
    }));
    const { error } = await sb.from('reviews').upsert(rows, { ignoreDuplicates: true });
    if (error) throw error;
  }
  const syncedIds = new Set(unsynced.map((l) => l.id));
  setState((s) => ({
    ...s,
    cards: { ...merged, ...Object.fromEntries(Object.entries(s.cards).filter(([id, c]) => c.updatedAt > (merged[id]?.updatedAt ?? 0))) },
    log: s.log.map((l) => (syncedIds.has(l.id) ? { ...l, synced: true } : l)),
  }));
  return { pulled, pushed: toPush.length, reviews: unsynced.length };
}
