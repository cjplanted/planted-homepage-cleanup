import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../hooks/useNotifications';
import NotificationBell from './NotificationBell';
import NotificationPanel from './NotificationPanel';

function Layout() {
  const { signOut } = useAuth();
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearAll,
  } = useNotifications();
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [showLegacyNav, setShowLegacyNav] = useState(false);

  const togglePanel = () => {
    setIsPanelOpen(!isPanelOpen);
  };

  const closePanel = () => {
    setIsPanelOpen(false);
  };

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>PAD Admin</h1>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-light)', marginTop: '0.25rem' }}>
            v2.0 - Redesigned
          </div>
        </div>
        <nav className="sidebar-nav">
          {/* Primary Navigation */}
          <div style={{ marginBottom: '0.5rem' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-light)', padding: '0.5rem 1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Main
            </div>
            <NavLink
              to="/"
              end
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              Command Center
            </NavLink>
            <NavLink
              to="/review"
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              Review Queue
            </NavLink>
            <NavLink
              to="/browser"
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              Data Browser
            </NavLink>
            <NavLink
              to="/operations"
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              Operations
            </NavLink>
          </div>

          {/* Legacy Navigation Toggle */}
          <div style={{ borderTop: '1px solid var(--border)', marginTop: '0.5rem', paddingTop: '0.5rem' }}>
            <button
              onClick={() => setShowLegacyNav(!showLegacyNav)}
              style={{
                width: '100%',
                padding: '0.5rem 1rem',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                color: 'var(--text-light)',
                fontSize: '0.7rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              <span>More Tools</span>
              <span>{showLegacyNav ? '−' : '+'}</span>
            </button>

            {showLegacyNav && (
              <>
                <NavLink
                  to="/venues"
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                >
                  Venues (Legacy)
                </NavLink>
                <NavLink
                  to="/dishes"
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                >
                  Dishes
                </NavLink>
                <NavLink
                  to="/scrapers"
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                >
                  Scrapers (Legacy)
                </NavLink>
                <NavLink
                  to="/promotions"
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                >
                  Promotions
                </NavLink>
                <NavLink
                  to="/moderation"
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                >
                  Moderation
                </NavLink>
                <NavLink
                  to="/discovery-review"
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                >
                  Discovery (Legacy)
                </NavLink>
                <NavLink
                  to="/partners"
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                >
                  Partners
                </NavLink>
                <NavLink
                  to="/budget"
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                >
                  Budget Monitor
                </NavLink>
                <NavLink
                  to="/analytics"
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                >
                  Analytics
                </NavLink>
                <NavLink
                  to="/import"
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                >
                  Batch Import
                </NavLink>
              </>
            )}
          </div>
        </nav>
        <div style={{ padding: '1rem' }}>
          <button className="btn btn-secondary" onClick={signOut} style={{ width: '100%' }}>
            Sign Out
          </button>
        </div>
      </aside>
      <div className="main-container">
        <header className="top-header">
          <div className="header-content">
            <div className="header-title">
              <h2>Planted Availability Dashboard</h2>
            </div>
            <div className="header-actions">
              <div className="notification-container">
                <NotificationBell
                  unreadCount={unreadCount}
                  onClick={togglePanel}
                  isOpen={isPanelOpen}
                />
                <NotificationPanel
                  notifications={notifications}
                  isOpen={isPanelOpen}
                  onClose={closePanel}
                  onMarkAsRead={markAsRead}
                  onMarkAllAsRead={markAllAsRead}
                  onClearAll={clearAll}
                />
              </div>
            </div>
          </div>
        </header>
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default Layout;
