import React, { useState } from 'react';
import { searchLeads, exportToCSV } from '../api';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date)) return '';
  const diff = (Date.now() - date) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function getInitials(name) {
  if (!name) return 'u/';
  return name.slice(0, 2).toUpperCase();
}

function filterRelevantRedditLeads(rawLeads, { searchTerms, subreddits }) {
  if (!rawLeads || !rawLeads.length) return [];

  const terms = (searchTerms || '')
    .toLowerCase()
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);

  const subFilter = (subreddits || '')
    .toLowerCase()
    .split(/[\s,]+/)
    .map((s) => s.trim().replace(/^r\//i, ''))
    .filter(Boolean);

  if (!terms.length && !subFilter.length) return rawLeads;

  const filtered = rawLeads.filter((lead) => {
    const blob = `${lead.title || ''} ${lead.text || ''} ${lead.subreddit || ''} ${lead.searchTerm || ''}`.toLowerCase();
    
    const termMatches = terms.length === 0 || terms.some((t) => blob.includes(t));
    const subMatches = subFilter.length === 0 || subFilter.some((sub) => (lead.subreddit || '').toLowerCase().includes(sub));

    return termMatches && subMatches;
  });

  return filtered.length > 0 ? filtered : rawLeads;
}

export default function RedditScraper() {
  const [searchText, setSearchText] = useState('');
  const [subredditsText, setSubredditsText] = useState('');
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [leads, setLeads] = useState([]);
  const [runId, setRunId] = useState('');
  const [searched, setSearched] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLeads([]);
    setSearched(false);

    if (!searchText.trim()) {
      setError('Enter at least one search term.');
      return;
    }

    setLoading(true);
    try {
      const result = await searchLeads({
        platform: 'reddit',
        searchTerms: searchText,
        subreddits: subredditsText,
        limit,
      });
      const raw = result.leads || [];
      const cleanRelevant = filterRelevantRedditLeads(raw, {
        searchTerms: searchText.trim(),
        subreddits: subredditsText.trim(),
      });
      setLeads(cleanRelevant);
      setRunId(result.runId || '');
      setSearched(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    exportToCSV(leads, `reddit-leads-${Date.now()}.csv`);
  };

  return (
    <div className="scraper-container">
      {/* Search Layout Grid: Form + Live Summary */}
      <div className="search-grid">
        {/* Main Search Form Card */}
        <div className="card form-card">
          <div className="card-header">
            <div className="header-icon-badge rd-badge-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4l3 3" />
              </svg>
            </div>
            <div>
              <h2 className="card-title">Reddit Intent Search</h2>
              <p className="card-desc">Find Reddit posts where people discuss, ask for, or express intent for your product or service.</p>
            </div>
          </div>

          <div className="actor-info-badge">
            <span className="info-icon">⚙</span> Actor: <strong>trudax/reddit-scraper-lite</strong> · No login required
          </div>

          <form onSubmit={handleSubmit} className="search-form">
            <div className="form-group">
              <label className="form-label" htmlFor="rd-search">Search Terms</label>
              <div className="input-with-icon">
                <span className="input-icon">🔍</span>
                <input
                  id="rd-search"
                  type="text"
                  className="form-input rd-focus"
                  placeholder="e.g. need a CRM, looking for SEO agency"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
                <span className="input-suffix-icon">🔥</span>
              </div>
              <p className="form-hint">Comma-separated terms (max 5 keywords).</p>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="rd-subreddits">Subreddits (optional)</label>
                <div className="input-with-icon">
                  <span className="input-icon">🌐</span>
                  <input
                    id="rd-subreddits"
                    type="text"
                    className="form-input rd-focus"
                    placeholder="e.g. smallbusiness, entrepreneur"
                    value={subredditsText}
                    onChange={(e) => setSubredditsText(e.target.value)}
                  />
                </div>
                <p className="form-hint">Comma-separated, without r/. Leave empty to search all of Reddit.</p>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="rd-limit">Number of Results</label>
                <div className="input-with-icon">
                  <span className="input-icon">📊</span>
                  <input
                    id="rd-limit"
                    type="number"
                    min={1}
                    max={100}
                    className="form-input rd-focus"
                    value={limit}
                    onChange={(e) => setLimit(e.target.value)}
                  />
                </div>
                <p className="form-hint">1–100 results per search.</p>
              </div>
            </div>

            <button
              id="btn-scrape-reddit"
              type="submit"
              className="btn btn-primary-gradient btn-rd"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="btn-spinner" />
                  Searching Reddit...
                </>
              ) : (
                <>
                  🔥 Find {limit || 20} Reddit Leads <span className="btn-arrow">→</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Live Search Summary Card */}
        <div className="card summary-card">
          <div className="summary-header">
            <span className="sparkle-badge">✨</span>
            <div>
              <h3 className="summary-title">Search Summary</h3>
              <p className="summary-desc">Live preview of your Reddit intent search parameters.</p>
            </div>
          </div>

          <div className="summary-list">
            <div className="summary-item">
              <div className="summary-icon-box box-orange">🔎</div>
              <div className="summary-details">
                <span className="summary-label">Search Keywords</span>
                <span className="summary-value">{searchText.trim() || 'All intent keywords'}</span>
              </div>
            </div>

            <div className="summary-item">
              <div className="summary-icon-box box-purple">🌐</div>
              <div className="summary-details">
                <span className="summary-label">Target Subreddits</span>
                <span className="summary-value">{subredditsText.trim() ? `r/${subredditsText.trim()}` : 'All Subreddits'}</span>
              </div>
            </div>

            <div className="summary-item">
              <div className="summary-icon-box box-blue">📊</div>
              <div className="summary-details">
                <span className="summary-label">Result Limit</span>
                <span className="summary-value">{limit || 20} posts</span>
              </div>
            </div>

            <div className="summary-item">
              <div className="summary-icon-box box-green">🤖</div>
              <div className="summary-details">
                <span className="summary-label">Source</span>
                <span className="summary-value">Apify Reddit Scraper Lite</span>
              </div>
            </div>
          </div>

          <div className="summary-footer-box">
            <span className="footer-box-icon">⚡</span>
            <div className="footer-box-text">
              <strong>Buyer Intent Extraction</strong>
              <span>Scans active Reddit posts & discussions for high-conversion sales opportunities.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Error Message Banner */}
      {error && (
        <div className="alert-banner alert-error">
          <span className="alert-icon">⚠️</span>
          <div>
            <strong>Error: </strong>
            {error}
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="card loading-card">
          <div className="loading-content">
            <div className="spinner spinner-rd" />
            <h3 className="loading-title">Searching Reddit via Apify...</h3>
            <p className="loading-sub">Connecting to Apify Actor. This usually takes 30–120 seconds. Please wait.</p>
          </div>
        </div>
      )}

      {/* Results View Table */}
      {!loading && leads.length > 0 && (
        <div className="card results-card">
          <div className="results-top-bar">
            <div className="results-status-group">
              <span className="check-circle-badge check-rd">✓</span>
              <div>
                <h3 className="results-status-title">
                  {leads.length} Reddit Intent Posts Found
                </h3>
                <p className="results-status-meta">
                  {searchText || 'Intent Search'} · {subredditsText ? `r/${subredditsText}` : 'All Subreddits'}
                  {runId && <> · Run ID: <code>{runId.slice(0, 8)}</code></>}
                </p>
              </div>
            </div>

            <button id="btn-export-reddit" className="btn btn-export" onClick={handleExport}>
              ⬇ Export CSV
            </button>
          </div>

          {/* Desktop Data Table */}
          <div className="table-responsive desktop-only">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Author / Title</th>
                  <th>Subreddit</th>
                  <th>Content Preview</th>
                  <th>Engagement</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead, i) => (
                  <tr key={lead.sourceUrl || i}>
                    <td>
                      <div className="table-prospect">
                        <div className="avatar rd-avatar-bg">{getInitials(lead.name)}</div>
                        <div className="prospect-names">
                          <span className="prospect-name">
                            {lead.title || lead.text?.substring(0, 50) || 'Reddit Post'}
                          </span>
                          <span className="prospect-headline">
                            u/{lead.name || 'anonymous'} {lead.createdAt && `· ${timeAgo(lead.createdAt)}`}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="table-cell-group">
                        <span className="subreddit-pill">
                          r/{lead.subreddit || 'reddit'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="table-cell-group text-truncate-2" style={{ maxWidth: 320 }}>
                        <span className="cell-text">{lead.text || 'No description provided.'}</span>
                      </div>
                    </td>
                    <td>
                      <div className="table-cell-group flex-gap-2">
                        {typeof lead.upVotes === 'number' && (
                          <span className="stat-pill score-pill">▲ {lead.upVotes}</span>
                        )}
                        {typeof lead.commentCount === 'number' && (
                          <span className="stat-pill comment-pill">💬 {lead.commentCount}</span>
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {lead.sourceUrl ? (
                        <a
                          href={lead.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-table-action"
                        >
                          View ↗
                        </a>
                      ) : (
                        <span className="text-muted-sm">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card Layout */}
          <div className="leads-mobile-list mobile-only">
            {leads.map((lead, i) => (
              <div key={lead.sourceUrl || i} className="mobile-lead-card">
                <div className="mobile-card-top">
                  <div className="avatar rd-avatar-bg">{getInitials(lead.name)}</div>
                  <div className="mobile-card-names">
                    <span className="mobile-name">
                      {lead.title || lead.text?.substring(0, 40) || 'Reddit Post'}
                    </span>
                    <span className="mobile-headline">
                      u/{lead.name || 'anonymous'} {lead.createdAt && `· ${timeAgo(lead.createdAt)}`}
                    </span>
                  </div>
                  {lead.sourceUrl && (
                    <a
                      href={lead.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-table-action"
                    >
                      View ↗
                    </a>
                  )}
                </div>

                {lead.text && <p className="mobile-lead-body">{lead.text}</p>}

                <div className="mobile-tags-row">
                  {lead.subreddit && <span className="m-tag">r/{lead.subreddit}</span>}
                  {typeof lead.upVotes === 'number' && <span className="m-tag">▲ {lead.upVotes} votes</span>}
                  {typeof lead.commentCount === 'number' && <span className="m-tag">💬 {lead.commentCount} comments</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && searched && leads.length === 0 && (
        <div className="card empty-card">
          <div className="empty-content">
            <span className="empty-icon">🔍</span>
            <h3 className="empty-title">No Reddit leads found</h3>
            <p className="empty-desc">Try broader search terms, or remove the subreddit filter to search all of Reddit.</p>
          </div>
        </div>
      )}
    </div>
  );
}

