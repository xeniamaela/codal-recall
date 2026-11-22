import { useEffect, useState } from 'react';
import { useStore, buildQueue } from './lib/store.js';
import Browse from './components/Browse.jsx';
import Review from './components/Review.jsx';
import Progress from './components/Progress.jsx';
import ImportView from './components/Import.jsx';
import Settings from './components/Settings.jsx';
import { syncConfigured, pullLibrary } from './lib/sync.js';

const TABS = [
  { id: 'review', label: 'Review' },
  { id: 'browse', label: 'Browse codals' },
  { id: 'progress', label: 'Progress' },
  { id: 'import', label: 'Import' },
  { id: 'settings', label: 'Settings' },
];

function useHashTab() {
  const read = () => {
    const h = window.location.hash.replace('#', '');
    return TABS.some((t) => t.id === h) ? h : null;
  };
  const [tab, setTab] = useState(read);
  useEffect(() => {
    const on = () => setTab(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const go = (id) => {
    window.location.hash = id;
    setTab(id);
  };
  return [tab, go];
}

export default function App() {
  const s = useStore();
  const dueCount = buildQueue(s).length;
  const cardCount = Object.values(s.cards).filter((c) => !c.deleted).length;
  const [hashTab, go] = useHashTab();
  useEffect(() => {
    // Refresh the shared codal library from Supabase (if configured). Offline cache is used otherwise.
    if (syncConfigured) pullLibrary().catch(() => {});
  }, []);
  // Pick the landing tab once, so adding the first card doesn't yank you away from Browse.
  const [initialTab] = useState(() => (cardCount === 0 ? 'browse' : 'review'));
  const tab = hashTab || initialTab;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand" onClick={() => go('review')}>
          <span className="seal">§</span>
          <div>
            <strong>Codal Recall</strong>
            <small>Philippine codals · active recall</small>
          </div>
        </div>
        <nav className="tabs">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => go(t.id)}>
              {t.label}
              {t.id === 'review' && dueCount > 0 && <span className="badge">{dueCount}</span>}
            </button>
          ))}
        </nav>
      </header>
      <main>
        {tab === 'review' && <Review goBrowse={() => go('browse')} />}
        {tab === 'browse' && <Browse />}
        {tab === 'progress' && <Progress />}
        {tab === 'import' && <ImportView goBrowse={() => go('browse')} />}
        {tab === 'settings' && <Settings />}
      </main>
      <footer className="foot">
        Statutory text is public domain. Always verify against the official text before relying on it.
      </footer>
    </div>
  );
}
