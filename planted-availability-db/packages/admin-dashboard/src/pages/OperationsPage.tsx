import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { scrapersApi, venuesApi, dishesApi } from '../lib/api';

type TabId = 'scrapers' | 'sync' | 'health';

interface SyncChange {
  id: string;
  type: 'add' | 'update' | 'remove';
  entityType: 'venue' | 'dish';
  name: string;
  location?: string;
  chain?: string;
  details: string;
  rejected: boolean;
}

interface PlatformHealth {
  platform: string;
  successRate: number;
  avgResponseTime: number;
  status: 'healthy' | 'degraded' | 'down';
  requests24h: number;
  consecutiveFailures: number;
  lastCheck: string;
}

interface CircuitBreaker {
  platform: string;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failures: number;
  lastFailure?: string;
  nextRetry?: string;
}

// Mock data until API is ready
const mockPlatformHealth: PlatformHealth[] = [
  { platform: 'Wolt', successRate: 98.2, avgResponseTime: 1200, status: 'healthy', requests24h: 450, consecutiveFailures: 0, lastCheck: '2 min ago' },
  { platform: 'Uber Eats', successRate: 94.5, avgResponseTime: 2100, status: 'healthy', requests24h: 380, consecutiveFailures: 0, lastCheck: '5 min ago' },
  { platform: 'Lieferando', successRate: 72.1, avgResponseTime: 3400, status: 'degraded', requests24h: 220, consecutiveFailures: 3, lastCheck: '3 min ago' },
  { platform: 'Just Eat', successRate: 0, avgResponseTime: 0, status: 'down', requests24h: 45, consecutiveFailures: 12, lastCheck: '1 hr ago' },
  { platform: 'Deliveroo', successRate: 88.9, avgResponseTime: 1800, status: 'healthy', requests24h: 310, consecutiveFailures: 0, lastCheck: '8 min ago' },
  { platform: 'Smood', successRate: 95.2, avgResponseTime: 1500, status: 'healthy', requests24h: 120, consecutiveFailures: 0, lastCheck: '4 min ago' },
];

const mockCircuitBreakers: CircuitBreaker[] = [
  { platform: 'Lieferando', state: 'HALF_OPEN', failures: 3, lastFailure: '5 min ago', nextRetry: 'in 2 min' },
  { platform: 'Just Eat', state: 'OPEN', failures: 12, lastFailure: '15 min ago', nextRetry: 'in 45 min' },
];

const mockAvailableScrapers = [
  { id: 'de-wolt', name: 'Germany - Wolt', country: 'DE', platform: 'wolt', lastRun: '2 hours ago' },
  { id: 'de-uber', name: 'Germany - Uber Eats', country: 'DE', platform: 'uber_eats', lastRun: '4 hours ago' },
  { id: 'de-lieferando', name: 'Germany - Lieferando', country: 'DE', platform: 'lieferando', lastRun: '1 day ago' },
  { id: 'ch-wolt', name: 'Switzerland - Wolt', country: 'CH', platform: 'wolt', lastRun: '1 hour ago' },
  { id: 'ch-smood', name: 'Switzerland - Smood', country: 'CH', platform: 'smood', lastRun: '6 hours ago' },
  { id: 'at-wolt', name: 'Austria - Wolt', country: 'AT', platform: 'wolt', lastRun: '3 hours ago' },
];

// Mock pending changes for sync preview
const initialPendingChanges: SyncChange[] = [
  { id: '1', type: 'add', entityType: 'venue', name: 'Hiltl Sihlpost', location: 'Zürich, CH', chain: 'Hiltl', details: 'New location discovered on Uber Eats', rejected: false },
  { id: '2', type: 'add', entityType: 'venue', name: 'dean&david Europaallee', location: 'Zürich, CH', chain: 'dean&david', details: 'New location discovered on Wolt', rejected: false },
  { id: '3', type: 'add', entityType: 'venue', name: 'Tibits Winterthur', location: 'Winterthur, CH', chain: 'Tibits', details: 'New location discovered on Just Eat', rejected: false },
  { id: '4', type: 'add', entityType: 'venue', name: 'KAIMUG Berlin Mitte', location: 'Berlin, DE', chain: 'KAIMUG', details: 'New location discovered on Lieferando', rejected: false },
  { id: '5', type: 'add', entityType: 'venue', name: 'Hans im Glück Köln', location: 'Köln, DE', chain: 'Hans im Glück', details: 'New location discovered on Wolt', rejected: false },
  { id: '6', type: 'add', entityType: 'dish', name: 'Planted Chicken Bowl', location: 'Hiltl Zürich', details: 'New dish with planted.chicken, CHF 24.90', rejected: false },
  { id: '7', type: 'add', entityType: 'dish', name: 'Vegan Schnitzel', location: 'Hans im Glück Berlin', details: 'New dish with planted.schnitzel, EUR 16.90', rejected: false },
  { id: '8', type: 'update', entityType: 'venue', name: 'Hiltl Langstrasse', location: 'Zürich, CH', chain: 'Hiltl', details: 'Updated opening hours and phone number', rejected: false },
  { id: '9', type: 'update', entityType: 'venue', name: 'dean&david München', location: 'München, DE', chain: 'dean&david', details: 'Updated delivery platforms (added Wolt)', rejected: false },
  { id: '10', type: 'update', entityType: 'dish', name: 'Planted Burger Classic', location: 'dean&david Zürich', details: 'Price updated: CHF 18.90 → CHF 19.50', rejected: false },
  { id: '11', type: 'update', entityType: 'dish', name: 'Green Buddha Bowl', location: 'Tibits Basel', details: 'Description updated, new photo detected', rejected: false },
  { id: '12', type: 'remove', entityType: 'venue', name: 'Veganz Berlin (Closed)', location: 'Berlin, DE', chain: 'Veganz', details: 'Venue permanently closed, confirmed via Google Maps', rejected: false },
  { id: '13', type: 'remove', entityType: 'dish', name: 'Seasonal Salad Winter', location: 'Hiltl Zürich', details: 'Dish no longer on menu after 3 consecutive checks', rejected: false },
];

function getStatusColor(status: PlatformHealth['status']): string {
  switch (status) {
    case 'healthy': return 'var(--success)';
    case 'degraded': return 'var(--warning)';
    case 'down': return 'var(--error)';
    default: return 'var(--text-light)';
  }
}

function getCircuitBreakerColor(state: CircuitBreaker['state']): string {
  switch (state) {
    case 'CLOSED': return 'var(--success)';
    case 'HALF_OPEN': return 'var(--warning)';
    case 'OPEN': return 'var(--error)';
    default: return 'var(--text-light)';
  }
}

function OperationsPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showFullDiff, setShowFullDiff] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<SyncChange[]>(initialPendingChanges);
  const [diffFilter, setDiffFilter] = useState<'all' | 'add' | 'update' | 'remove'>('all');

  const activeTab = (searchParams.get('tab') as TabId) || 'scrapers';
  const setActiveTab = (tab: TabId) => {
    setSearchParams({ tab });
  };

  // Toggle rejection status of a change
  const toggleReject = (id: string) => {
    setPendingChanges((prev) =>
      prev.map((change) =>
        change.id === id ? { ...change, rejected: !change.rejected } : change
      )
    );
  };

  // Get filtered changes
  const filteredChanges = pendingChanges.filter((c) => diffFilter === 'all' || c.type === diffFilter);
  const approvedChanges = pendingChanges.filter((c) => !c.rejected);
  const rejectedCount = pendingChanges.filter((c) => c.rejected).length;

  // Counts by type
  const addCount = pendingChanges.filter((c) => c.type === 'add' && !c.rejected).length;
  const updateCount = pendingChanges.filter((c) => c.type === 'update' && !c.rejected).length;
  const removeCount = pendingChanges.filter((c) => c.type === 'remove' && !c.rejected).length;

  // Auto-refresh intervals
  const SCRAPER_REFRESH = 15000; // 15 seconds for active monitoring
  const DATA_REFRESH = 5 * 60 * 1000; // 5 minutes for general data

  // Fetch scraper status with fast refresh (only when tab is active)
  const { data: scraperData, isLoading: scrapersLoading, refetch: refetchScrapers, dataUpdatedAt } = useQuery({
    queryKey: ['scraper-status-ops'],
    queryFn: () => scrapersApi.getStatus({ limit: 50 }),
    refetchInterval: SCRAPER_REFRESH,
    refetchIntervalInBackground: false,
  });

  // Fetch venue/dish counts for sync preview with slower refresh
  const { data: venuesData } = useQuery({
    queryKey: ['venues-count'],
    queryFn: () => venuesApi.getAll({ limit: 1 }),
    refetchInterval: DATA_REFRESH,
    refetchIntervalInBackground: false,
  });

  const { data: dishesData } = useQuery({
    queryKey: ['dishes-count'],
    queryFn: () => dishesApi.getAll({ limit: 1 }),
    refetchInterval: DATA_REFRESH,
    refetchIntervalInBackground: false,
  });

  // Trigger scraper mutation (mock)
  const triggerScraperMutation = useMutation({
    mutationFn: async (scraperId: string) => {
      // In real implementation, call scrapersApi.trigger(scraperId)
      console.log('Triggering scraper:', scraperId);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return { success: true, runId: `run-${Date.now()}` };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scraper-status-ops'] });
    },
  });

  // Sync to website mutation (mock)
  const syncMutation = useMutation({
    mutationFn: async () => {
      // In real implementation, call syncApi.execute() with approved changes
      console.log('Syncing to website...', approvedChanges.length, 'changes');
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return { synced: approvedChanges.length, errors: [] };
    },
    onSuccess: () => {
      // Clear synced changes after successful sync
      setPendingChanges([]);
      setShowFullDiff(false);
    },
  });

  const currentlyRunning = scraperData?.currently_running || [];
  const recentRuns = scraperData?.runs || [];
  const summary = scraperData?.summary;

  const formatDuration = (startedAt: string, completedAt?: string): string => {
    const start = new Date(startedAt).getTime();
    const end = completedAt ? new Date(completedAt).getTime() : Date.now();
    const durationMs = end - start;
    if (durationMs < 60000) return `${Math.round(durationMs / 1000)}s`;
    if (durationMs < 3600000) return `${Math.round(durationMs / 60000)}m`;
    return `${Math.round(durationMs / 3600000)}h`;
  };

  return (
    <>
      <header className="page-header">
        <h2>Operations</h2>
        <p style={{ color: 'var(--text-light)', margin: '0.25rem 0 0' }}>
          Manage scrapers, sync data to website, and monitor platform health
          {dataUpdatedAt && (
            <span style={{ marginLeft: '1rem', fontSize: '0.8rem' }}>
              • Last updated: {new Date(dataUpdatedAt).toLocaleTimeString()}
            </span>
          )}
        </p>
      </header>

      <div className="page-content">
        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          marginBottom: '1.5rem',
          borderBottom: '1px solid var(--border)',
          paddingBottom: '0.5rem',
        }}>
          {[
            { id: 'scrapers' as TabId, label: 'Scrapers' },
            { id: 'sync' as TabId, label: 'Website Sync' },
            { id: 'health' as TabId, label: 'Platform Health' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '0.75rem 1.5rem',
                background: activeTab === tab.id ? 'var(--primary)' : 'transparent',
                color: activeTab === tab.id ? 'white' : 'var(--text)',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 500,
                transition: 'all 0.2s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Scrapers Tab */}
        {activeTab === 'scrapers' && (
          <div>
            {/* Stats */}
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '1.5rem' }}>
              <div className="card stat-card" style={{ padding: '1rem' }}>
                <span className="stat-label">Running Now</span>
                <span className="stat-value" style={{ fontSize: '1.5rem', color: currentlyRunning.length > 0 ? 'var(--primary)' : 'inherit' }}>
                  {scrapersLoading ? '-' : currentlyRunning.length}
                </span>
              </div>
              <div className="card stat-card" style={{ padding: '1rem' }}>
                <span className="stat-label">Completed (24h)</span>
                <span className="stat-value" style={{ fontSize: '1.5rem', color: 'var(--success)' }}>
                  {scrapersLoading ? '-' : summary?.successful_24h || 0}
                </span>
              </div>
              <div className="card stat-card" style={{ padding: '1rem' }}>
                <span className="stat-label">Failed (24h)</span>
                <span className="stat-value" style={{ fontSize: '1.5rem', color: (summary?.failed_24h || 0) > 0 ? 'var(--error)' : 'inherit' }}>
                  {scrapersLoading ? '-' : summary?.failed_24h || 0}
                </span>
              </div>
              <div className="card stat-card" style={{ padding: '1rem' }}>
                <span className="stat-label">Success Rate</span>
                <span className="stat-value" style={{ fontSize: '1.5rem' }}>
                  {scrapersLoading ? '-' : summary?.success_rate_24h ? `${summary.success_rate_24h}%` : '--'}
                </span>
              </div>
            </div>

            {/* Currently Running */}
            {currentlyRunning.length > 0 && (
              <div className="card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid var(--primary)' }}>
                <h3 style={{ marginBottom: '1rem' }}>Currently Running</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {currentlyRunning.map((run) => (
                    <div
                      key={run.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.75rem 1rem',
                        background: 'var(--secondary)',
                        borderRadius: '4px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div className="loading-spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
                        <div>
                          <strong>{run.scraper_id}</strong>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>
                            Running for {formatDuration(run.started_at)}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 600 }}>{run.stats.venues_checked} venues</div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>{run.stats.dishes_found} dishes</div>
                        </div>
                        <button className="btn btn-sm btn-secondary" style={{ color: 'var(--error)' }}>
                          Stop
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Available Scrapers */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0 }}>Available Scrapers</h3>
                <button className="btn btn-secondary btn-sm" onClick={() => refetchScrapers()}>
                  Refresh
                </button>
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '1rem',
              }}>
                {mockAvailableScrapers.map((scraper) => (
                  <div
                    key={scraper.id}
                    style={{
                      padding: '1rem',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>{scraper.name}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>
                        Last run: {scraper.lastRun}
                      </div>
                    </div>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => triggerScraperMutation.mutate(scraper.id)}
                      disabled={triggerScraperMutation.isPending}
                    >
                      {triggerScraperMutation.isPending ? 'Starting...' : 'Run Now'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Runs */}
            <div className="card">
              <h3 style={{ marginBottom: '1rem' }}>Recent Runs</h3>
              {recentRuns.length === 0 ? (
                <p style={{ color: 'var(--text-light)', textAlign: 'center', padding: '2rem' }}>
                  No recent scraper runs
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
                    {recentRuns.map((run) => (
                      <tr key={run.id}>
                        <td><strong>{run.scraper_id}</strong></td>
                        <td style={{ fontSize: '0.85rem' }}>
                          {new Date(run.started_at).toLocaleString()}
                        </td>
                        <td>{formatDuration(run.started_at, run.completed_at)}</td>
                        <td>{run.stats.venues_updated}/{run.stats.venues_checked}</td>
                        <td>{run.stats.dishes_updated}/{run.stats.dishes_found}</td>
                        <td style={{ color: run.stats.errors > 0 ? 'var(--error)' : 'inherit' }}>
                          {run.stats.errors}
                        </td>
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
          </div>
        )}

        {/* Website Sync Tab */}
        {activeTab === 'sync' && (
          <div>
            {/* Sync Status */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ marginBottom: '1rem' }}>Sync Status</h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '1rem',
              }}>
                <div style={{ padding: '1rem', background: 'var(--secondary)', borderRadius: '4px' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: '0.25rem' }}>Last Sync</div>
                  <div style={{ fontWeight: 600 }}>2 hours ago</div>
                </div>
                <div style={{ padding: '1rem', background: 'var(--secondary)', borderRadius: '4px' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: '0.25rem' }}>Total Venues</div>
                  <div style={{ fontWeight: 600 }}>{venuesData?.total || '-'}</div>
                </div>
                <div style={{ padding: '1rem', background: 'var(--secondary)', borderRadius: '4px' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: '0.25rem' }}>Total Dishes</div>
                  <div style={{ fontWeight: 600 }}>{dishesData?.total || '-'}</div>
                </div>
                <div style={{ padding: '1rem', background: 'var(--secondary)', borderRadius: '4px' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: '0.25rem' }}>Pending Changes</div>
                  <div style={{ fontWeight: 600 }}>{pendingChanges.length}</div>
                </div>
              </div>
            </div>

            {/* Pending Changes Summary */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0 }}>Pending Changes</h3>
                {rejectedCount > 0 && (
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>
                    {rejectedCount} rejected (will be skipped)
                  </span>
                )}
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '1rem',
                marginBottom: '1.5rem',
              }}>
                <div
                  onClick={() => { setDiffFilter('add'); setShowFullDiff(true); }}
                  style={{
                    padding: '1.5rem',
                    background: '#d4edda',
                    borderRadius: '6px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'transform 0.15s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <div style={{ fontSize: '2rem', fontWeight: 600, color: '#155724' }}>+{addCount}</div>
                  <div style={{ fontSize: '0.85rem', color: '#155724' }}>To add</div>
                </div>
                <div
                  onClick={() => { setDiffFilter('update'); setShowFullDiff(true); }}
                  style={{
                    padding: '1.5rem',
                    background: '#fff3cd',
                    borderRadius: '6px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'transform 0.15s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <div style={{ fontSize: '2rem', fontWeight: 600, color: '#856404' }}>~{updateCount}</div>
                  <div style={{ fontSize: '0.85rem', color: '#856404' }}>To update</div>
                </div>
                <div
                  onClick={() => { setDiffFilter('remove'); setShowFullDiff(true); }}
                  style={{
                    padding: '1.5rem',
                    background: '#f8d7da',
                    borderRadius: '6px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'transform 0.15s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <div style={{ fontSize: '2rem', fontWeight: 600, color: '#721c24' }}>-{removeCount}</div>
                  <div style={{ fontSize: '0.85rem', color: '#721c24' }}>To remove</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => { setDiffFilter('all'); setShowFullDiff(!showFullDiff); }}
                >
                  {showFullDiff ? 'Hide Full Diff' : 'Preview Full Diff'}
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => syncMutation.mutate()}
                  disabled={syncMutation.isPending || approvedChanges.length === 0}
                >
                  {syncMutation.isPending ? 'Syncing...' : `Sync Now (${approvedChanges.length} changes)`}
                </button>
              </div>

              {syncMutation.isSuccess && (
                <div className="alert alert-success" style={{ marginTop: '1rem' }}>
                  Successfully synced {syncMutation.data.synced} items to website!
                </div>
              )}
            </div>

            {/* Full Diff View */}
            {showFullDiff && (
              <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ margin: 0 }}>
                    Change Details
                    {diffFilter !== 'all' && (
                      <span style={{ fontWeight: 400, fontSize: '0.9rem', marginLeft: '0.5rem', color: 'var(--text-light)' }}>
                        (filtered: {diffFilter})
                      </span>
                    )}
                  </h3>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {(['all', 'add', 'update', 'remove'] as const).map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setDiffFilter(filter)}
                        style={{
                          padding: '0.35rem 0.75rem',
                          background: diffFilter === filter ? 'var(--primary)' : 'var(--secondary)',
                          color: diffFilter === filter ? 'white' : 'var(--text)',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                        }}
                      >
                        {filter === 'all' ? 'All' : filter === 'add' ? 'Add' : filter === 'update' ? 'Update' : 'Remove'}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ maxHeight: '500px', overflow: 'auto' }}>
                  {filteredChanges.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-light)' }}>
                      No changes in this category
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {filteredChanges.map((change) => (
                        <div
                          key={change.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1rem',
                            padding: '0.75rem 1rem',
                            background: change.rejected ? '#f5f5f5' : 'var(--secondary)',
                            borderRadius: '6px',
                            borderLeft: `4px solid ${
                              change.rejected ? 'var(--text-light)' :
                              change.type === 'add' ? 'var(--success)' :
                              change.type === 'update' ? 'var(--warning)' :
                              'var(--error)'
                            }`,
                            opacity: change.rejected ? 0.6 : 1,
                          }}
                        >
                          {/* Type indicator */}
                          <div style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.9rem',
                            fontWeight: 600,
                            flexShrink: 0,
                            background: change.type === 'add' ? '#d4edda' : change.type === 'update' ? '#fff3cd' : '#f8d7da',
                            color: change.type === 'add' ? '#155724' : change.type === 'update' ? '#856404' : '#721c24',
                          }}>
                            {change.type === 'add' ? '+' : change.type === 'update' ? '~' : '-'}
                          </div>

                          {/* Content */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                              <strong style={{ textDecoration: change.rejected ? 'line-through' : 'none' }}>
                                {change.name}
                              </strong>
                              <span style={{
                                fontSize: '0.7rem',
                                padding: '0.1rem 0.4rem',
                                background: change.entityType === 'venue' ? '#e3f2fd' : '#f3e5f5',
                                color: change.entityType === 'venue' ? '#1565c0' : '#7b1fa2',
                                borderRadius: '3px',
                              }}>
                                {change.entityType}
                              </span>
                              {change.chain && (
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>
                                  ({change.chain})
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>
                              {change.location && <span>{change.location} • </span>}
                              {change.details}
                            </div>
                          </div>

                          {/* Actions */}
                          <button
                            onClick={() => toggleReject(change.id)}
                            style={{
                              padding: '0.4rem 0.75rem',
                              background: change.rejected ? 'var(--success)' : 'transparent',
                              color: change.rejected ? 'white' : 'var(--error)',
                              border: change.rejected ? 'none' : '1px solid var(--error)',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '0.8rem',
                              fontWeight: 500,
                              flexShrink: 0,
                            }}
                          >
                            {change.rejected ? 'Restore' : 'Reject'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {rejectedCount > 0 && (
                  <div style={{
                    marginTop: '1rem',
                    padding: '0.75rem 1rem',
                    background: '#fff3cd',
                    borderRadius: '4px',
                    fontSize: '0.85rem',
                    color: '#856404',
                  }}>
                    {rejectedCount} change{rejectedCount !== 1 ? 's' : ''} rejected and will be skipped during sync.
                  </div>
                )}
              </div>
            )}

            {/* Sync History */}
            <div className="card">
              <h3 style={{ marginBottom: '1rem' }}>Sync History</h3>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Added</th>
                    <th>Updated</th>
                    <th>Removed</th>
                    <th>Skipped</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Today, 2:30 PM</td>
                    <td style={{ color: 'var(--success)' }}>+5</td>
                    <td style={{ color: 'var(--warning)' }}>~12</td>
                    <td style={{ color: 'var(--error)' }}>-0</td>
                    <td style={{ color: 'var(--text-light)' }}>2</td>
                    <td><span className="badge badge-active">Success</span></td>
                  </tr>
                  <tr>
                    <td>Today, 10:15 AM</td>
                    <td style={{ color: 'var(--success)' }}>+8</td>
                    <td style={{ color: 'var(--warning)' }}>~3</td>
                    <td style={{ color: 'var(--error)' }}>-1</td>
                    <td style={{ color: 'var(--text-light)' }}>0</td>
                    <td><span className="badge badge-active">Success</span></td>
                  </tr>
                  <tr>
                    <td>Yesterday, 4:00 PM</td>
                    <td style={{ color: 'var(--success)' }}>+15</td>
                    <td style={{ color: 'var(--warning)' }}>~7</td>
                    <td style={{ color: 'var(--error)' }}>-2</td>
                    <td style={{ color: 'var(--text-light)' }}>1</td>
                    <td><span className="badge badge-active">Success</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Platform Health Tab */}
        {activeTab === 'health' && (
          <div>
            {/* Platform Health Table */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ marginBottom: '1rem' }}>Platform Status (Last 24h)</h3>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Platform</th>
                    <th>Success Rate</th>
                    <th>Avg Response</th>
                    <th>Requests</th>
                    <th>Failures</th>
                    <th>Last Check</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {mockPlatformHealth.map((platform) => (
                    <tr key={platform.platform}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: getStatusColor(platform.status),
                          }} />
                          <strong>{platform.platform}</strong>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{
                            width: '60px',
                            height: '6px',
                            background: 'var(--secondary)',
                            borderRadius: '3px',
                            overflow: 'hidden',
                          }}>
                            <div style={{
                              width: `${platform.successRate}%`,
                              height: '100%',
                              background: getStatusColor(platform.status),
                            }} />
                          </div>
                          <span>{platform.successRate > 0 ? `${platform.successRate}%` : '-'}</span>
                        </div>
                      </td>
                      <td>{platform.avgResponseTime > 0 ? `${(platform.avgResponseTime / 1000).toFixed(1)}s` : '-'}</td>
                      <td>{platform.requests24h}</td>
                      <td style={{ color: platform.consecutiveFailures > 0 ? 'var(--error)' : 'inherit' }}>
                        {platform.consecutiveFailures}
                      </td>
                      <td style={{ color: 'var(--text-light)', fontSize: '0.85rem' }}>{platform.lastCheck}</td>
                      <td>
                        <span className={`badge ${platform.status === 'healthy' ? 'badge-active' : platform.status === 'degraded' ? 'badge-stale' : 'badge-archived'}`}>
                          {platform.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Circuit Breakers */}
            <div className="card">
              <h3 style={{ marginBottom: '1rem' }}>Circuit Breakers</h3>
              {mockCircuitBreakers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--success)' }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>All circuits healthy</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>
                    No platforms are currently blocked
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {mockCircuitBreakers.map((breaker) => (
                    <div
                      key={breaker.platform}
                      style={{
                        padding: '1rem',
                        border: `2px solid ${getCircuitBreakerColor(breaker.state)}`,
                        borderRadius: '6px',
                        background: breaker.state === 'OPEN' ? '#fff5f5' : breaker.state === 'HALF_OPEN' ? '#fffbf0' : 'transparent',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{breaker.platform}</div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>
                            {breaker.failures} consecutive failures
                            {breaker.lastFailure && ` • Last failure: ${breaker.lastFailure}`}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{
                            padding: '0.35rem 0.75rem',
                            background: getCircuitBreakerColor(breaker.state),
                            color: 'white',
                            borderRadius: '4px',
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            marginBottom: '0.25rem',
                          }}>
                            {breaker.state}
                          </div>
                          {breaker.nextRetry && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
                              Next retry: {breaker.nextRetry}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--secondary)', borderRadius: '4px' }}>
                <h4 style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>How Circuit Breakers Work</h4>
                <ul style={{ fontSize: '0.85rem', color: 'var(--text-light)', margin: 0, paddingLeft: '1.25rem' }}>
                  <li><strong>CLOSED</strong>: Normal operation, all requests allowed</li>
                  <li><strong>OPEN</strong>: Platform blocked after too many failures (5+ consecutive)</li>
                  <li><strong>HALF_OPEN</strong>: Testing with limited requests after cooldown</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default OperationsPage;
