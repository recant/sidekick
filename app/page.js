'use client';

import { useEffect, useMemo, useState } from 'react';

const DEFAULT_SOURCES = [{ provider: 'ashby', slug: 'ramp', company: 'Ramp' }];
const PROVIDERS = [
  { value: 'ashby', label: 'Ashby' },
  { value: 'greenhouse', label: 'Greenhouse' },
  { value: 'lever', label: 'Lever' }
];

function Score({ value }) {
  return <span className={`score score-${value >= 80 ? 'high' : value >= 65 ? 'medium' : 'low'}`}>{value}</span>;
}

function formatDate(value) {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

export default function Home() {
  const [sources, setSources] = useState(DEFAULT_SOURCES);
  const [provider, setProvider] = useState('ashby');
  const [slug, setSlug] = useState('');
  const [company, setCompany] = useState('');
  const [jobs, setJobs] = useState([]);
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [minScore, setMinScore] = useState(70);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const saved = window.localStorage.getItem('ally-lead-sources');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length) setSources(parsed);
      } catch {}
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem('ally-lead-sources', JSON.stringify(sources));
  }, [sources]);

  async function refresh() {
    setLoading(true);
    setErrors([]);
    try {
      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sources })
      });
      const data = await response.json();
      setJobs(data.jobs || []);
      setErrors(data.errors || []);
      if (!response.ok && !(data.jobs || []).length) throw new Error((data.errors || []).join(' '));
    } catch (error) {
      setErrors([error.message || 'Failed to refresh']);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addSource(event) {
    event.preventDefault();
    const cleanSlug = slug.trim();
    const cleanCompany = company.trim() || cleanSlug;
    if (!cleanSlug) return;
    const next = [...sources.filter((s) => !(s.provider === provider && s.slug === cleanSlug)), { provider, slug: cleanSlug, company: cleanCompany }];
    setSources(next);
    setSlug('');
    setCompany('');
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return jobs.filter((job) => {
      const haystack = `${job.company} ${job.title} ${job.location} ${job.opportunityType} ${job.inferredGoal}`.toLowerCase();
      return job.outsourceScore >= minScore && (!q || haystack.includes(q));
    });
  }, [jobs, minScore, query]);

  const stats = useMemo(() => ({
    high: jobs.filter((j) => j.outsourceScore >= 80).length,
    companies: new Set(jobs.map((j) => j.company)).size,
    average: jobs.length ? Math.round(jobs.reduce((sum, j) => sum + j.outsourceScore, 0) / jobs.length) : 0
  }), [jobs]);

  return (
    <main>
      <header className="topbar">
        <div>
          <div className="eyebrow">ALLY / DEMAND INTELLIGENCE</div>
          <h1>Find the project hiding inside the job posting.</h1>
          <p className="subtitle">Public hiring signals → likely urgent outcomes → project leads you can pitch without scraping closed marketplaces.</p>
        </div>
        <button className="primary" onClick={refresh} disabled={loading || !sources.length}>{loading ? 'Scanning…' : 'Refresh live jobs'}</button>
      </header>

      <section className="stats">
        <div className="stat"><span>Jobs scanned</span><strong>{jobs.length}</strong></div>
        <div className="stat"><span>80+ leads</span><strong>{stats.high}</strong></div>
        <div className="stat"><span>Companies</span><strong>{stats.companies}</strong></div>
        <div className="stat"><span>Avg score</span><strong>{stats.average || '—'}</strong></div>
      </section>

      <section className="grid">
        <aside className="panel sources-panel">
          <div className="eyebrow">SOURCES</div>
          <h2>Public ATS feeds</h2>
          <form onSubmit={addSource} className="source-form">
            <label>Provider<select value={provider} onChange={(e) => setProvider(e.target.value)}>{PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select></label>
            <label>Company<input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. Ramp" /></label>
            <label>Board slug<input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="e.g. ramp" /></label>
            <button className="secondary" type="submit">Add source</button>
          </form>

          <div className="source-list">
            {sources.map((source) => (
              <div className="source-row" key={`${source.provider}:${source.slug}`}>
                <div><strong>{source.company}</strong><span>{source.provider} / {source.slug}</span></div>
                <button className="icon-button" title="Remove source" onClick={() => setSources(sources.filter((item) => item !== source))}>×</button>
              </div>
            ))}
          </div>

          <div className="hint"><strong>How to find the slug</strong><p>Ashby: jobs.ashbyhq.com/<b>slug</b><br/>Lever: jobs.lever.co/<b>slug</b><br/>Greenhouse: boards.greenhouse.io/<b>slug</b></p></div>
        </aside>

        <section className="panel results-panel">
          <div className="toolbar">
            <input className="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search AI, bioinformatics, data…" />
            <label className="score-filter">Min score <input type="range" min="20" max="95" value={minScore} onChange={(e) => setMinScore(Number(e.target.value))}/><b>{minScore}</b></label>
          </div>

          {errors.length > 0 && <div className="errors">{errors.map((error) => <div key={error}>{error}</div>)}</div>}
          <div className="results-header"><span>{filtered.length} leads</span><span>Higher score = easier to frame as a discrete project</span></div>

          <div className="table-wrap">
            <table>
              <thead><tr><th>Score</th><th>Company / role</th><th>Likely project</th><th>Signal</th><th></th></tr></thead>
              <tbody>
                {filtered.map((job) => (
                  <tr key={job.id} onClick={() => setSelected(job)}>
                    <td><Score value={job.outsourceScore}/></td>
                    <td><strong>{job.company}</strong><span>{job.title}</span><small>{job.location} · {formatDate(job.publishedAt)}</small></td>
                    <td><strong>{job.opportunityType}</strong><span>{job.inferredGoal}</span></td>
                    <td><span>{job.reasons?.[0] || 'General hiring signal.'}</span></td>
                    <td><button className="open">→</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && filtered.length === 0 && <div className="empty">No leads match this filter. Add a source or lower the score threshold.</div>}
          </div>
        </section>
      </section>

      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="close" onClick={() => setSelected(null)}>×</button>
            <div className="eyebrow">{selected.company} · {selected.provider}</div>
            <h2>{selected.title}</h2>
            <div className="modal-score"><Score value={selected.outsourceScore}/><span>outsourceability score</span></div>
            <h3>Likely project hiding inside the role</h3>
            <p>{selected.inferredGoal}</p>
            <h3>Why it scored this way</h3>
            <ul>{(selected.reasons || []).map((reason) => <li key={reason}>{reason}</li>)}</ul>
            <h3>Question to send</h3>
            <div className="pitch">{selected.suggestedQuestion}</div>
            <div className="modal-actions">
              <a className="primary link-button" href={selected.url} target="_blank" rel="noreferrer">Open original posting</a>
              <button className="secondary" onClick={() => navigator.clipboard?.writeText(selected.suggestedQuestion)}>Copy question</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
