import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { moderationApi, webhookApi, type FlaggedItem } from '../lib/api';

type FlagType = 'stale' | 'conflict' | 'error' | 'all';
type TabType = 'flagged' | 'webhooks';

function formatDate(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function ModerationPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('flagged');
  const [flagType, setFlagType] = useState<FlagType>('all');
  const [error, setError] = useState<string | null>(null);

  // Fetch flagged items
  const { data: flaggedData, isLoading: flaggedLoading, isError: flaggedError } = useQuery({
    queryKey: ['flagged', flagType],
    queryFn: () => moderationApi.getFlagged({ type: flagType, limit: 100 }),
    enabled: activeTab === 'flagged',
  });

  // Fetch webhook staging items
  const { data: webhookData, isLoading: webhookLoading, isError: webhookError } = useQuery({
    queryKey: ['webhook-staging'],
    queryFn: () => webhookApi.getStaging({ status: 'pending', limit: 100 }),
    enabled: activeTab === 'webhooks',
  });

  // Approve flagged item mutation
  const approveFlaggedMutation = useMutation({
    mutationFn: ({ collection, id }: { collection: string; id: string }) =>
      moderationApi.approve(collection, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flagged'] });
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  // Archive flagged item mutation
  const archiveFlaggedMutation = useMutation({
    mutationFn: ({ collection, id }: { collection: string; id: string }) =>
      moderationApi.archive(collection, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flagged'] });
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  // Approve webhook item mutation
  const approveWebhookMutation = useMutation({
    mutationFn: (id: string) => webhookApi.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhook-staging'] });
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  // Reject webhook item mutation
  const rejectWebhookMutation = useMutation({
    mutationFn: (id: string) => webhookApi.reject(id, 'Rejected by admin'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhook-staging'] });
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const handleApproveFlagged = (item: FlaggedItem) => {
    const collection = item.type === 'venue' ? 'venues' : 'dishes';
    approveFlaggedMutation.mutate({ collection, id: item.id });
  };

  const handleArchiveFlagged = (item: FlaggedItem) => {
    if (confirm(`Are you sure you want to archive this ${item.type}?`)) {
      const collection = item.type === 'venue' ? 'venues' : 'dishes';
      archiveFlaggedMutation.mutate({ collection, id: item.id });
    }
  };

  const handleApproveWebhook = (id: string) => {
    approveWebhookMutation.mutate(id);
  };

  const handleRejectWebhook = (id: string) => {
    if (confirm('Are you sure you want to reject this webhook item?')) {
      rejectWebhookMutation.mutate(id);
    }
  };

  const flaggedItems = (flaggedData?.items || []) as FlaggedItem[];
  const webhookItems = (webhookData?.items || []) as Array<{ id: string; type: string; data: unknown; created_at: string }>;

  const isLoading = activeTab === 'flagged' ? flaggedLoading : webhookLoading;
  const hasError = activeTab === 'flagged' ? flaggedError : webhookError;

  return (
    <>
      <header className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Moderation</h2>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className={`btn ${activeTab === 'flagged' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('flagged')}
            >
              Flagged Items
            </button>
            <button
              className={`btn ${activeTab === 'webhooks' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('webhooks')}
            >
              Webhook Staging
            </button>
          </div>
        </div>
      </header>

      <div className="page-content">
        {error && (
          <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        {hasError && (
          <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
            Failed to load data. Please try again.
          </div>
        )}

        {activeTab === 'flagged' && (
          <>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ marginRight: '0.5rem' }}>Filter by type:</label>
              <select
                value={flagType}
                onChange={(e) => setFlagType(e.target.value as FlagType)}
                style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border)' }}
              >
                <option value="all">All</option>
                <option value="stale">Stale</option>
                <option value="conflict">Conflict</option>
                <option value="error">Error</option>
              </select>
            </div>

            <div className="card">
              {isLoading ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <div className="loading-spinner" />
                  <p>Loading flagged items...</p>
                </div>
              ) : flaggedItems.length === 0 ? (
                <p style={{ color: 'var(--text-light)', textAlign: 'center', padding: '2rem' }}>
                  No flagged items found. All data is verified!
                </p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Reason</th>
                      <th>Details</th>
                      <th>Last Verified</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flaggedItems.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <span className={`badge badge-${item.type}`}>
                            {item.type}
                          </span>
                        </td>
                        <td>
                          <span className={`badge badge-${item.reason}`}>
                            {item.reason}
                          </span>
                        </td>
                        <td>
                          <code style={{ fontSize: '0.75rem' }}>{item.id}</code>
                        </td>
                        <td>{formatDate(item.last_verified)}</td>
                        <td>
                          <span className={`badge badge-${item.status}`}>
                            {item.status}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={() => handleApproveFlagged(item)}
                              disabled={approveFlaggedMutation.isPending}
                            >
                              Verify
                            </button>
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => handleArchiveFlagged(item)}
                              disabled={archiveFlaggedMutation.isPending}
                            >
                              Archive
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {activeTab === 'webhooks' && (
          <div className="card">
            {isLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <div className="loading-spinner" />
                <p>Loading webhook staging items...</p>
              </div>
            ) : webhookItems.length === 0 ? (
              <p style={{ color: 'var(--text-light)', textAlign: 'center', padding: '2rem' }}>
                No pending webhook items. All submissions have been processed.
              </p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Type</th>
                    <th>Created</th>
                    <th>Data Preview</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {webhookItems.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <code style={{ fontSize: '0.75rem' }}>{item.id}</code>
                      </td>
                      <td>
                        <span className="badge">{item.type}</span>
                      </td>
                      <td>{formatDate(item.created_at)}</td>
                      <td>
                        <pre style={{
                          fontSize: '0.7rem',
                          maxWidth: '300px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          margin: 0,
                          padding: '0.25rem',
                          background: 'var(--bg-light)',
                          borderRadius: '4px',
                        }}>
                          {JSON.stringify(item.data, null, 2).slice(0, 150)}...
                        </pre>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => handleApproveWebhook(item.id)}
                            disabled={approveWebhookMutation.isPending}
                          >
                            Approve
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => handleRejectWebhook(item.id)}
                            disabled={rejectWebhookMutation.isPending}
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </>
  );
}

export default ModerationPage;
