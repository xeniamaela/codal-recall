import { useEffect, useState } from 'react';
import { useStore, setState } from '../lib/store.js';
import { syncConfigured, signIn, signOut, onAuthChange, syncNow, pullLibrary } from '../lib/sync.js';

export default function Settings() {
  const settings = useStore((s) => s.settings);
  const set = (patch) => setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));

  return (
    <div className="settings">
      <section className="panel">
        <h2>Study settings</h2>
        <label className="field">
          <span>New cards per day</span>
          <input
            type="number"
            min={0}
            max={500}
            value={settings.newPerDay}
            onChange={(e) => set({ newPerDay: Math.max(0, Number(e.target.value) || 0) })}
          />
        </label>
        <label className="check">
          <input type="checkbox" checked={settings.typeAnswers} onChange={(e) => set({ typeAnswers: e.target.checked })} />
          Type answers into the blanks (turn off to just recall in your head and flip)
        </label>
      </section>
      <SyncPanel />
    </div>
  );
}

function SyncPanel() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!syncConfigured) return;
    let off = () => {};
    onAuthChange(setUser).then((u) => (off = u));
    return () => off();
  }, []);

  const run = async (fn) => {
    setBusy(true);
    setMsg('');
    try {
      setMsg(await fn());
    } catch (e) {
      setMsg(e.message || String(e));
    }
    setBusy(false);
  };

  if (!syncConfigured) {
    return (
      <section className="panel">
        <h2>Cloud sync</h2>
        <p className="muted">
          Not configured. The app runs fully offline and saves your progress in this browser. To sync across your phone and laptop,
          create a free Supabase project, run <code>supabase/schema.sql</code>, and set <code>VITE_SUPABASE_URL</code> and{' '}
          <code>VITE_SUPABASE_ANON_KEY</code> (see README).
        </p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h2>Cloud sync</h2>
      {!user ? (
        <div className="row wrap">
          <input type="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button
            className="primary"
            disabled={busy || !email}
            onClick={() => run(async () => (await signIn(email), 'Check your email for the sign-in link.'))}
          >
            Email me a sign-in link
          </button>
        </div>
      ) : (
        <>
          <p>Signed in as <b>{user.email}</b></p>
          <div className="row wrap">
            <button
              className="primary"
              disabled={busy}
              onClick={() => run(async () => {
                const r = await syncNow();
                return `Synced: ${r.pushed} cards up, ${r.pulled} down, ${r.reviews} reviews uploaded.`;
              })}
            >
              Sync now
            </button>
            <button className="ghost" disabled={busy} onClick={() => run(async () => `Loaded ${await pullLibrary()} provisions from the shared library.`)}>
              Update codal library
            </button>
            <button className="ghost" onClick={() => signOut()}>Sign out</button>
          </div>
        </>
      )}
      {msg && <p className="msg">{msg}</p>}
    </section>
  );
}
