import React, { useState, useMemo } from 'react';
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

export default function GmbScraper() {
  const [search, setSearch] = useState('');
  const [location, setLocation] = useState('');
  const [limit, setLimit] = useState(20);
  const [websiteFilter, setWebsiteFilter] = useState('all'); // 'all', 'with_website', 'without_website'
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

    if (!search.trim()) {
      setError('Enter a search term (e.g., plumbers, dental clinic).');
      return;
    }

    setLoading(true);
    try {
      const result = await searchLeads({
        platform: 'gmb',
        search: search.trim(),
        location: location.trim(),
        limit,
        websiteFilter
      });
      setLeads(result.leads || []);
      setRunId(result.runId || '');
      setSearched(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (websiteFilter === 'with_website') return lead.hasWebsite;
      if (websiteFilter === 'without_website') return !lead.hasWebsite;
      return true; // 'all'
    });
  }, [leads, websiteFilter]);

  const handleExport = () => {
    exportToCSV(filteredLeads, `gmb-leads-${Date.now()}.csv`);
  };

  return (
    <div className="scraper-container">
      <div className="search-grid">
        <div className="card form-card">
          <div className="card-header">
            <div className="header-icon-badge gmb-badge-icon">
              <span style={{ fontSize: '1.5rem' }}>📍</span>
            </div>
            <div>
              <h2 className="card-title">Google Maps Extraction</h2>
              <p className="card-desc">Extract local businesses, phone numbers, and websites directly from Google Maps.</p>
            </div>
          </div>

          <div className="actor-info-badge">
            <span className="info-icon">⚙</span> Actor: <strong>compass/crawler-google-places</strong>
          </div>

          <form onSubmit={handleSubmit} className="search-form">
            <div className="form-group">
              <label className="form-label" htmlFor="gmb-search">Search Term</label>
              <div className="input-with-icon">
                <span className="input-icon">🔍</span>
                <input
                  id="gmb-search"
                  type="text"
                  className="form-input gmb-focus"
                  placeholder="e.g. plumbers, coffee shop"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <p className="form-hint">Type of business or keyword.</p>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="gmb-location">Location</label>
                <div className="input-with-icon">
                  <span className="input-icon">📍</span>
                  <input
                    id="gmb-location"
                    type="text"
                    className="form-input gmb-focus"
                    placeholder="e.g. New York, London"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>
                <p className="form-hint">Target city, region, or area.</p>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="gmb-limit">Number of Results</label>
                <div className="input-with-icon">
                  <span className="input-icon">📊</span>
                  <input
                    id="gmb-limit"
                    type="number"
                    min={1}
                    max={100}
                    className="form-input gmb-focus"
                    value={limit}
                    onChange={(e) => setLimit(e.target.value)}
                  />
                </div>
                <p className="form-hint">1–100 businesses per search.</p>
              </div>
            </div>

            <button
              id="btn-scrape-gmb"
              type="submit"
              className="btn btn-primary-gradient btn-gmb"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="btn-spinner" />
                  Searching Google Maps...
                </>
              ) : (
                <>
                  📍 Find {limit || 20} Businesses <span className="btn-arrow">→</span>
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
              <p className="summary-desc">Your Google Maps search parameters.</p>
            </div>
          </div>

          <div className="summary-list">
            <div className="summary-item">
              <div className="summary-icon-box box-blue">🔍</div>
              <div className="summary-details">
                <span className="summary-label">Search Query</span>
                <span className="summary-value">{search.trim() || 'Any Business'}</span>
              </div>
            </div>

            <div className="summary-item">
              <div className="summary-icon-box box-green">📍</div>
              <div className="summary-details">
                <span className="summary-label">Target Location</span>
                <span className="summary-value">{location.trim() || 'Worldwide'}</span>
              </div>
            </div>

            <div className="summary-item">
              <div className="summary-icon-box box-orange">📊</div>
              <div className="summary-details">
                <span className="summary-label">Result Limit</span>
                <span className="summary-value">{limit || 20} places</span>
              </div>
            </div>
          </div>

          <div className="summary-footer-box">
            <span className="footer-box-icon">⚡</span>
            <div className="footer-box-text">
              <strong>Local Lead Generation</strong>
              <span>Fetch business names, phone numbers, websites, and ratings.</span>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert-banner alert-error">
          <span className="alert-icon">⚠️</span>
          <div>
            <strong>Error: </strong>
            {error}
          </div>
        </div>
      )}

      {loading && (
        <div className="card loading-card">
          <div className="loading-content">
            <div className="spinner spinner-gmb" />
            <h3 className="loading-title">Extracting Google Maps Data...</h3>
            <p className="loading-sub">Connecting to Apify Actor. This usually takes 20–60 seconds.</p>
          </div>
        </div>
      )}

      {!loading && leads.length > 0 && (
        <div className="card results-card">
          <div className="results-top-bar" style={{ flexWrap: 'wrap', gap: '16px' }}>
            <div className="results-status-group">
              <span className="check-circle-badge check-gmb">✓</span>
              <div>
                <h3 className="results-status-title">
                  {filteredLeads.length} Businesses Found
                </h3>
                <p className="results-status-meta">
                  {location || 'Global'} · {search || 'Business Search'}
                  {runId && <> · Run ID: <code>{runId.slice(0, 8)}</code></>}
                </p>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginLeft: 'auto' }}>
              <div className="filter-group">
                <select 
                  className="form-select" 
                  value={websiteFilter} 
                  onChange={(e) => setWebsiteFilter(e.target.value)}
                  style={{ minWidth: '180px' }}
                >
                  <option value="all">All Leads</option>
                  <option value="with_website">With Website Only</option>
                  <option value="without_website">Without Website Only</option>
                </select>
              </div>
              <button id="btn-export-gmb" className="btn btn-export" onClick={handleExport}>
                ⬇ Export CSV
              </button>
            </div>
          </div>

          <div className="table-responsive desktop-only">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Business Name</th>
                  <th>Category / Rating</th>
                  <th>Contact Info</th>
                  <th>Website Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead, i) => (
                  <tr key={lead.sourceUrl || i}>
                    <td>
                      <div className="table-prospect">
                        <div className="avatar gmb-avatar-bg">{getInitials(lead.name)}</div>
                        <div className="prospect-names">
                          <span className="prospect-name">{lead.name || 'Unknown Business'}</span>
                          <span className="prospect-headline">{lead.location || lead.city || lead.address || ''}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="table-cell-group flex-gap-2">
                        {lead.category && <span className="m-tag">{lead.category}</span>}
                        {lead.rating && <span className="stat-pill score-pill">⭐ {lead.rating} ({lead.reviewsCount || 0})</span>}
                      </div>
                    </td>
                    <td>
                      <div className="table-cell-group">
                        <span className="cell-icon">📞</span>
                        <span className="cell-text font-medium">{lead.phone || 'No phone'}</span>
                      </div>
                    </td>
                    <td>
                      <div className="table-cell-group">
                        {lead.hasWebsite ? (
                          <span className="website-badge yes">🌐 Has Website</span>
                        ) : (
                          <span className="website-badge no">❌ No Website</span>
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        {lead.website && (
                          <a href={lead.website} target="_blank" rel="noreferrer" className="btn-table-action">
                            Website ↗
                          </a>
                        )}
                        {lead.sourceUrl && (
                          <a href={lead.sourceUrl} target="_blank" rel="noreferrer" className="btn-table-action">
                            Maps ↗
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card Layout */}
          <div className="leads-mobile-list mobile-only">
            {filteredLeads.map((lead, i) => (
              <div key={lead.sourceUrl || i} className="mobile-lead-card">
                <div className="mobile-card-top">
                  <div className="avatar gmb-avatar-bg">{getInitials(lead.name)}</div>
                  <div className="mobile-card-names">
                    <span className="mobile-name">{lead.name || 'Unknown Business'}</span>
                    <span className="mobile-headline">{lead.location || lead.city || lead.address || ''}</span>
                  </div>
                </div>

                <div className="mobile-tags-row" style={{ marginTop: '12px' }}>
                  {lead.category && <span className="m-tag">{lead.category}</span>}
                  {lead.rating && <span className="m-tag">⭐ {lead.rating} ({lead.reviewsCount || 0})</span>}
                  <span className="m-tag">📞 {lead.phone || 'No phone'}</span>
                  {lead.hasWebsite ? (
                    <span className="m-tag" style={{ background: '#dcfce7', color: '#16a34a' }}>🌐 Website</span>
                  ) : (
                    <span className="m-tag" style={{ background: '#fee2e2', color: '#dc2626' }}>❌ No Website</span>
                  )}
                </div>
                
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  {lead.website && (
                    <a href={lead.website} target="_blank" rel="noreferrer" className="btn-table-action" style={{ flex: 1, textAlign: 'center' }}>
                      Website ↗
                    </a>
                  )}
                  {lead.sourceUrl && (
                    <a href={lead.sourceUrl} target="_blank" rel="noreferrer" className="btn-table-action" style={{ flex: 1, textAlign: 'center' }}>
                      Google Maps ↗
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          {filteredLeads.length === 0 && (
             <div className="empty-content" style={{ padding: '40px 0', textAlign: 'center' }}>
               <span className="empty-icon">🔍</span>
               <h3 className="empty-title">No businesses match the current filter</h3>
             </div>
          )}
        </div>
      )}

      {!loading && !error && searched && leads.length === 0 && (
        <div className="card empty-card">
          <div className="empty-content">
            <span className="empty-icon">🔍</span>
            <h3 className="empty-title">No businesses found</h3>
            <p className="empty-desc">Try modifying your search term or location.</p>
          </div>
        </div>
      )}
    </div>
  );
}
