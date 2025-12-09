import { useState, useEffect } from 'react';

interface PoolStats {
  freeQueriesUsed: number;
  freeQueriesTotal: number;
  paidQueriesUsed: number;
  estimatedCost: number;
  mode: 'free' | 'paid';
  totalCredentials: number;
  activeCredentials: number;
}

interface CacheStats {
  totalCached: number;
  skippedToday: number;
}

interface BudgetStats {
  pool: PoolStats;
  cache: CacheStats;
  efficiency: {
    queriesPerVenue: number;
    discoveryRate: number;
    costPerVenue: number;
  };
  dailyHistory: {
    date: string;
    freeQueries: number;
    paidQueries: number;
    venuesFound: number;
    cost: number;
  }[];
}

function BudgetMonitoringPage() {
  const [stats, setStats] = useState<BudgetStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBudgetStats();
  }, []);

  const fetchBudgetStats = async () => {
    try {
      setLoading(true);
      // In production, this would call the API
      // const response = await fetch('/api/budget/stats');
      // const data = await response.json();

      // Mock data for now
      const mockStats: BudgetStats = {
        pool: {
          freeQueriesUsed: 245,
          freeQueriesTotal: 600,
          paidQueriesUsed: 0,
          estimatedCost: 0,
          mode: 'free',
          totalCredentials: 6,
          activeCredentials: 6,
        },
        cache: {
          totalCached: 1250,
          skippedToday: 89,
        },
        efficiency: {
          queriesPerVenue: 4.2,
          discoveryRate: 23.8,
          costPerVenue: 0.02,
        },
        dailyHistory: [
          { date: '2024-12-09', freeQueries: 245, paidQueries: 0, venuesFound: 58, cost: 0 },
          { date: '2024-12-08', freeQueries: 600, paidQueries: 120, venuesFound: 156, cost: 0.60 },
          { date: '2024-12-07', freeQueries: 520, paidQueries: 0, venuesFound: 112, cost: 0 },
        ],
      };

      setStats(mockStats);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch stats');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <>
        <header className="page-header">
          <h2>Budget Monitoring</h2>
        </header>
        <div className="page-content">
          <p>Loading...</p>
        </div>
      </>
    );
  }

  if (error || !stats) {
    return (
      <>
        <header className="page-header">
          <h2>Budget Monitoring</h2>
        </header>
        <div className="page-content">
          <div className="card" style={{ color: 'var(--danger)' }}>
            Error: {error || 'No data available'}
          </div>
        </div>
      </>
    );
  }

  const freePercentage = (stats.pool.freeQueriesUsed / stats.pool.freeQueriesTotal) * 100;
  // Total queries used for potential future display
  const _totalQueries = stats.pool.freeQueriesUsed + stats.pool.paidQueriesUsed;
  void _totalQueries; // Suppress unused variable warning

  return (
    <>
      <header className="page-header">
        <h2>Budget Monitoring</h2>
        <button className="btn btn-primary" onClick={fetchBudgetStats}>
          Refresh
        </button>
      </header>

      <div className="page-content">
        {/* Mode Indicator */}
        <div
          className="card"
          style={{
            backgroundColor: stats.pool.mode === 'free' ? 'var(--success-bg)' : 'var(--warning-bg)',
            marginBottom: '1.5rem',
            textAlign: 'center',
            padding: '1rem',
          }}
        >
          <span style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
            {stats.pool.mode === 'free' ? '🆓 FREE MODE' : '💰 PAID MODE'}
          </span>
          <p style={{ margin: '0.5rem 0 0', opacity: 0.8 }}>
            {stats.pool.mode === 'free'
              ? `${stats.pool.freeQueriesTotal - stats.pool.freeQueriesUsed} free queries remaining`
              : `$${stats.pool.estimatedCost.toFixed(2)} spent today`
            }
          </p>
        </div>

        {/* Stats Grid */}
        <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
          <div className="card stat-card">
            <span className="stat-label">Free Queries Used</span>
            <span className="stat-value">{stats.pool.freeQueriesUsed} / {stats.pool.freeQueriesTotal}</span>
          </div>
          <div className="card stat-card">
            <span className="stat-label">Paid Queries</span>
            <span className="stat-value">{stats.pool.paidQueriesUsed}</span>
          </div>
          <div className="card stat-card">
            <span className="stat-label">Estimated Cost</span>
            <span className="stat-value">${stats.pool.estimatedCost.toFixed(2)}</span>
          </div>
          <div className="card stat-card">
            <span className="stat-label">Cache Skipped</span>
            <span className="stat-value">{stats.cache.skippedToday}</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Free Quota Usage</h3>
          <div
            style={{
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '8px',
              height: '24px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${Math.min(freePercentage, 100)}%`,
                height: '100%',
                backgroundColor: freePercentage >= 90 ? 'var(--danger)' : freePercentage >= 70 ? 'var(--warning)' : 'var(--success)',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--text-light)' }}>
            <span>0</span>
            <span>{freePercentage.toFixed(1)}%</span>
            <span>{stats.pool.freeQueriesTotal}</span>
          </div>
        </div>

        {/* Efficiency Metrics */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Efficiency Metrics</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                {stats.efficiency.queriesPerVenue.toFixed(1)}
              </div>
              <div style={{ color: 'var(--text-light)', fontSize: '0.875rem' }}>Queries per Venue</div>
              <div style={{ fontSize: '0.75rem', color: stats.efficiency.queriesPerVenue <= 5 ? 'var(--success)' : 'var(--warning)' }}>
                Target: &lt;5
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                {stats.efficiency.discoveryRate.toFixed(1)}%
              </div>
              <div style={{ color: 'var(--text-light)', fontSize: '0.875rem' }}>Discovery Rate</div>
              <div style={{ fontSize: '0.75rem', color: stats.efficiency.discoveryRate >= 20 ? 'var(--success)' : 'var(--warning)' }}>
                Target: &gt;20%
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                ${stats.efficiency.costPerVenue.toFixed(2)}
              </div>
              <div style={{ color: 'var(--text-light)', fontSize: '0.875rem' }}>Cost per Venue</div>
              <div style={{ fontSize: '0.75rem', color: stats.efficiency.costPerVenue <= 0.05 ? 'var(--success)' : 'var(--warning)' }}>
                Target: &lt;$0.05
              </div>
            </div>
          </div>
        </div>

        {/* Search Engine Status */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Search Engines ({stats.pool.activeCredentials}/{stats.pool.totalCredentials} active)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.5rem' }}>
            {Array.from({ length: 6 }, (_, i) => {
              const engineUsed = Math.floor(stats.pool.freeQueriesUsed / 6) + (i < stats.pool.freeQueriesUsed % 6 ? 1 : 0);
              const percentage = Math.min((engineUsed / 100) * 100, 100);
              return (
                <div
                  key={i}
                  style={{
                    padding: '0.75rem',
                    backgroundColor: 'var(--bg-secondary)',
                    borderRadius: '8px',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>Engine {i + 1}</div>
                  <div
                    style={{
                      height: '4px',
                      backgroundColor: 'var(--bg-tertiary)',
                      borderRadius: '2px',
                      marginBottom: '0.25rem',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${percentage}%`,
                        backgroundColor: percentage >= 100 ? 'var(--danger)' : 'var(--success)',
                        borderRadius: '2px',
                      }}
                    />
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
                    {Math.min(engineUsed, 100)}/100
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Query Cache */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Query Cache</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <div style={{ color: 'var(--text-light)', marginBottom: '0.25rem' }}>Total Cached Queries</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.cache.totalCached.toLocaleString()}</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-light)', marginBottom: '0.25rem' }}>Skipped Today (Cache Hits)</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--success)' }}>{stats.cache.skippedToday}</div>
            </div>
          </div>
          <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px' }}>
            <strong>Cache Savings:</strong> {stats.cache.skippedToday} queries saved = ${(stats.cache.skippedToday * 0.005).toFixed(2)} potential cost avoided
          </div>
        </div>

        {/* Daily History */}
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>Daily History</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ textAlign: 'left', padding: '0.75rem' }}>Date</th>
                <th style={{ textAlign: 'right', padding: '0.75rem' }}>Free</th>
                <th style={{ textAlign: 'right', padding: '0.75rem' }}>Paid</th>
                <th style={{ textAlign: 'right', padding: '0.75rem' }}>Venues</th>
                <th style={{ textAlign: 'right', padding: '0.75rem' }}>Cost</th>
              </tr>
            </thead>
            <tbody>
              {stats.dailyHistory.map((day) => (
                <tr key={day.date} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.75rem' }}>{day.date}</td>
                  <td style={{ textAlign: 'right', padding: '0.75rem' }}>{day.freeQueries}</td>
                  <td style={{ textAlign: 'right', padding: '0.75rem' }}>{day.paidQueries}</td>
                  <td style={{ textAlign: 'right', padding: '0.75rem' }}>{day.venuesFound}</td>
                  <td style={{ textAlign: 'right', padding: '0.75rem' }}>${day.cost.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

export default BudgetMonitoringPage;
