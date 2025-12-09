import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import VenueWithDishesCard from '../components/VenueWithDishesCard';
import VenueEditModal from '../components/VenueEditModal';
import {
  discoveryReviewApi,
  type DiscoveredVenueForReview,
  type DiscoveryReviewParams,
} from '../lib/api';

function DiscoveryReviewPage() {
  const queryClient = useQueryClient();

  // Filter state
  const [status, setStatus] = useState<string>('discovered');
  const [country, setCountry] = useState<string>('');
  const [platform, setPlatform] = useState<string>('');
  const [minConfidence, setMinConfidence] = useState<number>(0);

  // Selection state
  const [selectedVenues, setSelectedVenues] = useState<Set<string>>(new Set());

  // Edit modal state
  const [editingVenue, setEditingVenue] = useState<DiscoveredVenueForReview | null>(null);

  // Build query params
  const queryParams: DiscoveryReviewParams = {
    status,
    limit: 50,
  };
  if (country) queryParams.country = country;
  if (platform) queryParams.platform = platform;
  if (minConfidence > 0) queryParams.min_confidence = minConfidence;

  // Fetch venues
  const {
    data: venuesData,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['discovered-venues', queryParams],
    queryFn: () => discoveryReviewApi.getVenues(queryParams),
  });

  // Fetch stats
  const { data: statsData } = useQuery({
    queryKey: ['discovered-venues-stats'],
    queryFn: () => discoveryReviewApi.getStats(),
  });

  // Mutations
  const verifyMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates?: Partial<DiscoveredVenueForReview> }) =>
      discoveryReviewApi.verifyVenue(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discovered-venues'] });
      queryClient.invalidateQueries({ queryKey: ['discovered-venues-stats'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      discoveryReviewApi.rejectVenue(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discovered-venues'] });
      queryClient.invalidateQueries({ queryKey: ['discovered-venues-stats'] });
    },
  });

  const updateAndVerifyMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<DiscoveredVenueForReview> }) =>
      discoveryReviewApi.updateAndVerify(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discovered-venues'] });
      queryClient.invalidateQueries({ queryKey: ['discovered-venues-stats'] });
      setEditingVenue(null);
    },
  });

  const bulkVerifyMutation = useMutation({
    mutationFn: (ids: string[]) => discoveryReviewApi.bulkVerify(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discovered-venues'] });
      queryClient.invalidateQueries({ queryKey: ['discovered-venues-stats'] });
      setSelectedVenues(new Set());
    },
  });

  const bulkRejectMutation = useMutation({
    mutationFn: ({ ids, reason }: { ids: string[]; reason: string }) =>
      discoveryReviewApi.bulkReject(ids, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discovered-venues'] });
      queryClient.invalidateQueries({ queryKey: ['discovered-venues-stats'] });
      setSelectedVenues(new Set());
    },
  });

  // Handlers
  const handleSelect = (id: string, selected: boolean) => {
    const newSelected = new Set(selectedVenues);
    if (selected) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedVenues(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedVenues.size === venues.length) {
      setSelectedVenues(new Set());
    } else {
      setSelectedVenues(new Set(venues.map((v) => v.id)));
    }
  };

  const handleVerify = (venue: DiscoveredVenueForReview) => {
    verifyMutation.mutate({ id: venue.id });
  };

  const handleEdit = (venue: DiscoveredVenueForReview) => {
    setEditingVenue(venue);
  };

  const handleReject = (venue: DiscoveredVenueForReview) => {
    const reason = prompt('Enter rejection reason:');
    if (reason) {
      rejectMutation.mutate({ id: venue.id, reason });
    }
  };

  const handleSaveEdit = (updates: Partial<DiscoveredVenueForReview>) => {
    if (editingVenue) {
      updateAndVerifyMutation.mutate({ id: editingVenue.id, data: updates });
    }
  };

  const handleRejectFromModal = (reason: string) => {
    if (editingVenue) {
      rejectMutation.mutate({ id: editingVenue.id, reason });
      setEditingVenue(null);
    }
  };

  const handleBulkVerify = () => {
    if (selectedVenues.size > 0) {
      bulkVerifyMutation.mutate(Array.from(selectedVenues));
    }
  };

  const handleBulkReject = () => {
    if (selectedVenues.size > 0) {
      const reason = prompt('Enter rejection reason for selected venues:');
      if (reason) {
        bulkRejectMutation.mutate({ ids: Array.from(selectedVenues), reason });
      }
    }
  };

  const venues = venuesData?.venues || [];
  const total = venuesData?.total || 0;
  const stats = statsData;

  const isAnyLoading =
    verifyMutation.isPending ||
    rejectMutation.isPending ||
    updateAndVerifyMutation.isPending ||
    bulkVerifyMutation.isPending ||
    bulkRejectMutation.isPending;

  return (
    <>
      <header className="page-header">
        <h2>Discovery Review</h2>
        <p style={{ color: 'var(--text-light)', margin: '0.25rem 0 0' }}>
          Review and verify AI-discovered venues with their dishes
        </p>
      </header>

      <div className="page-content">
        {/* Stats Cards */}
        {stats && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '1rem',
              marginBottom: '1.5rem',
            }}
          >
            <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--warning)' }}>
                {stats.total_discovered}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>Pending Review</div>
            </div>
            <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--success)' }}>
                {stats.total_verified}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>Verified</div>
            </div>
            <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--danger)' }}>
                {stats.total_rejected}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>Rejected</div>
            </div>
            <div className="card" style={{ padding: '1rem' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: '0.5rem' }}>
                By Confidence
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem' }}>High (70+)</span>
                  <span style={{ fontWeight: 600, color: 'var(--success)' }}>
                    {stats.by_confidence?.high || 0}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem' }}>Medium (40-70)</span>
                  <span style={{ fontWeight: 600, color: 'var(--warning)' }}>
                    {stats.by_confidence?.medium || 0}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem' }}>Low (&lt;40)</span>
                  <span style={{ fontWeight: 600, color: 'var(--danger)' }}>
                    {stats.by_confidence?.low || 0}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div
          className="card"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '1rem',
            alignItems: 'flex-end',
            marginBottom: '1rem',
          }}
        >
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border)' }}
            >
              <option value="discovered">Discovered (Pending)</option>
              <option value="verified">Verified</option>
              <option value="rejected">Rejected</option>
              <option value="">All</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
              Country
            </label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border)' }}
            >
              <option value="">All Countries</option>
              <option value="CH">Switzerland</option>
              <option value="DE">Germany</option>
              <option value="AT">Austria</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
              Platform
            </label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border)' }}
            >
              <option value="">All Platforms</option>
              <option value="uber-eats">Uber Eats</option>
              <option value="lieferando">Lieferando</option>
              <option value="wolt">Wolt</option>
              <option value="just-eat">Just Eat</option>
              <option value="smood">Smood</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
              Min Confidence
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="range"
                min="0"
                max="100"
                value={minConfidence}
                onChange={(e) => setMinConfidence(Number(e.target.value))}
                style={{ width: '100px' }}
              />
              <span style={{ fontSize: '0.85rem', width: '40px' }}>{minConfidence}%</span>
            </div>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedVenues.size > 0 && (
          <div
            className="card"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              marginBottom: '1rem',
              background: 'var(--primary-light)',
            }}
          >
            <span style={{ fontWeight: 600 }}>{selectedVenues.size} selected</span>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleBulkVerify}
              disabled={isAnyLoading}
            >
              Verify Selected
            </button>
            <button
              className="btn btn-danger btn-sm"
              onClick={handleBulkReject}
              disabled={isAnyLoading}
            >
              Reject Selected
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setSelectedVenues(new Set())}
            >
              Clear Selection
            </button>
          </div>
        )}

        {/* Header with select all */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              checked={venues.length > 0 && selectedVenues.size === venues.length}
              onChange={handleSelectAll}
            />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>
              Select All ({total} venues)
            </span>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div className="loading-spinner" />
            <p>Loading discovered venues...</p>
          </div>
        )}

        {/* Error State */}
        {isError && (
          <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
            Failed to load venues: {(error as Error)?.message || 'Unknown error'}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !isError && venues.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            <h3 style={{ color: 'var(--text-light)' }}>No venues to review</h3>
            <p style={{ color: 'var(--text-light)' }}>
              All discovered venues have been reviewed, or no venues match your filters.
            </p>
          </div>
        )}

        {/* Venue Cards */}
        {venues.map((venue) => (
          <VenueWithDishesCard
            key={venue.id}
            venue={venue}
            selected={selectedVenues.has(venue.id)}
            onSelect={handleSelect}
            onVerify={handleVerify}
            onEdit={handleEdit}
            onReject={handleReject}
            isLoading={isAnyLoading}
          />
        ))}

        {/* Edit Modal */}
        {editingVenue && (
          <VenueEditModal
            venue={editingVenue}
            onSave={handleSaveEdit}
            onReject={handleRejectFromModal}
            onClose={() => setEditingVenue(null)}
            isLoading={updateAndVerifyMutation.isPending || rejectMutation.isPending}
          />
        )}
      </div>
    </>
  );
}

export default DiscoveryReviewPage;
