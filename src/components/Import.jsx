import { useRef, useState } from 'react';
import { parseCodal } from '../lib/parser.js';
import { useLibrary, useStore, importProvisions, deleteCustomCode, exportBackup, restoreBackup } from '../lib/store.js';
import { slug } from '../lib/text.js';

export default function ImportView({ goBrowse }) {
  const lib = useLibrary();
  const customCodes = useStore((s) => s.customCodes);
  const [raw, setRaw] = useState('');
  const [strip, setStrip] = useState(true);
  const [parsed, setParsed] = useState(null);
  const [target, setTarget] = useState('civ');
  const [newName, setNewName] = useState('');
  const [newShort, setNewShort] = useState('');
  const [msg, setMsg] = useState('');
  const fileRef = useRef();

  const parse = () => {
    const out = parseCodal(raw, { stripSourceNotes: strip });
    setParsed(out);
    // Guess the destination from the labels.
    const first = out[0]?.label || '';
    if (/^Rule /.test(first)) setTarget('roc');
    else if (/^Art\. [IVXLC]+, Sec/.test(first)) setTarget('const');
    setMsg(out.length ? '' : 'No "Article N." or "Section N." markers found. Check the pasted text.');
  };

  const save = () => {
    if (target === '__new') {
      if (!newName.trim()) return setMsg('Give the new codal a name.');
      const id = slug(newShort || newName).slice(0, 24) || `code-${Date.now()}`;
      importProvisions({ codeId: id, name: newName.trim(), short: (newShort || newName).trim(), provisions: parsed });
    } else {
      const c = lib.codeMap.get(target);
      importProvisions({ codeId: target, name: c.name, short: c.short, law: c.law, provisions: parsed });
    }
    setMsg(`Imported ${parsed.length} provisions.`);
    setParsed(null);
    setRaw('');
  };

  const download = () => downloadJson(`codal-recall-backup-${new Date().toISOString().slice(0, 10)}.json`, exportBackup());

  const restore = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      restoreBackup(await f.text());
      setMsg('Backup restored.');
    } catch (err) {
      setMsg(err.message);
    }
    e.target.value = '';
  };

  return (
    <div className="import-view">
      <section className="panel">
        <h2>Import codal text</h2>
        <p className="muted">
          Paste a full codal or a chapter, copied from the Official Gazette, lawphil.net or the SC E-Library. The app splits it at
          every <code>Article 123.</code>, <code>Art. 123.</code>, <code>Section 4.</code>, <code>RULE 110</code> or{' '}
          <code>ARTICLE III</code> line, and picks up BOOK, TITLE and CHAPTER lines as headings.
        </p>
        <textarea
          rows={12}
          placeholder={'Article 1156. An obligation is a juridical necessity to give, to do or not to do. (n)\n\nArticle 1157. Obligations arise from:\n(1) Law;\n(2) Contracts; …'}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
        />
        <div className="row between wrap">
          <label className="check">
            <input type="checkbox" checked={strip} onChange={(e) => setStrip(e.target.checked)} /> Remove source notes like (n),
            (1254a)
          </label>
          <button className="primary" disabled={!raw.trim()} onClick={parse}>Split into provisions</button>
        </div>
        {msg && <p className="msg">{msg}</p>}

        {parsed && parsed.length > 0 && (
          <div className="preview">
            <h3>{parsed.length} provisions found</h3>
            <div className="preview-list">
              {parsed.slice(0, 60).map((p) => (
                <div key={p.label} className="preview-item">
                  <b>{p.label}</b> <span className="muted small">{p.heading}</span>
                  <div className="clip">{p.text}</div>
                </div>
              ))}
              {parsed.length > 60 && <p className="muted">…and {parsed.length - 60} more</p>}
            </div>
            <div className="row wrap">
              <label>
                Add to{' '}
                <select value={target} onChange={(e) => setTarget(e.target.value)}>
                  {lib.codes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  <option value="__new">+ New codal / special law…</option>
                </select>
              </label>
              {target === '__new' && (
                <>
                  <input placeholder="Full name (e.g. Labor Code of the Philippines)" value={newName} onChange={(e) => setNewName(e.target.value)} />
                  <input placeholder="Short name (e.g. Labor Code)" value={newShort} onChange={(e) => setNewShort(e.target.value)} />
                </>
              )}
              <button className="primary" onClick={save}>Save {parsed.length} provisions</button>
            </div>
            <p className="muted small">Provisions with the same label as existing ones are replaced, which lets you update amended text.</p>
          </div>
        )}
      </section>

      {customCodes.length > 0 && (
        <section className="panel">
          <h3>Your imports</h3>
          {customCodes.map((c) => (
            <div key={c.id} className="row between">
              <span><b>{c.short}</b> <span className="muted">· {c.provisions.length} provisions</span></span>
              <span className="row">
                <button className="link" onClick={goBrowse}>browse</button>
                <button className="link" onClick={() => downloadJson(`${c.id}.json`, c)}>export JSON</button>
                <button className="link danger" onClick={() => deleteCustomCode(c.id)}>remove import</button>
              </span>
            </div>
          ))}
        </section>
      )}

      <section className="panel">
        <h3>Backup</h3>
        <p className="muted">Your cards and progress live in this browser. Download a backup now and then, or turn on cloud sync in Settings.</p>
        <div className="row">
          <button className="ghost" onClick={download}>Download backup (.json)</button>
          <button className="ghost" onClick={() => fileRef.current.click()}>Restore from backup…</button>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={restore} />
        </div>
      </section>
    </div>
  );
}

function downloadJson(filename, data) {
  const blob = new Blob([typeof data === 'string' ? data : JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
