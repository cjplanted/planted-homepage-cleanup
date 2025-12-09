import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { venuesApi, dishesApi } from '../lib/api';
import type { Venue, VenueType } from '@pad/core';

const COUNTRY_NAMES: Record<string, string> = {
  CH: 'Switzerland',
  DE: 'Germany',
  AT: 'Austria',
  NL: 'Netherlands',
  UK: 'United Kingdom',
  FR: 'France',
  IT: 'Italy',
};

const TYPE_LABELS: Record<VenueType, string> = {
  restaurant: 'Foodservice',
  retail: 'Retail',
  delivery_kitchen: 'Delivery Kitchen',
};

type TreeNodeType = 'country' | 'type' | 'chain' | 'venue';

interface TreeNode {
  id: string;
  type: TreeNodeType;
  label: string;
  children?: TreeNode[];
  data?: unknown;
  count?: number;
}

interface Dish {
  id: string;
  venue_id: string;
  name: string;
  price?: { amount: number; currency: string };
  planted_products?: string[];
  dietary_tags?: string[];
  description?: string;
}

function DataBrowserPage() {
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['root']));
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCountry, setFilterCountry] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');

  // Auto-refresh interval (5 minutes)
  const REFRESH_INTERVAL = 5 * 60 * 1000;

  // Fetch venues with auto-refresh
  const { data: venuesData, isLoading: venuesLoading, dataUpdatedAt: venuesUpdatedAt } = useQuery({
    queryKey: ['venues'],
    queryFn: () => venuesApi.getAll({ limit: 2000 }),
    refetchInterval: REFRESH_INTERVAL,
    refetchIntervalInBackground: false,
  });

  // Fetch dishes with auto-refresh
  const { data: dishesData, isLoading: dishesLoading } = useQuery({
    queryKey: ['dishes'],
    queryFn: () => dishesApi.getAll({ limit: 10000 }),
    refetchInterval: REFRESH_INTERVAL,
    refetchIntervalInBackground: false,
  });

  const venues = (venuesData?.venues || []) as Venue[];
  const dishes = (dishesData?.dishes || []) as Dish[];

  // Build dish counts
  const dishCountByVenue = useMemo(() => {
    const counts: Record<string, number> = {};
    dishes.forEach((dish) => {
      counts[dish.venue_id] = (counts[dish.venue_id] || 0) + 1;
    });
    return counts;
  }, [dishes]);

  // Build tree structure
  const tree = useMemo((): TreeNode[] => {
    let filteredVenues = venues;

    // Apply filters
    if (filterCountry !== 'all') {
      filteredVenues = filteredVenues.filter((v) => v.address.country === filterCountry);
    }
    if (filterType !== 'all') {
      filteredVenues = filteredVenues.filter((v) => v.type === filterType);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filteredVenues = filteredVenues.filter((v) =>
        v.name.toLowerCase().includes(q) ||
        v.address.city.toLowerCase().includes(q) ||
        v.chain_id?.toLowerCase().includes(q)
      );
    }

    // Group by country
    const byCountry = new Map<string, Venue[]>();
    filteredVenues.forEach((v) => {
      const country = v.address.country;
      if (!byCountry.has(country)) byCountry.set(country, []);
      byCountry.get(country)!.push(v);
    });

    return Array.from(byCountry.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .map(([country, countryVenues]) => {
        // Group by type
        const byType = new Map<string, Venue[]>();
        countryVenues.forEach((v) => {
          const type = v.type;
          if (!byType.has(type)) byType.set(type, []);
          byType.get(type)!.push(v);
        });

        const typeNodes: TreeNode[] = Array.from(byType.entries()).map(([type, typeVenues]) => {
          // Group by chain
          const chains = new Map<string, Venue[]>();
          const independents: Venue[] = [];

          typeVenues.forEach((v) => {
            if (v.chain_id) {
              if (!chains.has(v.chain_id)) chains.set(v.chain_id, []);
              chains.get(v.chain_id)!.push(v);
            } else {
              independents.push(v);
            }
          });

          const chainNodes: TreeNode[] = Array.from(chains.entries())
            .sort((a, b) => b[1].length - a[1].length)
            .map(([chainId, chainVenues]) => ({
              id: `chain-${country}-${type}-${chainId}`,
              type: 'chain' as TreeNodeType,
              label: chainId,
              count: chainVenues.length,
              children: chainVenues.map((v) => ({
                id: `venue-${v.id}`,
                type: 'venue' as TreeNodeType,
                label: `${v.address.city} - ${v.address.street || v.name}`,
                data: v,
                count: dishCountByVenue[v.id] || 0,
              })),
            }));

          const independentNodes: TreeNode[] = independents.map((v) => ({
            id: `venue-${v.id}`,
            type: 'venue' as TreeNodeType,
            label: v.name,
            data: v,
            count: dishCountByVenue[v.id] || 0,
          }));

          return {
            id: `type-${country}-${type}`,
            type: 'type' as TreeNodeType,
            label: TYPE_LABELS[type as VenueType] || type,
            count: typeVenues.length,
            children: [...chainNodes, ...independentNodes],
          };
        });

        return {
          id: `country-${country}`,
          type: 'country' as TreeNodeType,
          label: `${country} ${COUNTRY_NAMES[country] || country}`,
          count: countryVenues.length,
          children: typeNodes,
        };
      });
  }, [venues, dishes, filterCountry, filterType, searchQuery, dishCountByVenue]);

  // Get unique values for filters
  const countries = useMemo(() => [...new Set(venues.map((v) => v.address.country))].sort(), [venues]);
  const types = useMemo(() => [...new Set(venues.map((v) => v.type))], [venues]);

  // Toggle node expansion
  const toggleExpand = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  // Get selected venue details
  const selectedVenue = selectedNode?.type === 'venue' ? (selectedNode.data as Venue) : null;
  const selectedVenueDishes = selectedVenue
    ? dishes.filter((d) => d.venue_id === selectedVenue.id)
    : [];

  // Summary stats
  const stats = useMemo(() => {
    const chainSet = new Set(venues.filter((v) => v.chain_id).map((v) => v.chain_id));
    return {
      totalVenues: venues.length,
      totalDishes: dishes.length,
      totalChains: chainSet.size,
      byCountry: countries.reduce((acc, c) => {
        acc[c] = venues.filter((v) => v.address.country === c).length;
        return acc;
      }, {} as Record<string, number>),
    };
  }, [venues, dishes, countries]);

  // Render tree node
  const renderTreeNode = (node: TreeNode, depth: number = 0) => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const isSelected = selectedNode?.id === node.id;

    return (
      <div key={node.id}>
        <div
          onClick={() => {
            if (hasChildren) toggleExpand(node.id);
            setSelectedNode(node);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 0.75rem',
            paddingLeft: `${depth * 1.25 + 0.75}rem`,
            cursor: 'pointer',
            background: isSelected ? '#e6f5ec' : 'transparent',
            borderLeft: isSelected ? '3px solid var(--primary)' : '3px solid transparent',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => {
            if (!isSelected) e.currentTarget.style.background = '#f5f5f5';
          }}
          onMouseLeave={(e) => {
            if (!isSelected) e.currentTarget.style.background = 'transparent';
          }}
        >
          {hasChildren && (
            <span style={{ color: 'var(--text-light)', fontSize: '0.85rem', width: '1rem' }}>
              {isExpanded ? '−' : '+'}
            </span>
          )}
          {!hasChildren && <span style={{ width: '1rem' }} />}

          <span style={{
            fontWeight: node.type === 'country' ? 600 : node.type === 'chain' ? 500 : 400,
            fontSize: node.type === 'country' ? '0.95rem' : '0.9rem',
            color: node.type === 'venue' ? 'var(--text)' : 'var(--text)',
          }}>
            {node.label}
          </span>

          <span style={{
            marginLeft: 'auto',
            fontSize: '0.75rem',
            color: 'var(--text-light)',
            background: 'var(--secondary)',
            padding: '0.15rem 0.4rem',
            borderRadius: '4px',
          }}>
            {node.count}
          </span>
        </div>

        {isExpanded && hasChildren && (
          <div>
            {node.children!.map((child) => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const isLoading = venuesLoading || dishesLoading;

  return (
    <>
      <header className="page-header">
        <h2>Data Browser</h2>
        <p style={{ color: 'var(--text-light)', margin: '0.25rem 0 0' }}>
          Explore and manage verified production data
          {venuesUpdatedAt && (
            <span style={{ marginLeft: '1rem', fontSize: '0.8rem' }}>
              • Last updated: {new Date(venuesUpdatedAt).toLocaleTimeString()}
            </span>
          )}
        </p>
      </header>

      <div className="page-content">
        {/* Stats Row */}
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '1.5rem' }}>
          <div className="card stat-card" style={{ padding: '1rem' }}>
            <span className="stat-label">Total Venues</span>
            <span className="stat-value" style={{ fontSize: '1.5rem' }}>
              {isLoading ? '-' : stats.totalVenues}
            </span>
          </div>
          <div className="card stat-card" style={{ padding: '1rem' }}>
            <span className="stat-label">Total Dishes</span>
            <span className="stat-value" style={{ fontSize: '1.5rem' }}>
              {isLoading ? '-' : stats.totalDishes}
            </span>
          </div>
          <div className="card stat-card" style={{ padding: '1rem' }}>
            <span className="stat-label">Chains</span>
            <span className="stat-value" style={{ fontSize: '1.5rem' }}>
              {isLoading ? '-' : stats.totalChains}
            </span>
          </div>
          <div className="card stat-card" style={{ padding: '1rem' }}>
            <span className="stat-label">Countries</span>
            <span className="stat-value" style={{ fontSize: '1.5rem' }}>
              {isLoading ? '-' : countries.length}
            </span>
          </div>
        </div>

        {/* Main Content - Split View */}
        <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '1.5rem', height: 'calc(100vh - 280px)', minHeight: '500px' }}>
          {/* Left Panel - Tree */}
          <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Search and Filters - Fixed */}
            <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <input
                type="text"
                placeholder="Search venues, chains, cities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  marginBottom: '0.75rem',
                }}
              />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <select
                  value={filterCountry}
                  onChange={(e) => setFilterCountry(e.target.value)}
                  style={{ flex: 1, padding: '0.35rem', borderRadius: '4px', border: '1px solid var(--border)', fontSize: '0.85rem' }}
                >
                  <option value="all">All Countries</option>
                  {countries.map((c) => (
                    <option key={c} value={c}>{COUNTRY_NAMES[c] || c}</option>
                  ))}
                </select>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  style={{ flex: 1, padding: '0.35rem', borderRadius: '4px', border: '1px solid var(--border)', fontSize: '0.85rem' }}
                >
                  <option value="all">All Types</option>
                  {types.map((t) => (
                    <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Tree */}
            <div style={{ flex: 1, overflow: 'auto' }}>
              {isLoading ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <div className="loading-spinner" />
                  <p style={{ marginTop: '0.5rem', color: 'var(--text-light)' }}>Loading...</p>
                </div>
              ) : tree.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-light)' }}>
                  No venues match your filters
                </div>
              ) : (
                tree.map((node) => renderTreeNode(node))
              )}
            </div>
          </div>

          {/* Right Panel - Details */}
          <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {!selectedNode ? (
              <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-light)',
              }}>
                Select a venue to view details
              </div>
            ) : selectedNode.type === 'venue' && selectedVenue ? (
              <>
                {/* Venue Header - Fixed */}
                <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                  <h3 style={{ margin: 0, marginBottom: '0.5rem' }}>{selectedVenue.name}</h3>
                  <div style={{ color: 'var(--text-light)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                    {selectedVenue.address.street && `${selectedVenue.address.street}, `}
                    {selectedVenue.address.postal_code} {selectedVenue.address.city}, {COUNTRY_NAMES[selectedVenue.address.country]}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span className={`badge badge-${selectedVenue.type}`}>
                      {TYPE_LABELS[selectedVenue.type]}
                    </span>
                    <span className={`badge badge-${selectedVenue.status}`}>
                      {selectedVenue.status}
                    </span>
                    {selectedVenue.chain_id && (
                      <span className="badge" style={{ background: '#e3f2fd', color: '#1565c0' }}>
                        {selectedVenue.chain_id}
                      </span>
                    )}
                  </div>
                </div>

                {/* Venue Details - Scrollable */}
                <div style={{ flex: 1, overflow: 'auto', padding: '1.5rem' }}>
                  {/* Info Grid */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '1rem',
                    marginBottom: '1.5rem',
                  }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginBottom: '0.25rem' }}>ID</div>
                      <div style={{ fontSize: '0.85rem', fontFamily: 'monospace' }}>{selectedVenue.id}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginBottom: '0.25rem' }}>Coordinates</div>
                      <div style={{ fontSize: '0.85rem' }}>
                        {selectedVenue.location.latitude.toFixed(4)}, {selectedVenue.location.longitude.toFixed(4)}
                      </div>
                    </div>
                    {selectedVenue.contact?.website && (
                      <div style={{ gridColumn: '1 / -1' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginBottom: '0.25rem' }}>Website</div>
                        <a
                          href={selectedVenue.contact.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: '0.85rem', color: 'var(--primary)' }}
                        >
                          {selectedVenue.contact.website}
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Dishes */}
                  <div>
                    <h4 style={{ marginBottom: '0.75rem' }}>
                      Dishes ({selectedVenueDishes.length})
                    </h4>
                    {selectedVenueDishes.length === 0 ? (
                      <div style={{
                        padding: '2rem',
                        background: 'var(--secondary)',
                        borderRadius: '8px',
                        textAlign: 'center',
                      }}>
                        <div style={{ color: 'var(--text-light)', marginBottom: '1rem' }}>
                          No dishes recorded for this venue
                        </div>
                        <button
                          className="btn btn-primary"
                          onClick={() => {
                            // Trigger dish search for this venue
                            const searchUrl = selectedVenue.delivery_platforms?.[0]?.url || selectedVenue.contact?.website;
                            if (searchUrl) {
                              window.open(searchUrl, '_blank');
                            }
                            alert(`Dish search triggered for ${selectedVenue.name}.\n\nTo run the dish finder, use:\npnpm run dish-finder --venue-id ${selectedVenue.id}`);
                          }}
                        >
                          Search for Dishes
                        </button>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '0.75rem' }}>
                          This will scan delivery platforms for menu items
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {selectedVenueDishes.map((dish) => (
                          <div
                            key={dish.id}
                            style={{
                              padding: '0.75rem 1rem',
                              background: 'var(--secondary)',
                              borderRadius: '4px',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div>
                                <div style={{ fontWeight: 500 }}>{dish.name}</div>
                                {dish.description && (
                                  <div style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginTop: '0.25rem' }}>
                                    {dish.description}
                                  </div>
                                )}
                                {dish.planted_products && dish.planted_products.length > 0 && (
                                  <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.5rem' }}>
                                    {dish.planted_products.map((p, i) => (
                                      <span
                                        key={i}
                                        style={{
                                          fontSize: '0.7rem',
                                          padding: '0.15rem 0.4rem',
                                          background: 'var(--primary)',
                                          color: 'white',
                                          borderRadius: '4px',
                                        }}
                                      >
                                        {p}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              {dish.price && (
                                <div style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                                  {dish.price.currency} {dish.price.amount.toFixed(2)}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions Footer - Fixed */}
                <div style={{
                  padding: '1rem 1.5rem',
                  borderTop: '1px solid var(--border)',
                  display: 'flex',
                  gap: '0.5rem',
                  flexShrink: 0,
                }}>
                  <button className="btn btn-secondary">Edit Venue</button>
                  <button className="btn btn-secondary">View on Map</button>
                  <button className="btn btn-primary" style={{ marginLeft: 'auto' }}>
                    Sync to Website
                  </button>
                </div>
              </>
            ) : (
              // Summary for non-venue nodes
              <div style={{ padding: '1.5rem' }}>
                <h3 style={{ marginBottom: '1rem' }}>{selectedNode.label}</h3>
                <div style={{
                  padding: '1rem',
                  background: 'var(--secondary)',
                  borderRadius: '4px',
                }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: '0.25rem' }}>
                    {selectedNode.type === 'country' && 'Venues in country'}
                    {selectedNode.type === 'type' && 'Venues of this type'}
                    {selectedNode.type === 'chain' && 'Locations in chain'}
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{selectedNode.count}</div>
                </div>
                {selectedNode.children && selectedNode.children.length > 0 && (
                  <div style={{ marginTop: '1rem' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: '0.5rem' }}>
                      Contains:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {selectedNode.children.slice(0, 10).map((child) => (
                        <span
                          key={child.id}
                          onClick={() => {
                            setSelectedNode(child);
                            toggleExpand(selectedNode.id);
                          }}
                          style={{
                            padding: '0.35rem 0.75rem',
                            background: 'var(--secondary)',
                            borderRadius: '4px',
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                          }}
                        >
                          {child.label} ({child.count})
                        </span>
                      ))}
                      {selectedNode.children.length > 10 && (
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-light)', padding: '0.35rem' }}>
                          +{selectedNode.children.length - 10} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default DataBrowserPage;
