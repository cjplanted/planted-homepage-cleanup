import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

function Layout() {
  const { signOut } = useAuth();

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>PAD Admin</h1>
        </div>
        <nav className="sidebar-nav">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/venues"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            Venues
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
            Scrapers
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
            to="/partners"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            Partners
          </NavLink>
        </nav>
        <div style={{ padding: '1rem' }}>
          <button className="btn btn-secondary" onClick={signOut} style={{ width: '100%' }}>
            Sign Out
          </button>
        </div>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;
