import { useEffect, useMemo, useState } from 'react';
import './App.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const DEFAULT_CRITERIA =
  'Payments or fintech companies that work with startups and developers.';

const post = (url, data) =>
  fetch(`${API}${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(r => r.json());

const parseDraft = (s) => {
  try { return JSON.parse(s); } catch { return { subject: '', body: s || '' }; }
};

const STATUS_LABEL = {
  new: 'Not analyzed',
  draft: 'Awaiting approval',
  skipped: 'Skipped (poor fit)',
  approved_dry_run: 'Approved (dry run)',
  sent: 'Sent',
  rejected: 'Rejected'
};

function LeadsTab({ criteria }) {
  const [leads, setLeads] = useState([]);
  const [selected, setSelected] = useState(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [msg, setMsg] = useState('');
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const data = await (await fetch(`${API}/leads`)).json();
      setLeads(Array.isArray(data) ? data : []);
      setError('');
      return Array.isArray(data) ? data : [];
    } catch {
      setError('Cannot reach the backend. Is "node server.js" running on port 3000?');
      return [];
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/leads`)
      .then(r => r.json())
      .then(data => { if (!cancelled) setLeads(Array.isArray(data) ? data : []); })
      .catch(() => {
        if (!cancelled) setError('Cannot reach the backend. Is "node server.js" running on port 3000?');
      });
    return () => { cancelled = true; };
  }, []);

  const open = (lead) => {
    const d = parseDraft(lead.email_draft);
    setSelected(lead);
    setSubject(d.subject || '');
    setBody(d.body || '');
    setMsg('');
  };

  const act = async (action) => {
    const data = await post(`/leads/${selected.id}/${action}`, { subject, body });
    setMsg(data.message || data.error);
    await load();
  };

  const analyzeOne = async () => {
    setBusy(true);
    setMsg('Analyzing, about 30 seconds...');
    const data = await post(`/leads/${selected.id}/analyze`, { criteria, senderName: 'Joshini' });
    if (data.error) {
      setMsg(`${data.error}: ${data.details || ''}`);
    } else {
      const fresh = await load();
      const updated = fresh.find(l => l.id === selected.id);
      if (updated) open(updated);
    }
    setBusy(false);
  };

  const analyzeBatch = async () => {
    setBusy(true);
    setMsg('Analyzing the next 5 leads, this takes a few minutes...');
    const data = await post('/leads/analyze-batch', { criteria, senderName: 'Joshini', count: 5 });
    setMsg(data.error ? `${data.error}: ${data.details || ''}` : `Analyzed ${data.analyzed} leads, ${data.remaining} still not analyzed.`);
    await load();
    setBusy(false);
  };

  const visible = useMemo(
    () => leads.filter(l => {
      if (filter === 'all') return true;
      if (filter === 'new') return l.status === 'new';
      return l.fit === filter;
    }),
    [leads, filter]
  );

  const count = (fn) => leads.filter(fn).length;

  return (
    <div className="page">
      <div className="page-head">
        <div className="head-row">
          <div>
            <h1>Leads</h1>
            <p className="summary">
              {leads.length} contacts with an email &middot;{' '}
              {count(l => l.status !== 'new')} analyzed &middot;{' '}
              {count(l => l.fit === 'good')} good fits &middot;{' '}
              {count(l => l.status === 'draft')} awaiting approval
            </p>
          </div>
          <button className="btn" disabled={busy || count(l => l.status === 'new') === 0} onClick={analyzeBatch}>
            {busy ? 'Working...' : 'Analyze next 5'}
          </button>
        </div>
        {!selected && msg && <p className="note">{msg}</p>}
      </div>

      {error && <div className="alert">{error}</div>}

      <div className="split">
        <div>
          <div className="filters">
            {[
              ['all', 'All'], ['good', 'Good'], ['maybe', 'Maybe'],
              ['poor', 'Poor'], ['new', 'Not analyzed']
            ].map(([key, label]) => (
              <button key={key} className={`filter ${filter === key ? 'on' : ''}`} onClick={() => setFilter(key)}>
                {label}
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <p className="empty">Nothing here yet. Use Run to find contacts.</p>
          ) : (
            <table>
              <thead>
                <tr><th>Contact</th><th>Company</th><th>Score</th><th>Status</th></tr>
              </thead>
              <tbody>
                {visible.map(l => (
                  <tr key={l.id} className={selected?.id === l.id ? 'sel' : ''} onClick={() => open(l)}>
                    <td>
                      <div className="strong">{l.name}</div>
                      <div className="sub">{l.title}</div>
                    </td>
                    <td>{l.domain}</td>
                    <td>
                      {l.score == null
                        ? <span className="score none">&ndash;</span>
                        : <span className={`score ${l.fit || ''}`}>{l.score}</span>}
                    </td>
                    <td>
                      <span className="status">
                        <span className={`dot ${l.status}`} />
                        {STATUS_LABEL[l.status] || l.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <aside className="detail">
          {!selected ? (
            <p className="empty">Select a lead to review it.</p>
          ) : (
            <>
              <h2>{selected.name}</h2>
              <p className="sub">{selected.title} at {selected.domain}</p>
              <p className="sub">{selected.email}</p>

              {selected.status === 'new' ? (
                <>
                  <p className="text spaced">
                    This contact has not been analyzed yet. The AI will read the company website, score the fit
                    against your criteria, and draft an email.
                  </p>
                  <button className="btn" disabled={busy} onClick={analyzeOne}>
                    {busy ? 'Analyzing...' : 'Analyze this lead'}
                  </button>
                </>
              ) : (
                <>
                  <div className="label">Fit score</div>
                  <p className="fit-line">
                    <span className={`score ${selected.fit || ''}`}>{selected.score}</span>
                    <span className="sub">&nbsp;{selected.fit}</span>
                  </p>
                  <ul className="reasons">
                    {(selected.reasons || []).map((r, i) => <li key={i}>{r}</li>)}
                  </ul>

                  <div className="label">Company summary</div>
                  <p className="text">{selected.summary}</p>

                  <div className="label">Email</div>
                  {selected.email_draft ? (
                    <>
                      <div className="composer">
                        <div className="row">
                          <span className="k">To</span>
                          <span>{selected.email}</span>
                        </div>
                        <div className="row">
                          <span className="k">Subject</span>
                          <input value={subject} onChange={e => setSubject(e.target.value)} />
                        </div>
                        <textarea rows="11" value={body} onChange={e => setBody(e.target.value)} />
                      </div>
                      <p className="sub">
                        Written using: {(selected.sources_used || []).join(', ') || 'no stored notes'}
                      </p>
                      <div className="actions">
                        <button className="btn" onClick={() => act('approve')}>Approve</button>
                        <button className="btn ghost" onClick={() => act('reject')}>Reject</button>
                      </div>
                    </>
                  ) : (
                    <p className="sub">Poor fit, so no email was drafted.</p>
                  )}
                </>
              )}
              {msg && <p className="note">{msg}</p>}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

function RunTab({ criteria, setCriteria }) {
  const [seed, setSeed] = useState('stripe.com');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    setResult(null);
    try {
      setResult(await post('/pipeline/run', { seedDomain: seed }));
    } catch {
      setResult({ error: 'Cannot reach the backend.' });
    }
    setBusy(false);
  };

  return (
    <div className="page narrow">
      <div className="page-head">
        <h1>Run</h1>
        <p className="summary">
          Finds companies similar to your seed, finds their decision makers, and keeps the ones with an email address.
          The AI analysis happens afterwards, in the Leads tab.
        </p>
      </div>

      <label>Seed domain</label>
      <input value={seed} onChange={e => setSeed(e.target.value)} />

      <label>Who is your ideal lead? (used when analyzing)</label>
      <textarea rows="3" value={criteria} onChange={e => setCriteria(e.target.value)} />

      <button className="btn" disabled={busy} onClick={run}>
        {busy ? 'Searching...' : 'Find contacts'}
      </button>
      <p className="sub">Each search uses one Prospeo credit.</p>

      {result && (
        <div className="result">
          {result.error ? (
            <div className="alert">{result.error} {result.details}</div>
          ) : (
            <p>
              Checked {result.companies} companies and found {result.found} decision makers.{' '}
              <b>{result.withEmail}</b> have an email address. Saved <b>{result.saved}</b> new
              {result.alreadyHad ? ` (${result.alreadyHad} were already in your list)` : ''}.
              Open the Leads tab to analyze them.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function KnowledgeTab() {
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [msg, setMsg] = useState('');

  const save = async () => {
    const data = await post('/knowledge', { sourceName: name, text });
    setMsg(data.saved ? `Saved (${data.chunks} chunk${data.chunks > 1 ? 's' : ''})` : data.error);
    if (data.saved) { setName(''); setText(''); }
  };

  return (
    <div className="page narrow">
      <div className="page-head">
        <h1>Knowledge</h1>
        <p className="summary">
          Notes about you or your offer. When writing an email, the best-matching notes are found by meaning and used as the only source of facts.
        </p>
      </div>

      <label>Name</label>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. about-me" />

      <label>Text</label>
      <textarea rows="8" value={text} onChange={e => setText(e.target.value)} />

      <button className="btn" onClick={save} disabled={!name || !text}>Save</button>
      {msg && <p className="note">{msg}</p>}
    </div>
  );
}

const TABS = [
  { id: 'leads', label: 'Leads' },
  { id: 'run', label: 'Run' },
  { id: 'knowledge', label: 'Knowledge' }
];

export default function App() {
  const [tab, setTab] = useState('leads');
  const [criteria, setCriteria] = useState(DEFAULT_CRITERIA);

  return (
    <>
      <header className="topbar">
        <div className="wordmark">AutoPitch</div>
        <nav>
          {TABS.map(t => (
            <button key={t.id} className={`tab ${tab === t.id ? 'on' : ''}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
        <div className="top-note">Nothing is sent until you approve it</div>
      </header>
      {tab === 'leads' && <LeadsTab criteria={criteria} />}
      {tab === 'run' && <RunTab criteria={criteria} setCriteria={setCriteria} />}
      {tab === 'knowledge' && <KnowledgeTab />}
    </>
  );
}