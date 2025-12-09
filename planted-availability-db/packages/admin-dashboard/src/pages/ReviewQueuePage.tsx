import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  discoveryReviewApi,
  type DiscoveredVenueForReview,
  type DiscoveryReviewParams,
} from '../lib/api';

// Country and type labels
const COUNTRY_NAMES: Record<string, string> = {
  CH: 'Switzerland',
  DE: 'Germany',
  AT: 'Austria',
  NL: 'Netherlands',
  UK: 'United Kingdom',
  FR: 'France',
  IT: 'Italy',
};

const TYPE_LABELS: Record<string, string> = {
  restaurant: 'Foodservice',
  retail: 'Retail',
  delivery_kitchen: 'Delivery Kitchen',
};

// Hierarchical data types
interface LocationNode {
  venue: DiscoveredVenueForReview;
  expanded: boolean;
}

interface ChainNode {
  chainId: string;
  chainName: string;
  locations: LocationNode[];
  expanded: boolean;
  pendingCount: number;
}

interface VenueTypeNode {
  type: string;
  label: string;
  chains: ChainNode[];
  independents: LocationNode[];
  expanded: boolean;
  pendingCount: number;
}

interface CountryNode {
  code: string;
  name: string;
  venueTypes: VenueTypeNode[];
  expanded: boolean;
  pendingCount: number;
}

type ViewMode = 'hierarchical' | 'cards' | 'table';

function ReviewQueuePage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('hierarchical');
  const [expandedCountries, setExpandedCountries] = useState<Set<string>>(new Set(['DE', 'CH', 'AT']));
  const [expandedTypes] = useState<Set<string>>(new Set());
  const [expandedChains, setExpandedChains] = useState<Set<string>>(new Set());
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set());

  // Selection state
  const [selectedVenues, setSelectedVenues] = useState<Set<string>>(new Set());

  // Filter state from URL params
  const status = searchParams.get('status') || 'discovered';
  const countryFilter = searchParams.get('country') || '';
  const platformFilter = searchParams.get('platform') || '';
  const minConfidence = parseInt(searchParams.get('min_confidence') || '0', 10);

  // Build query params
  const queryParams: DiscoveryReviewParams = {
    status,
    limit: 200,
  };
  if (countryFilter) queryParams.country = countryFilter;
  if (platformFilter) queryParams.platform = platformFilter;
  if (minConfidence > 0) queryParams.min_confidence = minConfidence;

  // Auto-refresh interval (5 minutes)
  const REFRESH_INTERVAL = 5 * 60 * 1000;

  // Fetch venues with auto-refresh
  const { data: venuesData, isLoading, isError, error, dataUpdatedAt } = useQuery({
    queryKey: ['discovered-venues-review', queryParams],
    queryFn: () => discoveryReviewApi.getVenues(queryParams),
    refetchInterval: REFRESH_INTERVAL,
    refetchIntervalInBackground: false, // Only refresh when tab is active
  });

  // Fetch stats with auto-refresh
  const { data: statsData } = useQuery({
    queryKey: ['discovered-venues-stats'],
    queryFn: () => discoveryReviewApi.getStats(),
    refetchInterval: REFRESH_INTERVAL,
    refetchIntervalInBackground: false,
  });

  const venues = venuesData?.venues || [];
  const stats = statsData;

  // Compute venues without dishes
  const venuesWithoutDishes = useMemo(() =>
    venues.filter((v) => v.dishes.length === 0),
    [venues]
  );

  // Build hierarchical structure
  const hierarchy = useMemo((): CountryNode[] => {
    const byCountry = new Map<string, DiscoveredVenueForReview[]>();

    venues.forEach((venue) => {
      const country = venue.address.country;
      if (!byCountry.has(country)) {
        byCountry.set(country, []);
      }
      byCountry.get(country)!.push(venue);
    });

    return Array.from(byCountry.entries())
      .map(([code, countryVenues]) => {
        // Group by type
        const byType = new Map<string, DiscoveredVenueForReview[]>();
        countryVenues.forEach((v) => {
          const type = 'restaurant'; // Default type if not specified
          if (!byType.has(type)) {
            byType.set(type, []);
          }
          byType.get(type)!.push(v);
        });

        const venueTypes: VenueTypeNode[] = Array.from(byType.entries()).map(([type, typeVenues]) => {
          // Group by chain
          const chains = new Map<string, DiscoveredVenueForReview[]>();
          const independents: DiscoveredVenueForReview[] = [];

          typeVenues.forEach((v) => {
            if (v.chain_id) {
              if (!chains.has(v.chain_id)) {
                chains.set(v.chain_id, []);
              }
              chains.get(v.chain_id)!.push(v);
            } else {
              independents.push(v);
            }
          });

          return {
            type,
            label: TYPE_LABELS[type] || type,
            expanded: expandedTypes.has(`${code}-${type}`),
            pendingCount: typeVenues.filter((v) => v.status === 'discovered').length,
            chains: Array.from(chains.entries()).map(([chainId, chainVenues]) => ({
              chainId,
              chainName: chainVenues[0]?.chain_name || chainId,
              locations: chainVenues.map((v) => ({
                venue: v,
                expanded: expandedLocations.has(v.id),
              })),
              expanded: expandedChains.has(`${code}-${type}-${chainId}`),
              pendingCount: chainVenues.filter((v) => v.status === 'discovered').length,
            })),
            independents: independents.map((v) => ({
              venue: v,
              expanded: expandedLocations.has(v.id),
            })),
          };
        });

        return {
          code,
          name: COUNTRY_NAMES[code] || code,
          venueTypes,
          expanded: expandedCountries.has(code),
          pendingCount: countryVenues.filter((v) => v.status === 'discovered').length,
        };
      })
      .sort((a, b) => b.pendingCount - a.pendingCount);
  }, [venues, expandedCountries, expandedTypes, expandedChains, expandedLocations]);

  // Mutations
  const verifyMutation = useMutation({
    mutationFn: ({ id }: { id: string }) => discoveryReviewApi.verifyVenue(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discovered-venues-review'] });
      queryClient.invalidateQueries({ queryKey: ['discovered-venues-stats'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      discoveryReviewApi.rejectVenue(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discovered-venues-review'] });
      queryClient.invalidateQueries({ queryKey: ['discovered-venues-stats'] });
    },
  });

  const bulkVerifyMutation = useMutation({
    mutationFn: (ids: string[]) => discoveryReviewApi.bulkVerify(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discovered-venues-review'] });
      queryClient.invalidateQueries({ queryKey: ['discovered-venues-stats'] });
      setSelectedVenues(new Set());
    },
  });

  const bulkRejectMutation = useMutation({
    mutationFn: ({ ids, reason }: { ids: string[]; reason: string }) =>
      discoveryReviewApi.bulkReject(ids, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discovered-venues-review'] });
      queryClient.invalidateQueries({ queryKey: ['discovered-venues-stats'] });
      setSelectedVenues(new Set());
    },
  });

  // Handlers
  const toggleCountry = useCallback((code: string) => {
    setExpandedCountries((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }, []);

  const toggleChain = useCallback((key: string) => {
    setExpandedChains((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleLocation = useCallback((id: string) => {
    setExpandedLocations((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleVerify = useCallback((venue: DiscoveredVenueForReview) => {
    verifyMutation.mutate({ id: venue.id });
  }, [verifyMutation]);

  const handleReject = useCallback((venue: DiscoveredVenueForReview) => {
    const reason = prompt('Enter rejection reason:');
    if (reason) {
      rejectMutation.mutate({ id: venue.id, reason });
    }
  }, [rejectMutation]);

  const handleBulkVerify = useCallback(() => {
    if (selectedVenues.size > 0) {
      bulkVerifyMutation.mutate(Array.from(selectedVenues));
    }
  }, [selectedVenues, bulkVerifyMutation]);

  const handleBulkReject = useCallback(() => {
    if (selectedVenues.size > 0) {
      const reason = prompt('Enter rejection reason:');
      if (reason) {
        bulkRejectMutation.mutate({ ids: Array.from(selectedVenues), reason });
      }
    }
  }, [selectedVenues, bulkRejectMutation]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedVenues((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (selectedVenues.size === venues.length) {
      setSelectedVenues(new Set());
    } else {
      setSelectedVenues(new Set(venues.map((v) => v.id)));
    }
  }, [venues, selectedVenues.size]);

  const handleFetchMissingDishes = useCallback(() => {
    if (venuesWithoutDishes.length === 0) {
      alert('All venues in the current view already have dishes!');
      return;
    }

    // Group by country for easier batch processing
    const byCountry = new Map<string, typeof venuesWithoutDishes>();
    venuesWithoutDishes.forEach((v) => {
      const country = v.address.country;
      if (!byCountry.has(country)) {
        byCountry.set(country, []);
      }
      byCountry.get(country)!.push(v);
    });

    // Build command suggestions
    const commands: string[] = [];
    byCountry.forEach((countryVenues, country) => {
      commands.push(`# ${country}: ${countryVenues.length} venues`);
      commands.push(`pnpm run dish-finder --missing-dishes --country ${country}`);
      commands.push('');
    });

    // Also provide venue IDs for targeted discovery
    const venueIds = venuesWithoutDishes.map((v) => v.id).join(',');

    alert(
      `Found ${venuesWithoutDishes.length} venues without dishes.\n\n` +
      `Run batch dish discovery with:\n\n` +
      commands.join('\n') +
      `\nOr target specific venues:\n` +
      `pnpm run dish-finder --venue-ids "${venueIds.slice(0, 100)}${venueIds.length > 100 ? '...' : ''}"`
    );

    // Copy venue IDs to clipboard if available
    if (navigator.clipboard) {
      navigator.clipboard.writeText(venueIds).then(() => {
        console.log('Venue IDs copied to clipboard');
      }).catch(() => {
        // Clipboard access denied, no action needed
      });
    }
  }, [venuesWithoutDishes]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === '?') {
        alert(`Keyboard Shortcuts:
j - Move down
k - Move up
v - Verify selected
r - Reject selected
Space - Toggle selection
a - Select all`);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const isAnyLoading =
    verifyMutation.isPending ||
    rejectMutation.isPending ||
    bulkVerifyMutation.isPending ||
    bulkRejectMutation.isPending;

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    setSearchParams(params);
  };

  // Confidence bar component
  const ConfidenceBar = ({ score }: { score: number }) => {
    const color = score >= 70 ? 'var(--success)' : score >= 40 ? 'var(--warning)' : 'var(--error)';
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <div style={{ width: '60px', height: '6px', background: 'var(--secondary)', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: '3px' }} />
        </div>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>{score}%</span>
      </div>
    );
  };

  // Location card component - Always shows dishes inline for efficient review
  const LocationCard = ({ location }: { location: LocationNode }) => {
    const venue = location.venue;
    const isExpanded = expandedLocations.has(venue.id);
    const isSelected = selectedVenues.has(venue.id);

    return (
      <div style={{
        border: '1px solid var(--border)',
        borderRadius: '6px',
        overflow: 'hidden',
        background: isSelected ? '#f0f9f4' : 'white',
      }}>
        {/* Location Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0.75rem 1rem',
            gap: '0.75rem',
            cursor: 'pointer',
            background: 'var(--secondary)',
          }}
          onClick={() => toggleLocation(venue.id)}
        >
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation();
              toggleSelect(venue.id);
            }}
            onClick={(e) => e.stopPropagation()}
          />
          <span style={{ fontSize: '1rem', color: 'var(--text-light)' }}>
            {isExpanded ? '−' : '+'}
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600 }}>{venue.name}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>
              {venue.address.street ? `${venue.address.street}, ` : ''}{venue.address.city}
              {venue.chain_name && <span style={{ marginLeft: '0.5rem', color: 'var(--primary)' }}>({venue.chain_name})</span>}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <ConfidenceBar score={venue.confidence_score} />
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              <button
                className="btn btn-sm btn-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  handleVerify(venue);
                }}
                disabled={isAnyLoading}
              >
                Verify All
              </button>
              <button
                className="btn btn-sm btn-danger"
                onClick={(e) => {
                  e.stopPropagation();
                  handleReject(venue);
                }}
                disabled={isAnyLoading}
              >
                Reject
              </button>
            </div>
          </div>
        </div>

        {/* Always show dishes inline */}
        <div style={{ padding: '0.75rem 1rem', background: 'white' }}>
          {/* Dishes - Always visible */}
          {venue.dishes.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {venue.dishes.map((dish, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.5rem 0.75rem',
                    background: 'var(--secondary)',
                    borderRadius: '4px',
                    fontSize: '0.85rem',
                  }}
                >
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{
                      padding: '0.15rem 0.4rem',
                      background: 'var(--primary)',
                      color: 'white',
                      borderRadius: '3px',
                      fontSize: '0.7rem',
                      fontWeight: 500,
                    }}>
                      {dish.product}
                    </span>
                    <strong>{dish.name}</strong>
                    {dish.price && <span style={{ color: 'var(--text-light)' }}>{dish.price}</span>}
                  </div>
                  <ConfidenceBar score={dish.confidence || venue.confidence_score} />
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.75rem',
              background: 'var(--secondary)',
              borderRadius: '4px',
            }}>
              <span style={{ color: 'var(--text-light)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                No dishes found - venue may need dish discovery
              </span>
              <button
                className="btn btn-sm btn-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  const searchUrl = venue.delivery_platforms?.[0]?.url;
                  if (searchUrl) {
                    window.open(searchUrl, '_blank');
                  }
                  alert(
                    `Dish search triggered for ${venue.name}.\n\n` +
                    `To run the dish finder, use:\n` +
                    `pnpm run dish-finder --venue-id ${venue.id}\n\n` +
                    `Or run batch discovery for venues without dishes:\n` +
                    `pnpm run dish-finder --missing-dishes --country ${venue.address.country}`
                  );
                }}
                style={{ whiteSpace: 'nowrap' }}
              >
                🔍 Search for Dishes
              </button>
            </div>
          )}

          {/* Delivery Platforms - compact inline */}
          {venue.delivery_platforms.length > 0 && (
            <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>Sources:</span>
              {venue.delivery_platforms.map((dp, idx) => (
                <a
                  key={idx}
                  href={dp.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '0.2rem 0.5rem',
                    background: '#e3f2fd',
                    color: '#1565c0',
                    borderRadius: '3px',
                    fontSize: '0.7rem',
                    textDecoration: 'none',
                  }}
                >
                  {dp.platform} {dp.rating && `★${dp.rating}`}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Expanded Details - Additional info */}
        {isExpanded && (
          <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--border)', background: '#fafafa' }}>
            {/* Confidence Factors */}
            {venue.confidence_factors && venue.confidence_factors.length > 0 && (
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginBottom: '0.5rem' }}>Why this score?</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {venue.confidence_factors.map((factor, idx) => (
                    <div key={idx} style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{
                        width: '20px',
                        textAlign: 'center',
                        color: factor.score >= 0 ? 'var(--success)' : 'var(--error)',
                      }}>
                        {factor.score >= 0 ? '+' : ''}{factor.score}
                      </span>
                      <span>{factor.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Feedback Section */}
            <div style={{ padding: '0.75rem', background: 'white', borderRadius: '4px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginBottom: '0.5rem' }}>
                AI Feedback (helps improve future matches)
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-sm btn-secondary" style={{ background: '#d4edda', border: 'none' }}>
                  All Correct
                </button>
                <button className="btn btn-sm btn-secondary" style={{ background: '#fff3cd', border: 'none' }}>
                  Some Wrong
                </button>
                <button className="btn btn-sm btn-secondary" style={{ background: '#f8d7da', border: 'none' }}>
                  Not Planted
                </button>
              </div>
            </div>

            {/* Discovery Info */}
            <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-light)' }}>
              Discovered: {new Date(venue.created_at).toLocaleDateString()} via "{venue.discovered_by_query}"
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <header className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2>Review Queue</h2>
            <p style={{ color: 'var(--text-light)', margin: '0.25rem 0 0' }}>
              Review and verify AI-discovered venues • Press ? for keyboard shortcuts
              {dataUpdatedAt && (
                <span style={{ marginLeft: '1rem', fontSize: '0.8rem' }}>
                  • Last updated: {new Date(dataUpdatedAt).toLocaleTimeString()}
                </span>
              )}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {venuesWithoutDishes.length > 0 && (
              <button
                className="btn btn-primary"
                onClick={handleFetchMissingDishes}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <span>🔍</span>
                Fetch Dishes ({venuesWithoutDishes.length})
              </button>
            )}
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as ViewMode)}
              style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border)' }}
            >
              <option value="hierarchical">Hierarchical View</option>
              <option value="cards">Card View</option>
              <option value="table">Table View</option>
            </select>
          </div>
        </div>
      </header>

      <div className="page-content">
        {/* Stats Row */}
        {stats && (
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '1rem' }}>
            <div className="card stat-card" style={{ padding: '1rem' }}>
              <span className="stat-label">Pending Review</span>
              <span className="stat-value" style={{ fontSize: '1.5rem', color: 'var(--warning)' }}>
                {stats.total_discovered}
              </span>
            </div>
            <div className="card stat-card" style={{ padding: '1rem' }}>
              <span className="stat-label">High Confidence</span>
              <span className="stat-value" style={{ fontSize: '1.5rem', color: 'var(--success)' }}>
                {stats.by_confidence?.high || 0}
              </span>
            </div>
            <div className="card stat-card" style={{ padding: '1rem' }}>
              <span className="stat-label">Medium</span>
              <span className="stat-value" style={{ fontSize: '1.5rem', color: 'var(--warning)' }}>
                {stats.by_confidence?.medium || 0}
              </span>
            </div>
            <div className="card stat-card" style={{ padding: '1rem' }}>
              <span className="stat-label">Low</span>
              <span className="stat-value" style={{ fontSize: '1.5rem', color: 'var(--error)' }}>
                {stats.by_confidence?.low || 0}
              </span>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end', marginBottom: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Status</label>
            <select
              value={status}
              onChange={(e) => updateFilter('status', e.target.value)}
              style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border)' }}
            >
              <option value="discovered">Pending Review</option>
              <option value="verified">Verified</option>
              <option value="rejected">Rejected</option>
              <option value="">All</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Country</label>
            <select
              value={countryFilter}
              onChange={(e) => updateFilter('country', e.target.value)}
              style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border)' }}
            >
              <option value="">All Countries</option>
              <option value="DE">Germany</option>
              <option value="CH">Switzerland</option>
              <option value="AT">Austria</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Platform</label>
            <select
              value={platformFilter}
              onChange={(e) => updateFilter('platform', e.target.value)}
              style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border)' }}
            >
              <option value="">All Platforms</option>
              <option value="wolt">Wolt</option>
              <option value="uber-eats">Uber Eats</option>
              <option value="lieferando">Lieferando</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
              Min Confidence: {minConfidence}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={minConfidence}
              onChange={(e) => updateFilter('min_confidence', e.target.value === '0' ? '' : e.target.value)}
              style={{ width: '120px' }}
            />
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedVenues.size > 0 && (
          <div className="card" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            marginBottom: '1rem',
            background: '#e6f5ec',
            borderColor: 'var(--primary)',
          }}>
            <input type="checkbox" checked={selectedVenues.size === venues.length} onChange={selectAll} />
            <span style={{ fontWeight: 600 }}>{selectedVenues.size} selected</span>
            <button className="btn btn-primary btn-sm" onClick={handleBulkVerify} disabled={isAnyLoading}>
              Verify Selected
            </button>
            <button className="btn btn-danger btn-sm" onClick={handleBulkReject} disabled={isAnyLoading}>
              Reject Selected
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setSelectedVenues(new Set())}>
              Clear
            </button>
          </div>
        )}

        {/* Loading / Error / Empty states */}
        {isLoading && (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <div className="loading-spinner" />
            <p>Loading venues...</p>
          </div>
        )}

        {isError && (
          <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
            Failed to load venues: {(error as Error)?.message || 'Unknown error'}
          </div>
        )}

        {!isLoading && !isError && venues.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            <h3 style={{ color: 'var(--success)' }}>All caught up!</h3>
            <p style={{ color: 'var(--text-light)' }}>
              No venues to review. Check back later or adjust your filters.
            </p>
          </div>
        )}

        {/* Hierarchical View */}
        {!isLoading && viewMode === 'hierarchical' && hierarchy.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {hierarchy.map((country) => (
              <div key={country.code} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Country Header */}
                <div
                  onClick={() => toggleCountry(country.code)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '1rem 1.25rem',
                    cursor: 'pointer',
                    background: country.expanded ? '#f8f9fa' : 'transparent',
                    borderBottom: country.expanded ? '1px solid var(--border)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-light)' }}>
                      {country.expanded ? '−' : '+'}
                    </span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>
                        {country.code} {country.name}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>
                        {country.venueTypes.reduce((sum, t) => sum + t.chains.length + t.independents.length, 0)} venues
                      </div>
                    </div>
                  </div>
                  <div style={{
                    padding: '0.35rem 0.75rem',
                    background: country.pendingCount > 0 ? 'var(--warning)' : 'var(--success)',
                    color: country.pendingCount > 0 ? '#856404' : 'white',
                    borderRadius: '4px',
                    fontWeight: 600,
                  }}>
                    {country.pendingCount} pending
                  </div>
                </div>

                {/* Country Content */}
                {country.expanded && (
                  <div style={{ padding: '1rem' }}>
                    {country.venueTypes.map((typeNode) => (
                      <div key={typeNode.type} style={{ marginBottom: '1rem' }}>
                        <div style={{
                          fontWeight: 600,
                          fontSize: '0.9rem',
                          color: 'var(--text-light)',
                          marginBottom: '0.75rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}>
                          {typeNode.label} ({typeNode.chains.length + typeNode.independents.length})
                        </div>

                        {/* Chains */}
                        {typeNode.chains.map((chain) => (
                          <div key={chain.chainId} style={{ marginBottom: '0.75rem', marginLeft: '1rem' }}>
                            <div
                              onClick={() => toggleChain(`${country.code}-${typeNode.type}-${chain.chainId}`)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.5rem',
                                background: 'var(--secondary)',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                marginBottom: chain.expanded ? '0.5rem' : 0,
                              }}
                            >
                              <span>{expandedChains.has(`${country.code}-${typeNode.type}-${chain.chainId}`) ? '−' : '+'}</span>
                              <span style={{ fontWeight: 600 }}>{chain.chainName}</span>
                              <span style={{ color: 'var(--text-light)', fontSize: '0.85rem' }}>
                                ({chain.locations.length} locations)
                              </span>
                              <span style={{
                                marginLeft: 'auto',
                                padding: '0.15rem 0.5rem',
                                background: chain.pendingCount > 0 ? '#fff3cd' : '#d4edda',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                              }}>
                                {chain.pendingCount} pending
                              </span>
                            </div>

                            {expandedChains.has(`${country.code}-${typeNode.type}-${chain.chainId}`) && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginLeft: '1.5rem' }}>
                                {chain.locations.map((location) => (
                                  <LocationCard
                                    key={location.venue.id}
                                    location={location}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        ))}

                        {/* Independents */}
                        {typeNode.independents.length > 0 && (
                          <div style={{ marginLeft: '1rem' }}>
                            <div style={{
                              fontSize: '0.85rem',
                              color: 'var(--text-light)',
                              marginBottom: '0.5rem',
                            }}>
                              Independent Venues ({typeNode.independents.length})
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              {typeNode.independents.map((location) => (
                                <LocationCard
                                  key={location.venue.id}
                                  location={location}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Card View - simplified list */}
        {!isLoading && viewMode === 'cards' && venues.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {venues.map((venue) => (
              <LocationCard
                key={venue.id}
                location={{ venue, expanded: expandedLocations.has(venue.id) }}
              />
            ))}
          </div>
        )}

        {/* Table View */}
        {!isLoading && viewMode === 'table' && venues.length > 0 && (
          <div className="card">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '30px' }}>
                    <input type="checkbox" checked={selectedVenues.size === venues.length} onChange={selectAll} />
                  </th>
                  <th>Venue</th>
                  <th>Chain</th>
                  <th>Location</th>
                  <th>Dishes</th>
                  <th>Confidence</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {venues.map((venue) => (
                  <tr key={venue.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedVenues.has(venue.id)}
                        onChange={() => toggleSelect(venue.id)}
                      />
                    </td>
                    <td><strong>{venue.name}</strong></td>
                    <td>{venue.chain_name || '-'}</td>
                    <td>
                      {venue.address.city}, {COUNTRY_NAMES[venue.address.country] || venue.address.country}
                    </td>
                    <td>
                      {venue.dishes.length > 0 ? (
                        venue.dishes.length
                      ) : (
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => {
                            const searchUrl = venue.delivery_platforms?.[0]?.url;
                            if (searchUrl) {
                              window.open(searchUrl, '_blank');
                            }
                            alert(
                              `To run dish finder for ${venue.name}:\n` +
                              `pnpm run dish-finder --venue-id ${venue.id}`
                            );
                          }}
                          style={{ fontSize: '0.7rem', padding: '0.2rem 0.4rem' }}
                        >
                          🔍 Find
                        </button>
                      )}
                    </td>
                    <td><ConfidenceBar score={venue.confidence_score} /></td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => handleVerify(venue)}
                          disabled={isAnyLoading}
                        >
                          Verify
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleReject(venue)}
                          disabled={isAnyLoading}
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

export default ReviewQueuePage;
