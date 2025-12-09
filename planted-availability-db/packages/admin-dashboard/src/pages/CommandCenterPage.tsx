import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { discoveryReviewApi, scrapersApi } from '../lib/api';

interface PlatformHealth {
  platform: string;
  successRate: number;
  avgResponseTime: number;
  status: 'healthy' | 'degraded' | 'down';
  lastCheck: string;
}

// Mock platform health data until API is ready
const mockPlatformHealth: PlatformHealth[] = [
  { platform: 'Wolt', successRate: 98.2, avgResponseTime: 1200, status: 'healthy', lastCheck: '2m ago' },
  { platform: 'Uber Eats', successRate: 94.5, avgResponseTime: 2100, status: 'healthy', lastCheck: '5m ago' },
  { platform: 'Lieferando', successRate: 72.1, avgResponseTime: 3400, status: 'degraded', lastCheck: '3m ago' },
  { platform: 'Just Eat', successRate: 0, avgResponseTime: 0, status: 'down', lastCheck: '1h ago' },
  { platform: 'Deliveroo', successRate: 88.9, avgResponseTime: 1800, status: 'healthy', lastCheck: '8m ago' },
];

function getStatusColor(status: PlatformHealth['status']): string {
  switch (status) {
    case 'healthy': return 'var(--success)';
    case 'degraded': return 'var(--warning)';
    case 'down': return 'var(--error)';
    default: return 'var(--text-light)';
  }
}

function getStatusBadgeClass(status: PlatformHealth['status']): string {
  switch (status) {
    case 'healthy': return 'badge-active';
    case 'degraded': return 'badge-stale';
    case 'down': return 'badge-archived';
    default: return '';
  }
}

function CommandCenterPage() {
  // Fetch discovery stats
  const { data: discoveryStats, isLoading: statsLoading } = useQuery({
    queryKey: ['discovery-stats'],
    queryFn: () => discoveryReviewApi.getStats(),
    refetchInterval: 30000,
  });

  // Fetch scraper status
  const { data: scraperData, isLoading: scraperLoading } = useQuery({
    queryKey: ['scraper-status'],
    queryFn: () => scrapersApi.getStatus({ limit: 10 }),
    refetchInterval: 30000,
  });

  const stats = discoveryStats;
  const currentlyRunning = scraperData?.currently_running || [];
  const recentRuns = scraperData?.runs?.slice(0, 5) || [];

  return (
    <>
      <header className="page-header">
        <h2>Command Center</h2>
        <p style={{ color: 'var(--text-light)', margin: '0.25rem 0 0' }}>
          Real-time overview of discovery, review, and platform health
        </p>
      </header>

      <div className="page-content">
        {/* Key Metrics Row */}
        <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
          <Link to="/review" style={{ textDecoration: 'none' }}>
            <div className="card stat-card" style={{ cursor: 'pointer', transition: 'transform 0.2s', border: '2px solid var(--warning)' }}>
              <span className="stat-label">Pending Review</span>
              <span className="stat-value" style={{ color: 'var(--warning)' }}>
                {statsLoading ? '-' : stats?.total_discovered || 0}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '0.25rem' }}>
                Click to review
              </span>
            </div>
          </Link>
          <div className="card stat-card">
            <span className="stat-label">Verified (All Time)</span>
            <span className="stat-value" style={{ color: 'var(--success)' }}>
              {statsLoading ? '-' : stats?.total_verified || 0}
            </span>
          </div>
          <div className="card stat-card">
            <span className="stat-label">Rejected</span>
            <span className="stat-value" style={{ color: 'var(--error)' }}>
              {statsLoading ? '-' : stats?.total_rejected || 0}
            </span>
          </div>
          <div className="card stat-card">
            <span className="stat-label">Active Scrapers</span>
            <span className="stat-value" style={{ color: currentlyRunning.length > 0 ? 'var(--primary)' : 'inherit' }}>
              {scraperLoading ? '-' : currentlyRunning.length}
            </span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          {/* Review Queue Widget */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>Review Queue</h3>
              <Link to="/review" className="btn btn-primary btn-sm">
                Start Review
              </Link>
            </div>

            {stats?.by_confidence && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.85rem' }}>High Confidence (70%+)</span>
                      <span style={{ fontWeight: 600, color: 'var(--success)' }}>{stats.by_confidence.high}</span>
                    </div>
                    <div style={{ height: '8px', background: 'var(--secondary)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${Math.min(100, (stats.by_confidence.high / (stats.total_discovered || 1)) * 100)}%`,
                        background: 'var(--success)',
                        borderRadius: '4px'
                      }} />
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.85rem' }}>Medium Confidence (40-70%)</span>
                      <span style={{ fontWeight: 600, color: 'var(--warning)' }}>{stats.by_confidence.medium}</span>
                    </div>
                    <div style={{ height: '8px', background: 'var(--secondary)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${Math.min(100, (stats.by_confidence.medium / (stats.total_discovered || 1)) * 100)}%`,
                        background: 'var(--warning)',
                        borderRadius: '4px'
                      }} />
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.85rem' }}>Low Confidence (&lt;40%)</span>
                      <span style={{ fontWeight: 600, color: 'var(--error)' }}>{stats.by_confidence.low}</span>
                    </div>
                    <div style={{ height: '8px', background: 'var(--secondary)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${Math.min(100, (stats.by_confidence.low / (stats.total_discovered || 1)) * 100)}%`,
                        background: 'var(--error)',
                        borderRadius: '4px'
                      }} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {stats?.by_country && Object.keys(stats.by_country).length > 0 && (
              <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                <h4 style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: '0.75rem' }}>By Country</h4>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {Object.entries(stats.by_country).map(([country, count]) => (
                    <Link
                      key={country}
                      to={`/review?country=${country}`}
                      style={{
                        padding: '0.35rem 0.75rem',
                        background: 'var(--secondary)',
                        borderRadius: '4px',
                        fontSize: '0.85rem',
                        textDecoration: 'none',
                        color: 'var(--text)',
                      }}
                    >
                      {country}: <strong>{count as number}</strong>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Platform Health Widget */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>Platform Health</h3>
              <Link to="/operations?tab=health" className="btn btn-secondary btn-sm">
                Details
              </Link>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {mockPlatformHealth.map((platform) => (
                <div
                  key={platform.platform}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.5rem 0',
                    borderBottom: '1px solid var(--border)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: getStatusColor(platform.status),
                    }} />
                    <span style={{ fontWeight: 500 }}>{platform.platform}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>
                      {platform.successRate > 0 ? `${platform.successRate}%` : '-'}
                    </span>
                    <span className={`badge ${getStatusBadgeClass(platform.status)}`}>
                      {platform.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Active Scrapers */}
        {currentlyRunning.length > 0 && (
          <div className="card" style={{ marginTop: '1.5rem', borderLeft: '4px solid var(--primary)' }}>
            <h3 style={{ marginBottom: '1rem' }}>Currently Running</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {currentlyRunning.map((run) => (
                <div
                  key={run.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.75rem',
                    background: 'var(--secondary)',
                    borderRadius: '4px',
                  }}
                >
                  <div>
                    <strong>{run.scraper_id}</strong>
                    <span style={{ color: 'var(--text-light)', marginLeft: '0.5rem', fontSize: '0.85rem' }}>
                      Started {new Date(run.started_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem' }}>
                      {run.stats.venues_checked} venues | {run.stats.dishes_found} dishes
                    </span>
                    <div className="loading-spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Activity */}
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>Recent Scraper Runs</h3>
            <Link to="/operations" className="btn btn-secondary btn-sm">
              View All
            </Link>
          </div>

          {recentRuns.length === 0 ? (
            <p style={{ color: 'var(--text-light)', textAlign: 'center', padding: '1rem' }}>
              No recent scraper runs
            </p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Scraper</th>
                  <th>Time</th>
                  <th>Venues</th>
                  <th>Dishes</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentRuns.map((run) => (
                  <tr key={run.id}>
                    <td><strong>{run.scraper_id}</strong></td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>
                      {new Date(run.started_at).toLocaleString()}
                    </td>
                    <td>{run.stats.venues_updated}/{run.stats.venues_checked}</td>
                    <td>{run.stats.dishes_updated}/{run.stats.dishes_found}</td>
                    <td>
                      <span className={`badge ${run.status === 'completed' ? 'badge-active' : run.status === 'failed' ? 'badge-archived' : 'badge-stale'}`}>
                        {run.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Quick Actions */}
        <div className="card" style={{ marginTop: '1.5rem', background: 'var(--secondary)' }}>
          <h3 style={{ marginBottom: '1rem' }}>Quick Actions</h3>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <Link to="/review" className="btn btn-primary">
              Review Discovered Venues
            </Link>
            <Link to="/operations" className="btn btn-secondary">
              Manage Scrapers
            </Link>
            <Link to="/browser" className="btn btn-secondary">
              Browse Production Data
            </Link>
            <Link to="/operations?tab=sync" className="btn btn-secondary">
              Sync to Website
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

export default CommandCenterPage;
