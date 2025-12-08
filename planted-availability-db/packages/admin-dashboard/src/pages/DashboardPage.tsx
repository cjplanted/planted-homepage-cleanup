function DashboardPage() {
  // In a real app, this would fetch from the API
  const stats = {
    totalVenues: 0,
    totalDishes: 0,
    activeScrapers: 0,
    recentChanges: 0,
  };

  return (
    <>
      <header className="page-header">
        <h2>Dashboard</h2>
      </header>
      <div className="page-content">
        <div className="stats-grid">
          <div className="card stat-card">
            <span className="stat-label">Total Venues</span>
            <span className="stat-value">{stats.totalVenues}</span>
          </div>
          <div className="card stat-card">
            <span className="stat-label">Total Dishes</span>
            <span className="stat-value">{stats.totalDishes}</span>
          </div>
          <div className="card stat-card">
            <span className="stat-label">Active Scrapers</span>
            <span className="stat-value">{stats.activeScrapers}</span>
          </div>
          <div className="card stat-card">
            <span className="stat-label">Changes (24h)</span>
            <span className="stat-value">{stats.recentChanges}</span>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>Recent Activity</h3>
          <p style={{ color: 'var(--text-light)' }}>
            No recent activity. Connect to Firebase to see live data.
          </p>
        </div>
      </div>
    </>
  );
}

export default DashboardPage;
