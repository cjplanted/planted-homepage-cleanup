import { useQuery } from '@tanstack/react-query';
import { scrapersApi, type ScraperRun } from '../lib/api';

function formatDuration(startedAt: string, completedAt?: string): string {
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const durationMs = end - start;

  if (durationMs < 1000) return '<1s';
  if (durationMs < 60000) return `${Math.round(durationMs / 1000)}s`;
  if (durationMs < 3600000) return `${Math.round(durationMs / 60000)}m`;
  return `${Math.round(durationMs / 3600000)}h`;
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  // If less than 24 hours ago, show relative time
  if (diffMs < 86400000) {
    if (diffMs < 60000) return 'Just now';
    if (diffMs < 3600000) return `${Math.round(diffMs / 60000)}m ago`;
    return `${Math.round(diffMs / 3600000)}h ago`;
  }

  // Otherwise show date
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusBadgeClass(status: ScraperRun['status']): string {
  switch (status) {
    case 'running':
      return 'badge-running';
    case 'completed':
      return 'badge-active';
    case 'failed':
      return 'badge-archived';
    case 'partial':
      return 'badge-stale';
    default:
      return '';
  }
}

function ScrapersPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['scraper-status'],
    queryFn: () => scrapersApi.getStatus({ limit: 50 }),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const runs = data?.runs || [];
  const currentlyRunning = data?.currently_running || [];
  const summary = data?.summary;

  return (
    <>
      <header className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Scrapers</h2>
          <button
            className="btn btn-secondary"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </header>

      <div className="page-content">
        {isError && (
          <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
            Failed to load scraper status. Please try again.
          </div>
        )}

        <div className="stats-grid">
          <div className="card stat-card">
            <span className="stat-label">Running</span>
            <span className="stat-value" style={{ color: currentlyRunning.length > 0 ? 'var(--primary)' : undefined }}>
              {isLoading ? '-' : currentlyRunning.length}
            </span>
          </div>
          <div className="card stat-card">
            <span className="stat-label">Completed (24h)</span>
            <span className="stat-value" style={{ color: 'var(--success)' }}>
              {isLoading ? '-' : summary?.successful_24h || 0}
            </span>
          </div>
          <div className="card stat-card">
            <span className="stat-label">Failed (24h)</span>
            <span className="stat-value" style={{ color: (summary?.failed_24h || 0) > 0 ? 'var(--danger)' : undefined }}>
              {isLoading ? '-' : summary?.failed_24h || 0}
            </span>
          </div>
          <div className="card stat-card">
            <span className="stat-label">Success Rate</span>
            <span className="stat-value">
              {isLoading ? '-' : summary?.success_rate_24h !== null ? `${summary?.success_rate_24h}%` : '--'}
            </span>
          </div>
        </div>

        {/* Currently Running */}
        {currentlyRunning.length > 0 && (
          <div className="card" style={{ marginBottom: '1rem', borderLeft: '4px solid var(--primary)' }}>
            <h3 style={{ marginBottom: '1rem' }}>Currently Running</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {currentlyRunning.map((run) => (
                <div
                  key={run.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.5rem',
                    background: 'var(--bg-secondary)',
                    borderRadius: '4px',
                  }}
                >
                  <div>
                    <strong>{run.scraper_id}</strong>
                    <span style={{ color: 'var(--text-light)', marginLeft: '0.5rem' }}>
                      Started {formatTime(run.started_at)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-light)' }}>
                      {run.stats.venues_checked} venues | {run.stats.dishes_found} dishes
                    </span>
                    <span className="badge badge-running">Running</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Runs Table */}
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>Recent Runs</h3>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <div className="loading-spinner" />
              <p>Loading scraper status...</p>
            </div>
          ) : runs.length === 0 ? (
            <p style={{ color: 'var(--text-light)', textAlign: 'center', padding: '2rem' }}>
              No scraper runs found. Scrapers will appear here when they run.
            </p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Scraper</th>
                  <th>Started</th>
                  <th>Duration</th>
                  <th>Venues</th>
                  <th>Dishes</th>
                  <th>Errors</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id}>
                    <td>
                      <strong>{run.scraper_id}</strong>
                    </td>
                    <td>{formatTime(run.started_at)}</td>
                    <td>{formatDuration(run.started_at, run.completed_at)}</td>
                    <td>
                      {run.stats.venues_updated}/{run.stats.venues_checked}
                    </td>
                    <td>
                      {run.stats.dishes_updated}/{run.stats.dishes_found}
                    </td>
                    <td style={{ color: run.stats.errors > 0 ? 'var(--danger)' : undefined }}>
                      {run.stats.errors}
                    </td>
                    <td>
                      <span className={`badge ${getStatusBadgeClass(run.status)}`}>
                        {run.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Scraper Configuration Info */}
        <div className="card" style={{ marginTop: '1rem', background: 'var(--bg-secondary)' }}>
          <h3 style={{ marginBottom: '0.5rem' }}>Scheduled Scrapers</h3>
          <div style={{ color: 'var(--text-light)', fontSize: '0.875rem' }}>
            <p style={{ marginBottom: '0.5rem' }}>
              <strong>Daily Orchestrator:</strong> Runs at 4:00 AM CET to coordinate scraping jobs
            </p>
            <p style={{ marginBottom: '0.5rem' }}>
              <strong>Hourly Freshness Check:</strong> Runs every hour to mark stale data
            </p>
            <p>
              <strong>Available Scrapers:</strong> Wolt (DE/AT)
            </p>
          </div>
        </div>
      </div>

      <style>{`
        .badge-running {
          background: var(--primary);
          color: white;
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </>
  );
}

export default ScrapersPage;
