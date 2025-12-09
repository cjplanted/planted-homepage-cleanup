import { useState, useEffect } from 'react';

interface SuccessRateDataPoint {
  date: string;
  successRate: number;
  totalAttempts: number;
  successful: number;
}

interface PlatformCoverage {
  country: string;
  platforms: {
    google: number;
    tripadvisor: number;
    yelp: number;
    thefork: number;
  };
  total: number;
}

interface StrategyPerformance {
  strategy: string;
  venuesFound: number;
  successRate: number;
  avgQueriesPerVenue: number;
  totalQueries: number;
}

interface AnalyticsData {
  overview: {
    totalVenues: number;
    totalVenuesChange: number;
    overallSuccessRate: number;
    successRateChange: number;
    avgCostPerVenue: number;
    costChange: number;
  };
  successRateOverTime: SuccessRateDataPoint[];
  platformCoverage: PlatformCoverage[];
  efficiency: {
    queriesPerVenue: number;
    discoveryRate: number;
    costPerVenue: number;
  };
  venuesPerDay: {
    date: string;
    venues: number;
    avgSuccessRate: number;
  }[];
  topStrategies: StrategyPerformance[];
}

function AnalyticsDashboardPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      // In production, this would call the API
      // const response = await fetch(`/api/analytics?range=${dateRange}`);
      // const data = await response.json();

      // Mock data for now
      const mockData: AnalyticsData = {
        overview: {
          totalVenues: 1247,
          totalVenuesChange: 8.5,
          overallSuccessRate: 24.3,
          successRateChange: 2.1,
          avgCostPerVenue: 0.023,
          costChange: -5.2,
        },
        successRateOverTime: [
          { date: '2024-12-02', successRate: 22.5, totalAttempts: 450, successful: 101 },
          { date: '2024-12-03', successRate: 23.1, totalAttempts: 520, successful: 120 },
          { date: '2024-12-04', successRate: 21.8, totalAttempts: 490, successful: 107 },
          { date: '2024-12-05', successRate: 24.6, totalAttempts: 510, successful: 125 },
          { date: '2024-12-06', successRate: 25.2, totalAttempts: 530, successful: 134 },
          { date: '2024-12-07', successRate: 24.8, totalAttempts: 505, successful: 125 },
          { date: '2024-12-08', successRate: 26.1, totalAttempts: 540, successful: 141 },
          { date: '2024-12-09', successRate: 24.3, totalAttempts: 480, successful: 117 },
        ],
        platformCoverage: [
          {
            country: 'Germany',
            platforms: { google: 342, tripadvisor: 298, yelp: 187, thefork: 156 },
            total: 456,
          },
          {
            country: 'Austria',
            platforms: { google: 189, tripadvisor: 145, yelp: 98, thefork: 112 },
            total: 234,
          },
          {
            country: 'Switzerland',
            platforms: { google: 156, tripadvisor: 134, yelp: 89, thefork: 98 },
            total: 187,
          },
          {
            country: 'Netherlands',
            platforms: { google: 123, tripadvisor: 98, yelp: 67, thefork: 78 },
            total: 145,
          },
          {
            country: 'Belgium',
            platforms: { google: 98, tripadvisor: 76, yelp: 45, thefork: 56 },
            total: 112,
          },
        ],
        efficiency: {
          queriesPerVenue: 4.2,
          discoveryRate: 24.3,
          costPerVenue: 0.023,
        },
        venuesPerDay: [
          { date: '2024-12-02', venues: 101, avgSuccessRate: 22.5 },
          { date: '2024-12-03', venues: 120, avgSuccessRate: 23.1 },
          { date: '2024-12-04', venues: 107, avgSuccessRate: 21.8 },
          { date: '2024-12-05', venues: 125, avgSuccessRate: 24.6 },
          { date: '2024-12-06', venues: 134, avgSuccessRate: 25.2 },
          { date: '2024-12-07', venues: 125, avgSuccessRate: 24.8 },
          { date: '2024-12-08', venues: 141, avgSuccessRate: 26.1 },
          { date: '2024-12-09', venues: 117, avgSuccessRate: 24.3 },
        ],
        topStrategies: [
          {
            strategy: 'Chain Discovery',
            venuesFound: 423,
            successRate: 31.2,
            avgQueriesPerVenue: 3.8,
            totalQueries: 1607,
          },
          {
            strategy: 'Menu Keyword Search',
            venuesFound: 312,
            successRate: 26.5,
            avgQueriesPerVenue: 4.1,
            totalQueries: 1279,
          },
          {
            strategy: 'Location-based',
            venuesFound: 289,
            successRate: 23.7,
            avgQueriesPerVenue: 4.5,
            totalQueries: 1301,
          },
          {
            strategy: 'Review Analysis',
            venuesFound: 156,
            successRate: 19.8,
            avgQueriesPerVenue: 5.2,
            totalQueries: 811,
          },
          {
            strategy: 'Partner Referrals',
            venuesFound: 67,
            successRate: 45.6,
            avgQueriesPerVenue: 2.1,
            totalQueries: 141,
          },
        ],
      };

      setData(mockData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <>
        <header className="page-header">
          <h2>Analytics Dashboard</h2>
        </header>
        <div className="page-content">
          <p>Loading...</p>
        </div>
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <header className="page-header">
          <h2>Analytics Dashboard</h2>
        </header>
        <div className="page-content">
          <div className="card" style={{ color: 'var(--danger)' }}>
            Error: {error || 'No data available'}
          </div>
        </div>
      </>
    );
  }

  const maxVenues = Math.max(...data.venuesPerDay.map(d => d.venues));
  const maxSuccessRate = Math.max(...data.successRateOverTime.map(d => d.successRate));

  return (
    <>
      <header className="page-header">
        <h2>Analytics Dashboard</h2>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', padding: '0.25rem' }}>
            <button
              className={dateRange === '7d' ? 'btn btn-primary' : 'btn btn-secondary'}
              onClick={() => setDateRange('7d')}
              style={{ padding: '0.5rem 1rem' }}
            >
              7 Days
            </button>
            <button
              className={dateRange === '30d' ? 'btn btn-primary' : 'btn btn-secondary'}
              onClick={() => setDateRange('30d')}
              style={{ padding: '0.5rem 1rem' }}
            >
              30 Days
            </button>
            <button
              className={dateRange === '90d' ? 'btn btn-primary' : 'btn btn-secondary'}
              onClick={() => setDateRange('90d')}
              style={{ padding: '0.5rem 1rem' }}
            >
              90 Days
            </button>
          </div>
          <button className="btn btn-primary" onClick={fetchAnalytics}>
            Refresh
          </button>
        </div>
      </header>

      <div className="page-content">
        {/* Overview Stats Cards */}
        <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
          <div className="card stat-card">
            <span className="stat-label">Total Venues</span>
            <span className="stat-value">{data.overview.totalVenues.toLocaleString()}</span>
            <div style={{
              fontSize: '0.875rem',
              color: data.overview.totalVenuesChange >= 0 ? 'var(--success)' : 'var(--danger)',
              marginTop: '0.25rem'
            }}>
              {data.overview.totalVenuesChange >= 0 ? '+' : ''}{data.overview.totalVenuesChange.toFixed(1)}% vs prev period
            </div>
          </div>
          <div className="card stat-card">
            <span className="stat-label">Success Rate</span>
            <span className="stat-value">{data.overview.overallSuccessRate.toFixed(1)}%</span>
            <div style={{
              fontSize: '0.875rem',
              color: data.overview.successRateChange >= 0 ? 'var(--success)' : 'var(--danger)',
              marginTop: '0.25rem'
            }}>
              {data.overview.successRateChange >= 0 ? '+' : ''}{data.overview.successRateChange.toFixed(1)}% vs prev period
            </div>
          </div>
          <div className="card stat-card">
            <span className="stat-label">Avg Cost per Venue</span>
            <span className="stat-value">${data.overview.avgCostPerVenue.toFixed(3)}</span>
            <div style={{
              fontSize: '0.875rem',
              color: data.overview.costChange <= 0 ? 'var(--success)' : 'var(--danger)',
              marginTop: '0.25rem'
            }}>
              {data.overview.costChange >= 0 ? '+' : ''}{data.overview.costChange.toFixed(1)}% vs prev period
            </div>
          </div>
          <div className="card stat-card">
            <span className="stat-label">Queries per Venue</span>
            <span className="stat-value">{data.efficiency.queriesPerVenue.toFixed(1)}</span>
            <div style={{
              fontSize: '0.875rem',
              color: data.efficiency.queriesPerVenue <= 5 ? 'var(--success)' : 'var(--warning)',
              marginTop: '0.25rem'
            }}>
              Target: &lt;5.0
            </div>
          </div>
        </div>

        {/* Success Rate Over Time Chart */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Discovery Success Rate Over Time</h3>
          <div style={{ height: '250px', display: 'flex', alignItems: 'flex-end', gap: '4px', padding: '1rem 0' }}>
            {data.successRateOverTime.map((point, index) => {
              const heightPercent = (point.successRate / maxSuccessRate) * 100;
              const date = new Date(point.date);
              const formattedDate = `${date.getMonth() + 1}/${date.getDate()}`;

              return (
                <div
                  key={index}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    height: '100%',
                    justifyContent: 'flex-end',
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      height: `${heightPercent}%`,
                      backgroundColor: point.successRate >= 25 ? 'var(--success)' : point.successRate >= 22 ? 'var(--primary)' : 'var(--warning)',
                      borderRadius: '4px 4px 0 0',
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'center',
                      padding: '0.25rem',
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                      color: 'white',
                      position: 'relative',
                      minHeight: '30px',
                    }}
                    title={`${point.successRate.toFixed(1)}% (${point.successful}/${point.totalAttempts})`}
                  >
                    {point.successRate.toFixed(1)}%
                  </div>
                  <div style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: 'var(--text-light)' }}>
                    {formattedDate}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ textAlign: 'center', marginTop: '1rem', color: 'var(--text-light)', fontSize: '0.875rem' }}>
            Success rate measures the percentage of discovery attempts that resulted in verified venues
          </div>
        </div>

        {/* Venues Per Day Chart */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Venues Discovered Per Day</h3>
          <div style={{ height: '200px', display: 'flex', alignItems: 'flex-end', gap: '4px', padding: '1rem 0' }}>
            {data.venuesPerDay.map((point, index) => {
              const heightPercent = (point.venues / maxVenues) * 100;
              const date = new Date(point.date);
              const formattedDate = `${date.getMonth() + 1}/${date.getDate()}`;

              return (
                <div
                  key={index}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    height: '100%',
                    justifyContent: 'flex-end',
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      height: `${heightPercent}%`,
                      backgroundColor: 'var(--primary)',
                      borderRadius: '4px 4px 0 0',
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'center',
                      padding: '0.25rem',
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                      color: 'white',
                      minHeight: '25px',
                    }}
                    title={`${point.venues} venues (${point.avgSuccessRate.toFixed(1)}% success rate)`}
                  >
                    {point.venues}
                  </div>
                  <div style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: 'var(--text-light)' }}>
                    {formattedDate}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Platform Coverage by Country */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Platform Coverage by Country</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ textAlign: 'left', padding: '0.75rem' }}>Country</th>
                <th style={{ textAlign: 'right', padding: '0.75rem' }}>Total Venues</th>
                <th style={{ textAlign: 'right', padding: '0.75rem' }}>Google</th>
                <th style={{ textAlign: 'right', padding: '0.75rem' }}>TripAdvisor</th>
                <th style={{ textAlign: 'right', padding: '0.75rem' }}>Yelp</th>
                <th style={{ textAlign: 'right', padding: '0.75rem' }}>TheFork</th>
                <th style={{ textAlign: 'right', padding: '0.75rem' }}>Coverage</th>
              </tr>
            </thead>
            <tbody>
              {data.platformCoverage.map((country) => {
                const totalPlatformPresence =
                  country.platforms.google +
                  country.platforms.tripadvisor +
                  country.platforms.yelp +
                  country.platforms.thefork;
                const maxPossible = country.total * 4;
                const coveragePercent = (totalPlatformPresence / maxPossible) * 100;

                return (
                  <tr key={country.country} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.75rem', fontWeight: 'bold' }}>{country.country}</td>
                    <td style={{ textAlign: 'right', padding: '0.75rem' }}>{country.total}</td>
                    <td style={{ textAlign: 'right', padding: '0.75rem' }}>
                      {country.platforms.google}
                      <span style={{ color: 'var(--text-light)', fontSize: '0.875rem' }}>
                        {' '}({((country.platforms.google / country.total) * 100).toFixed(0)}%)
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', padding: '0.75rem' }}>
                      {country.platforms.tripadvisor}
                      <span style={{ color: 'var(--text-light)', fontSize: '0.875rem' }}>
                        {' '}({((country.platforms.tripadvisor / country.total) * 100).toFixed(0)}%)
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', padding: '0.75rem' }}>
                      {country.platforms.yelp}
                      <span style={{ color: 'var(--text-light)', fontSize: '0.875rem' }}>
                        {' '}({((country.platforms.yelp / country.total) * 100).toFixed(0)}%)
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', padding: '0.75rem' }}>
                      {country.platforms.thefork}
                      <span style={{ color: 'var(--text-light)', fontSize: '0.875rem' }}>
                        {' '}({((country.platforms.thefork / country.total) * 100).toFixed(0)}%)
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', padding: '0.75rem' }}>
                      <span style={{
                        fontWeight: 'bold',
                        color: coveragePercent >= 80 ? 'var(--success)' : coveragePercent >= 60 ? 'var(--primary)' : 'var(--warning)'
                      }}>
                        {coveragePercent.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', fontSize: '0.875rem' }}>
            Coverage shows the percentage of venues with listings across all 4 platforms (max 100% = all venues on all platforms)
          </div>
        </div>

        {/* Query Efficiency Metrics */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Query Efficiency Metrics</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                {data.efficiency.queriesPerVenue.toFixed(1)}
              </div>
              <div style={{ color: 'var(--text-light)', fontSize: '0.875rem', marginTop: '0.5rem' }}>Queries per Venue</div>
              <div style={{ fontSize: '0.75rem', marginTop: '0.25rem', color: data.efficiency.queriesPerVenue <= 5 ? 'var(--success)' : 'var(--warning)' }}>
                Target: &lt;5
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                {data.efficiency.discoveryRate.toFixed(1)}%
              </div>
              <div style={{ color: 'var(--text-light)', fontSize: '0.875rem', marginTop: '0.5rem' }}>Discovery Rate</div>
              <div style={{ fontSize: '0.75rem', marginTop: '0.25rem', color: data.efficiency.discoveryRate >= 20 ? 'var(--success)' : 'var(--warning)' }}>
                Target: &gt;20%
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                ${data.efficiency.costPerVenue.toFixed(3)}
              </div>
              <div style={{ color: 'var(--text-light)', fontSize: '0.875rem', marginTop: '0.5rem' }}>Cost per Venue</div>
              <div style={{ fontSize: '0.75rem', marginTop: '0.25rem', color: data.efficiency.costPerVenue <= 0.05 ? 'var(--success)' : 'var(--warning)' }}>
                Target: &lt;$0.05
              </div>
            </div>
          </div>
        </div>

        {/* Top Performing Strategies */}
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>Top Performing Strategies</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ textAlign: 'left', padding: '0.75rem' }}>Strategy</th>
                <th style={{ textAlign: 'right', padding: '0.75rem' }}>Venues Found</th>
                <th style={{ textAlign: 'right', padding: '0.75rem' }}>Success Rate</th>
                <th style={{ textAlign: 'right', padding: '0.75rem' }}>Queries per Venue</th>
                <th style={{ textAlign: 'right', padding: '0.75rem' }}>Total Queries</th>
                <th style={{ textAlign: 'right', padding: '0.75rem' }}>Efficiency Score</th>
              </tr>
            </thead>
            <tbody>
              {data.topStrategies.map((strategy, index) => {
                const efficiencyScore = (strategy.successRate / strategy.avgQueriesPerVenue) * 10;

                return (
                  <tr key={index} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.75rem', fontWeight: 'bold' }}>{strategy.strategy}</td>
                    <td style={{ textAlign: 'right', padding: '0.75rem' }}>{strategy.venuesFound}</td>
                    <td style={{ textAlign: 'right', padding: '0.75rem' }}>
                      <span style={{
                        color: strategy.successRate >= 30 ? 'var(--success)' : strategy.successRate >= 20 ? 'var(--primary)' : 'var(--warning)'
                      }}>
                        {strategy.successRate.toFixed(1)}%
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', padding: '0.75rem' }}>
                      <span style={{
                        color: strategy.avgQueriesPerVenue <= 4 ? 'var(--success)' : strategy.avgQueriesPerVenue <= 5 ? 'var(--primary)' : 'var(--warning)'
                      }}>
                        {strategy.avgQueriesPerVenue.toFixed(1)}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', padding: '0.75rem', color: 'var(--text-light)' }}>
                      {strategy.totalQueries.toLocaleString()}
                    </td>
                    <td style={{ textAlign: 'right', padding: '0.75rem' }}>
                      <div style={{
                        display: 'inline-block',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '12px',
                        backgroundColor: efficiencyScore >= 70 ? 'var(--success-bg)' : efficiencyScore >= 50 ? 'var(--primary-bg)' : 'var(--warning-bg)',
                        color: efficiencyScore >= 70 ? 'var(--success)' : efficiencyScore >= 50 ? 'var(--primary)' : 'var(--warning)',
                        fontWeight: 'bold',
                        fontSize: '0.875rem',
                      }}>
                        {efficiencyScore.toFixed(0)}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', fontSize: '0.875rem' }}>
            Efficiency Score = (Success Rate / Queries per Venue) × 10. Higher is better. Target: &gt;50
          </div>
        </div>
      </div>
    </>
  );
}

export default AnalyticsDashboardPage;
