import React, { useState } from 'react';
import './App.css';
import LinkedInScraper from './components/LinkedInScraper';
import RedditScraper from './components/RedditScraper';
import GmbScraper from './components/GmbScraper';

function App() {
  const [activeTab, setActiveTab] = useState('linkedin');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-container">
      {/* Mobile Top Navigation Header */}
      <header className="mobile-header">
        <button
          className="hamburger-btn"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Toggle navigation menu"
        >
          {sidebarOpen ? '✕' : '☰'}
        </button>
        <div className="mobile-logo">
          <span className="logo-icon">⚡</span>
          <span className="logo-text">LeadHarvest</span>
        </div>
      </header>

      {/* Sidebar Overlay for Mobile */}
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-logo">
            <span className="logo-icon">⚡</span>
            <span className="logo-text">LeadHarvest</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">Scraper Engine</div>

          <button
            id="tab-linkedin"
            className={`nav-item ${activeTab === 'linkedin' ? 'active linkedin-active' : ''}`}
            onClick={() => {
              setActiveTab('linkedin');
              setSidebarOpen(false);
            }}
          >
            <span className="nav-icon li-icon">in</span>
            <div className="nav-info">
              <span className="nav-title">LinkedIn People</span>
              <span className="nav-sub">Target Decision Makers</span>
            </div>
          </button>

          <button
            id="tab-reddit"
            className={`nav-item ${activeTab === 'reddit' ? 'active reddit-active' : ''}`}
            onClick={() => {
              setActiveTab('reddit');
              setSidebarOpen(false);
            }}
          >
            <span className="nav-icon rd-icon">🤖</span>
            <div className="nav-info">
              <span className="nav-title">Reddit Intent</span>
              <span className="nav-sub">Mine Market Demand</span>
            </div>
          </button>

          <button
            id="tab-gmb"
            className={`nav-item ${activeTab === 'gmb' ? 'active gmb-active' : ''}`}
            onClick={() => {
              setActiveTab('gmb');
              setSidebarOpen(false);
            }}
          >
            <span className="nav-icon gmb-icon">📍</span>
            <div className="nav-info">
              <span className="nav-title">Google Maps</span>
              <span className="nav-sub">Local Businesses</span>
            </div>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="status-badge">
            <span className="status-dot"></span>
            <span className="status-text">Apify Engine Connected</span>
          </div>
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="main-content">
        <header className="top-header">
          <div className="top-header-content">
            <div className="header-titles">
              <h1 className="page-title">
                {activeTab === 'linkedin' ? 'LinkedIn Lead Discovery' : 
                 activeTab === 'reddit' ? 'Reddit Discussion Mining' : 
                 'Google Maps (GMB) Scraper'}
              </h1>
              <p className="page-subtitle">
                {activeTab === 'linkedin'
                  ? 'Find decision makers by job title, industry, and location without cookies or credentials.'
                  : activeTab === 'reddit'
                  ? 'Find active Reddit discussions and posts matching your exact customer intent queries.'
                  : 'Extract local business leads with contact details, websites, ratings, and phone numbers.'}
              </p>
            </div>

            <div className="header-tabs-quick">
              <button
                className={`quick-tab-btn ${activeTab === 'linkedin' ? 'active-li' : ''}`}
                onClick={() => setActiveTab('linkedin')}
              >
                LinkedIn
              </button>
              <button
                className={`quick-tab-btn ${activeTab === 'reddit' ? 'active-rd' : ''}`}
                onClick={() => setActiveTab('reddit')}
              >
                Reddit
              </button>
              <button
                className={`quick-tab-btn ${activeTab === 'gmb' ? 'active-gmb' : ''}`}
                onClick={() => setActiveTab('gmb')}
              >
                Google Maps
              </button>
            </div>
          </div>
        </header>

        <div className="workspace-area">
          {activeTab === 'linkedin' && <LinkedInScraper />}
          {activeTab === 'reddit' && <RedditScraper />}
          {activeTab === 'gmb' && <GmbScraper />}
        </div>

        <footer className="dashboard-footer">
          <p>
            LeadHarvest Dashboard · Powered by Apify Actors ·{' '}
            <span className="footer-actors">
              automly/linkedin-people-search-scraper · trudax/reddit-scraper-lite · compass/crawler-google-places
            </span>
          </p>
        </footer>
      </main>
    </div>
  );
}

export default App;
