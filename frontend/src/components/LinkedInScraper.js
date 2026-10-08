import React, { useState } from 'react';
import { searchLeads, exportToCSV } from '../api';

function getInitials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function filterRelevantLinkedInLeads(rawLeads, { search, location, jobTitles }) {
  if (!rawLeads || !rawLeads.length) return [];

  const searchKeywords = (search || '')
    .toLowerCase()
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);

  const locKeywords = (location || '')
    .toLowerCase()
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);

  const roleKeywords = (jobTitles || '')
    .toLowerCase()
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);

  if (!searchKeywords.length && !locKeywords.length && !roleKeywords.length) {
    return rawLeads;
  }

  // Location aliases dictionary for common states & major cities
  const locAliases = {
    texas: ['texas', 'tx', 'houston', 'dallas', 'austin', 'san antonio', 'fort worth', 'el paso', 'arlington'],
    california: ['california', 'ca', 'los angeles', 'san francisco', 'san diego', 'san jose', 'sacramento'],
    florida: ['florida', 'fl', 'miami', 'orlando', 'tampa', 'jacksonville'],
    'new york': ['new york', 'ny', 'nyc', 'manhattan', 'brooklyn', 'albany'],
  };

  const expandLocKeywords = (kws) => {
    let expanded = [...kws];
    kws.forEach((kw) => {
      if (locAliases[kw]) {
        expanded.push(...locAliases[kw]);
      }
    });
    return expanded;
  };

  const expandedLocs = expandLocKeywords(locKeywords);

  const scoredLeads = rawLeads.map((lead) => {
    const leadLoc = (lead.location || '').toLowerCase();
    const leadHeadline = (lead.headline || '').toLowerCase();
    const leadTitle = (lead.jobTitle || '').toLowerCase();
    const leadCompany = (lead.company || '').toLowerCase();
    const textBlob = `${lead.name || ''} ${leadTitle} ${leadHeadline} ${leadCompany} ${leadLoc}`.toLowerCase();

    let score = 0;
    let locationMatches = true;

    if (expandedLocs.length > 0) {
      const locBlob = `${leadLoc} ${leadHeadline}`;
      const matchesLoc = expandedLocs.some((kw) => locBlob.includes(kw));
      if (matchesLoc) {
        score += 4;
      } else if (leadLoc) {
        // Location is explicitly given on profile and doesn't match target location
        locationMatches = false;
      }
    }

    if (roleKeywords.length > 0) {
      const matchesRole = roleKeywords.some((kw) => textBlob.includes(kw));
      if (matchesRole) score += 3;
    }

    if (searchKeywords.length > 0) {
      const matchesSearch = searchKeywords.some((kw) => textBlob.includes(kw));
      if (matchesSearch) score += 2;
    }

    return { lead, score, locationMatches };
  });

  // Strict relevance: Location matches and at least one relevance hit
  const strictlyRelevant = scoredLeads
    .filter((item) => item.locationMatches && item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.lead);

  if (strictlyRelevant.length > 0) {
    return strictlyRelevant;
  }

  // Soft fallback if strict filtering was too restrictive
  const fallback = scoredLeads
    .filter((item) => item.locationMatches)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.lead);

  return fallback.length > 0 ? fallback : rawLeads;
}

export default function LinkedInScraper() {
  const [search, setSearch] = useState('');
  const [location, setLocation] = useState('');
  const [jobTitles, setJobTitles] = useState('');
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

    if (!search.trim() && !jobTitles.trim()) {
      setError('Enter a Search / Industry or at least one Job Title.');
      return;
    }

    setLoading(true);
    try {
      const result = await searchLeads({
        platform: 'linkedin',
        search: search.trim(),
        location,
        jobTitles,
        limit,
      });
      const raw = result.leads || [];
      const cleanRelevant = filterRelevantLinkedInLeads(raw, {
        search: search.trim(),
        location: location.trim(),
        jobTitles: jobTitles.trim(),
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
    exportToCSV(leads, `linkedin-leads-${Date.now()}.csv`);
  };

  return (
    <div className="scraper-container">
      {/* Search Layout Grid: Form + Live Summary */}
      <div className="search-grid">
        {/* Main Search Form Card */}
        <div className="card form-card">
          <div className="card-header">
            <div className="header-icon-badge li-badge-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <polyline points="17 11 19 13 23 9" />
              </svg>
            </div>
            <div>
              <h2 className="card-title">Find your ideal prospects</h2>
              <p className="card-desc">Describe your target audience and get qualified decision-makers in seconds.</p>
            </div>
          </div>

          <div className="actor-info-badge">
            <span className="info-icon">⚙</span> Actor: <strong>automly/linkedin-people-search-scraper</strong> · No login required
          </div>

          <form onSubmit={handleSubmit} className="search-form">
            <div className="form-group">
              <label className="form-label" htmlFor="li-search">Industry or keyword</label>
              <div className="input-with-icon">
                <span className="input-icon">🔍</span>
                <input
                  id="li-search"
                  type="text"
                  className="form-input li-focus"
                  placeholder="e.g. quarry mining aggregate"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <span className="input-suffix-icon">✨</span>
              </div>
              <p className="form-hint">Keywords or industry terms the LinkedIn profile should mention.</p>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="li-location">Location</label>
                <div className="input-with-icon">
                  <span className="input-icon">📍</span>
                  <input
                    id="li-location"
                    type="text"
                    className="form-input li-focus"
                    placeholder="e.g. Oman"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>
                <p className="form-hint">City, region or country.</p>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="li-limit">Number of leads</label>
                <div className="input-with-icon">
                  <span className="input-icon">👤</span>
                  <input
                    id="li-limit"
                    type="number"
                    min={1}
                    max={100}
                    className="form-input li-focus"
                    value={limit}
                    onChange={(e) => setLimit(e.target.value)}
                  />
                </div>
                <p className="form-hint">1–100 prospects per search.</p>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="li-titles">Decision-maker roles</label>
              <div className="input-with-icon">
                <span className="input-icon">💼</span>
                <input
                  id="li-titles"
                  type="text"
                  className="form-input li-focus"
                  placeholder="e.g. Procurement Manager, Operations Manager, General Manager"
                  value={jobTitles}
                  onChange={(e) => setJobTitles(e.target.value)}
                />
              </div>
              <p className="form-hint">Add one or more job titles separated by commas.</p>
            </div>

            <button
              id="btn-scrape-linkedin"
              type="submit"
              className="btn btn-primary-gradient btn-li"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="btn-spinner" />
                  Searching Profiles...
                </>
              ) : (
                <>
                  ✨ Find {limit || 20} Leads <span className="btn-arrow">→</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Live Search Summary Card (Matching Reference Screenshot) */}
        <div className="card summary-card">
          <div className="summary-header">
            <span className="sparkle-badge">✨</span>
            <div>
              <h3 className="summary-title">Search Summary</h3>
              <p className="summary-desc">Here's what we'll find for you.</p>
            </div>
          </div>

          <div className="summary-list">
            <div className="summary-item">
              <div className="summary-icon-box box-blue">🏢</div>
              <div className="summary-details">
                <span className="summary-label">Industry</span>
                <span className="summary-value">{search.trim() || 'All Industries'}</span>
              </div>
            </div>

            <div className="summary-item">
              <div className="summary-icon-box box-purple">📍</div>
              <div className="summary-details">
                <span className="summary-label">Location</span>
                <span className="summary-value">{location.trim() || 'Worldwide'}</span>
              </div>
            </div>

            <div className="summary-item">
              <div className="summary-icon-box box-green">💼</div>
              <div className="summary-details">
                <span className="summary-label">Roles</span>
                <span className="summary-value">{jobTitles.trim() || 'All Decision Makers'}</span>
              </div>
            </div>

            <div className="summary-item">
              <div className="summary-icon-box box-orange">👥</div>
              <div className="summary-details">
                <span className="summary-label">Target Lead Count</span>
                <span className="summary-value">{limit || 20} prospects</span>
              </div>
            </div>
          </div>

          <div className="summary-footer-box">
            <span className="footer-box-icon">⚡</span>
            <div className="footer-box-text">
              <strong>Apify People Search</strong>
              <span>Find & match the most relevant decision makers for your query.</span>
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
            <div className="spinner spinner-li" />
            <h3 className="loading-title">Searching LinkedIn Profiles via Apify...</h3>
            <p className="loading-sub">Connecting to Apify Actor. This usually takes 20–60 seconds.</p>
          </div>
        </div>
      )}

      {/* Results View Table */}
      {!loading && leads.length > 0 && (
        <div className="card results-card">
          <div className="results-top-bar">
            <div className="results-status-group">
              <span className="check-circle-badge">✓</span>
              <div>
                <h3 className="results-status-title">
                  {leads.length} Qualified Prospects Found
                </h3>
                <p className="results-status-meta">
                  {location || 'Global'} · {search || 'All Industries'} · {jobTitles || 'Decision Makers'}
                  {runId && <> · Run ID: <code>{runId.slice(0, 8)}</code></>}
                </p>
              </div>
            </div>

            <button id="btn-export-linkedin" className="btn btn-export" onClick={handleExport}>
              ⬇ Export CSV
            </button>
          </div>

          {/* Desktop Data Table */}
          <div className="table-responsive desktop-only">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Prospect</th>
                  <th>Company</th>
                  <th>Job Title</th>
                  <th>Location</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead, i) => (
                  <tr key={lead.profileUrl || i}>
                    <td>
                      <div className="table-prospect">
                        <div className="avatar li-avatar-bg">{getInitials(lead.name)}</div>
                        <div className="prospect-names">
                          <span className="prospect-name">
                            {lead.name || 'Unknown'} <span className="li-badge-small">in</span>
                          </span>
                          <span className="prospect-headline">{lead.headline || lead.jobTitle || ''}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="table-cell-group">
                        <span className="cell-icon">🏢</span>
                        <span className="cell-text">{lead.company || 'N/A'}</span>
                      </div>
                    </td>
                    <td>
                      <div className="table-cell-group">
                        <span className="cell-text font-medium">{lead.jobTitle || 'N/A'}</span>
                      </div>
                    </td>
                    <td>
                      <div className="table-cell-group">
                        <span className="cell-icon">📍</span>
                        <span className="cell-text">{lead.location || 'N/A'}</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {lead.profileUrl ? (
                        <a
                          href={lead.profileUrl}
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
              <div key={lead.profileUrl || i} className="mobile-lead-card">
                <div className="mobile-card-top">
                  <div className="avatar li-avatar-bg">{getInitials(lead.name)}</div>
                  <div className="mobile-card-names">
                    <span className="mobile-name">
                      {lead.name || 'Unknown'} <span className="li-badge-small">in</span>
                    </span>
                    <span className="mobile-headline">{lead.headline || lead.jobTitle || ''}</span>
                  </div>
                  {lead.profileUrl && (
                    <a
                      href={lead.profileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-table-action"
                    >
                      View ↗
                    </a>
                  )}
                </div>

                <div className="mobile-tags-row">
                  {lead.jobTitle && <span className="m-tag">💼 {lead.jobTitle}</span>}
                  {lead.company && <span className="m-tag">🏢 {lead.company}</span>}
                  {lead.location && <span className="m-tag">📍 {lead.location}</span>}
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
            <h3 className="empty-title">No prospects found</h3>
            <p className="empty-desc">Try refining your industry search terms, expanding location, or reducing mandatory role filters.</p>
          </div>
        </div>
      )}
    </div>
  );
}
