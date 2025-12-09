import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Venue, VenueType, VenueStatus, CreateVenueInput } from '@pad/core';
import { venuesApi, dishesApi } from '../lib/api';

interface VenueFormData {
  name: string;
  type: VenueType;
  status: VenueStatus;
  street: string;
  city: string;
  postal_code: string;
  country: string;
  latitude: string;
  longitude: string;
  website: string;
  chain_id: string;
}

const emptyForm: VenueFormData = {
  name: '',
  type: 'restaurant',
  status: 'active',
  street: '',
  city: '',
  postal_code: '',
  country: 'CH',
  latitude: '',
  longitude: '',
  website: '',
  chain_id: '',
};

type ViewMode = 'grouped' | 'table';
type GroupBy = 'country' | 'type' | 'chain';

type DeliveryPartner = 'uber_eats' | 'wolt' | 'lieferando' | 'deliveroo' | 'just_eat' | 'glovo';

interface DeliveryPartnerInfo {
  partner: DeliveryPartner;
  url: string;
  price?: number;
}

interface Dish {
  id: string;
  venue_id: string;
  name: string;
  price?: { amount: number; currency: string };
  planted_products?: string[];
  dietary_tags?: string[];
  description?: string;
  delivery_partners?: DeliveryPartnerInfo[];
}

const deliveryPlatformLabels: Record<DeliveryPartner, string> = {
  uber_eats: 'Uber Eats',
  wolt: 'Wolt',
  lieferando: 'Lieferando',
  deliveroo: 'Deliveroo',
  just_eat: 'Just Eat',
  glovo: 'Glovo',
};

const deliveryPlatformColors: Record<DeliveryPartner, string> = {
  uber_eats: '#06C167',
  wolt: '#00C2E8',
  lieferando: '#FF8000',
  deliveroo: '#00CCBC',
  just_eat: '#FF5A00',
  glovo: '#FFC244',
};

interface GroupedVenue {
  key: string;
  label: string;
  venues: Venue[];
  locationCount: number;
  dishCount: number;
  countries: string[];
  types: VenueType[];
}

const countryNames: Record<string, string> = {
  CH: 'Switzerland',
  DE: 'Germany',
  AT: 'Austria',
  NL: 'Netherlands',
  UK: 'United Kingdom',
  US: 'United States',
  FR: 'France',
  IT: 'Italy',
};

const typeLabels: Record<VenueType, string> = {
  restaurant: 'Foodservice',
  retail: 'Retail',
  delivery_kitchen: 'Delivery Kitchen',
};

function VenuesPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null);
  const [formData, setFormData] = useState<VenueFormData>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grouped');
  const [groupBy, setGroupBy] = useState<GroupBy>('country');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [filterCountry, setFilterCountry] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);

  // Fetch venues
  const { data: venuesData, isLoading: venuesLoading, isError: venuesError } = useQuery({
    queryKey: ['venues'],
    queryFn: () => venuesApi.getAll({ limit: 1000 }),
  });

  // Fetch dishes for counts
  const { data: dishesData } = useQuery({
    queryKey: ['dishes'],
    queryFn: () => dishesApi.getAll({ limit: 5000 }),
  });

  const venues = (venuesData?.venues || []) as Venue[];
  const dishes = (dishesData?.dishes || []) as Dish[];

  // Calculate dish counts per venue
  const dishCountByVenue = useMemo(() => {
    const counts: Record<string, number> = {};
    dishes.forEach((dish) => {
      counts[dish.venue_id] = (counts[dish.venue_id] || 0) + 1;
    });
    return counts;
  }, [dishes]);

  // Get dishes for a specific venue
  const dishesByVenue = useMemo(() => {
    const byVenue: Record<string, Dish[]> = {};
    dishes.forEach((dish) => {
      if (!byVenue[dish.venue_id]) {
        byVenue[dish.venue_id] = [];
      }
      byVenue[dish.venue_id].push(dish);
    });
    return byVenue;
  }, [dishes]);

  // Get selected venue and its dishes
  const selectedVenue = useMemo(() => {
    if (!selectedVenueId) return null;
    return venues.find((v) => v.id === selectedVenueId) || null;
  }, [selectedVenueId, venues]);

  const selectedVenueDishes = useMemo(() => {
    if (!selectedVenueId) return [];
    return dishesByVenue[selectedVenueId] || [];
  }, [selectedVenueId, dishesByVenue]);

  // Get delivery platforms per venue (from dishes)
  const deliveryPlatformsByVenue = useMemo(() => {
    const platformsByVenue: Record<string, Set<DeliveryPartner>> = {};
    const platformLinksByVenue: Record<string, Partial<Record<DeliveryPartner, string>>> = {};

    dishes.forEach((dish) => {
      if (dish.delivery_partners && dish.delivery_partners.length > 0) {
        if (!platformsByVenue[dish.venue_id]) {
          platformsByVenue[dish.venue_id] = new Set();
          platformLinksByVenue[dish.venue_id] = {};
        }
        dish.delivery_partners.forEach((dp) => {
          platformsByVenue[dish.venue_id].add(dp.partner);
          if (dp.url && !platformLinksByVenue[dish.venue_id][dp.partner]) {
            platformLinksByVenue[dish.venue_id][dp.partner] = dp.url;
          }
        });
      }
    });

    return {
      platforms: Object.fromEntries(
        Object.entries(platformsByVenue).map(([k, v]) => [k, Array.from(v)])
      ) as Record<string, DeliveryPartner[]>,
      links: platformLinksByVenue,
    };
  }, [dishes]);

  // Filter venues
  const filteredVenues = useMemo(() => {
    return venues.filter((v) => {
      if (filterCountry !== 'all' && v.address.country !== filterCountry) return false;
      if (filterType !== 'all' && v.type !== filterType) return false;
      return true;
    });
  }, [venues, filterCountry, filterType]);

  // Group venues
  const groupedVenues = useMemo((): GroupedVenue[] => {
    const groups = new Map<string, Venue[]>();

    filteredVenues.forEach((venue) => {
      let key: string;
      switch (groupBy) {
        case 'country':
          key = venue.address.country;
          break;
        case 'type':
          key = venue.type;
          break;
        case 'chain':
          key = venue.chain_id || 'independent';
          break;
        default:
          key = 'all';
      }

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(venue);
    });

    return Array.from(groups.entries())
      .map(([key, venueList]) => {
        const dishCount = venueList.reduce((sum, v) => sum + (dishCountByVenue[v.id] || 0), 0);
        const countries = [...new Set(venueList.map((v) => v.address.country))];
        const types = [...new Set(venueList.map((v) => v.type))];

        let label: string;
        switch (groupBy) {
          case 'country':
            label = countryNames[key] || key;
            break;
          case 'type':
            label = typeLabels[key as VenueType] || key;
            break;
          case 'chain':
            label = key === 'independent' ? 'Independent Venues' : key;
            break;
          default:
            label = key;
        }

        return {
          key,
          label,
          venues: venueList.sort((a, b) => a.name.localeCompare(b.name)),
          locationCount: venueList.length,
          dishCount,
          countries,
          types,
        };
      })
      .sort((a, b) => b.locationCount - a.locationCount);
  }, [filteredVenues, groupBy, dishCountByVenue]);

  // Get unique countries and types for filters
  const uniqueCountries = useMemo(() => [...new Set(venues.map((v) => v.address.country))].sort(), [venues]);
  const uniqueTypes = useMemo(() => [...new Set(venues.map((v) => v.type))], [venues]);

  // Summary stats
  const stats = useMemo(() => ({
    totalVenues: filteredVenues.length,
    totalDishes: filteredVenues.reduce((sum, v) => sum + (dishCountByVenue[v.id] || 0), 0),
    byType: {
      restaurant: filteredVenues.filter((v) => v.type === 'restaurant').length,
      retail: filteredVenues.filter((v) => v.type === 'retail').length,
      delivery_kitchen: filteredVenues.filter((v) => v.type === 'delivery_kitchen').length,
    },
    byCountry: uniqueCountries.reduce((acc, country) => {
      acc[country] = filteredVenues.filter((v) => v.address.country === country).length;
      return acc;
    }, {} as Record<string, number>),
  }), [filteredVenues, dishCountByVenue, uniqueCountries]);

  const toggleGroup = (key: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedGroups(newExpanded);
  };

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateVenueInput) => venuesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venues'] });
      closeModal();
    },
    onError: (err: Error) => setError(err.message),
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Venue> }) =>
      venuesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venues'] });
      closeModal();
    },
    onError: (err: Error) => setError(err.message),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => venuesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venues'] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const openCreateModal = () => {
    setEditingVenue(null);
    setFormData(emptyForm);
    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (venue: Venue) => {
    setEditingVenue(venue);
    setFormData({
      name: venue.name,
      type: venue.type,
      status: venue.status,
      street: venue.address.street,
      city: venue.address.city,
      postal_code: venue.address.postal_code,
      country: venue.address.country,
      latitude: String(venue.location.latitude),
      longitude: String(venue.location.longitude),
      website: venue.contact?.website || '',
      chain_id: venue.chain_id || '',
    });
    setError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingVenue(null);
    setFormData(emptyForm);
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const lat = parseFloat(formData.latitude);
    const lng = parseFloat(formData.longitude);

    if (isNaN(lat) || isNaN(lng)) {
      setError('Invalid latitude or longitude');
      return;
    }

    const venueData: CreateVenueInput = {
      name: formData.name,
      type: formData.type,
      status: formData.status,
      address: {
        street: formData.street,
        city: formData.city,
        postal_code: formData.postal_code,
        country: formData.country,
      },
      location: {
        latitude: lat,
        longitude: lng,
      },
      opening_hours: { regular: {} },
      source: { type: 'manual' },
      ...(formData.website && { contact: { website: formData.website } }),
      ...(formData.chain_id && { chain_id: formData.chain_id }),
    };

    if (editingVenue) {
      updateMutation.mutate({ id: editingVenue.id, data: venueData });
    } else {
      createMutation.mutate(venueData);
    }
  };

  const handleDelete = (venue: Venue) => {
    if (confirm(`Are you sure you want to archive "${venue.name}"?`)) {
      deleteMutation.mutate(venue.id);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <header className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Venues</h2>
          <button className="btn btn-primary" onClick={openCreateModal}>
            Add Venue
          </button>
        </div>
      </header>

      <div className="page-content">
        {venuesError && (
          <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
            Failed to load venues. Please try again.
          </div>
        )}

        {/* Summary Stats */}
        <div className="stats-grid" style={{ marginBottom: '1rem' }}>
          <div className="card stat-card">
            <span className="stat-label">Total Locations</span>
            <span className="stat-value">{venuesLoading ? '-' : stats.totalVenues}</span>
          </div>
          <div className="card stat-card">
            <span className="stat-label">Total Dishes</span>
            <span className="stat-value">{venuesLoading ? '-' : stats.totalDishes}</span>
          </div>
          <div className="card stat-card">
            <span className="stat-label">Foodservice</span>
            <span className="stat-value">{venuesLoading ? '-' : stats.byType.restaurant}</span>
          </div>
          <div className="card stat-card">
            <span className="stat-label">Retail</span>
            <span className="stat-value">{venuesLoading ? '-' : stats.byType.retail}</span>
          </div>
        </div>

        {/* Filters and View Controls */}
        <div className="card" style={{ marginBottom: '1rem', padding: '1rem' }}>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ fontWeight: 500 }}>View:</label>
              <select
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value as ViewMode)}
                style={{ padding: '0.25rem 0.5rem' }}
              >
                <option value="grouped">Grouped</option>
                <option value="table">Table</option>
              </select>
            </div>

            {viewMode === 'grouped' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label style={{ fontWeight: 500 }}>Group by:</label>
                <select
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value as GroupBy)}
                  style={{ padding: '0.25rem 0.5rem' }}
                >
                  <option value="country">Country</option>
                  <option value="type">Type</option>
                  <option value="chain">Chain/Brand</option>
                </select>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ fontWeight: 500 }}>Country:</label>
              <select
                value={filterCountry}
                onChange={(e) => setFilterCountry(e.target.value)}
                style={{ padding: '0.25rem 0.5rem' }}
              >
                <option value="all">All Countries</option>
                {uniqueCountries.map((c) => (
                  <option key={c} value={c}>{countryNames[c] || c}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ fontWeight: 500 }}>Type:</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                style={{ padding: '0.25rem 0.5rem' }}
              >
                <option value="all">All Types</option>
                {uniqueTypes.map((t) => (
                  <option key={t} value={t}>{typeLabels[t]}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Content */}
        {venuesLoading ? (
          <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
            <div className="loading-spinner" />
            <p>Loading venues...</p>
          </div>
        ) : filteredVenues.length === 0 ? (
          <div className="card">
            <p style={{ color: 'var(--text-light)', textAlign: 'center', padding: '2rem' }}>
              No venues found. Click "Add Venue" to create one.
            </p>
          </div>
        ) : viewMode === 'grouped' ? (
          /* Grouped View */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {groupedVenues.map((group) => (
              <div key={group.key} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Group Header */}
                <div
                  onClick={() => toggleGroup(group.key)}
                  style={{
                    padding: '1rem',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: expandedGroups.has(group.key) ? 'var(--bg-secondary)' : 'transparent',
                    borderBottom: expandedGroups.has(group.key) ? '1px solid var(--border)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                      {expandedGroups.has(group.key) ? '−' : '+'}
                    </span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{group.label}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>
                        {groupBy !== 'country' && group.countries.length > 0 && (
                          <span>{group.countries.map((c) => countryNames[c] || c).join(', ')}</span>
                        )}
                        {groupBy !== 'type' && group.types.length > 0 && (
                          <span>
                            {groupBy !== 'country' && ' · '}
                            {group.types.map((t) => typeLabels[t]).join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{group.locationCount}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>locations</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{group.dishCount}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>dishes</div>
                    </div>
                  </div>
                </div>

                {/* Group Content */}
                {expandedGroups.has(group.key) && (
                  <div style={{ padding: '0' }}>
                    <table className="data-table" style={{ marginBottom: 0 }}>
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Address</th>
                          {groupBy !== 'country' && <th>Country</th>}
                          {groupBy !== 'type' && <th>Type</th>}
                          <th>Platforms</th>
                          <th>Dishes</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.venues.map((venue) => {
                          const venuePlatforms = deliveryPlatformsByVenue.platforms[venue.id] || [];
                          return (
                            <tr
                              key={venue.id}
                              onClick={() => setSelectedVenueId(venue.id)}
                              style={{
                                cursor: 'pointer',
                                background: selectedVenueId === venue.id ? 'var(--bg-secondary)' : undefined,
                              }}
                            >
                              <td>
                                <strong>{venue.name}</strong>
                                {venue.chain_id && (
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
                                    Chain: {venue.chain_id}
                                  </div>
                                )}
                              </td>
                              <td>
                                <div>{venue.address.street}</div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>
                                  {venue.address.postal_code} {venue.address.city}
                                </div>
                              </td>
                              {groupBy !== 'country' && <td>{countryNames[venue.address.country] || venue.address.country}</td>}
                              {groupBy !== 'type' && (
                                <td>
                                  <span className={`badge badge-${venue.type}`}>
                                    {typeLabels[venue.type]}
                                  </span>
                                </td>
                              )}
                              <td>
                                {venuePlatforms.length > 0 ? (
                                  <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                                    {venuePlatforms.map((p) => (
                                      <span
                                        key={p}
                                        title={deliveryPlatformLabels[p]}
                                        style={{
                                          fontSize: '0.65rem',
                                          padding: '0.15rem 0.35rem',
                                          borderRadius: '3px',
                                          background: deliveryPlatformColors[p],
                                          color: 'white',
                                          fontWeight: 600,
                                        }}
                                      >
                                        {deliveryPlatformLabels[p].split(' ')[0]}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span style={{ color: 'var(--text-light)', fontSize: '0.85rem' }}>-</span>
                                )}
                              </td>
                              <td>
                                <span
                                  style={{
                                    fontWeight: dishCountByVenue[venue.id] > 0 ? 600 : 400,
                                    color: dishCountByVenue[venue.id] > 0 ? 'var(--primary)' : 'var(--text-light)',
                                  }}
                                >
                                  {dishCountByVenue[venue.id] || 0}
                                </span>
                              </td>
                              <td>
                                <span className={`badge badge-${venue.status}`}>
                                  {venue.status}
                                </span>
                              </td>
                              <td>
                                <button
                                  className="btn btn-sm btn-secondary"
                                  onClick={(e) => { e.stopPropagation(); openEditModal(venue); }}
                                  style={{ marginRight: '0.5rem' }}
                                >
                                  Edit
                                </button>
                                <button
                                  className="btn btn-sm btn-danger"
                                  onClick={(e) => { e.stopPropagation(); handleDelete(venue); }}
                                  disabled={deleteMutation.isPending}
                                >
                                  Archive
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          /* Table View */
          <div className="card">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Address</th>
                  <th>Country</th>
                  <th>Platforms</th>
                  <th>Chain</th>
                  <th>Dishes</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredVenues.map((venue) => {
                  const venuePlatforms = deliveryPlatformsByVenue.platforms[venue.id] || [];
                  return (
                    <tr
                      key={venue.id}
                      onClick={() => setSelectedVenueId(venue.id)}
                      style={{
                        cursor: 'pointer',
                        background: selectedVenueId === venue.id ? 'var(--bg-secondary)' : undefined,
                      }}
                    >
                      <td>{venue.name}</td>
                      <td>
                        <span className={`badge badge-${venue.type}`}>
                          {typeLabels[venue.type]}
                        </span>
                      </td>
                      <td>
                        <div>{venue.address.street}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>
                          {venue.address.postal_code} {venue.address.city}
                        </div>
                      </td>
                      <td>{countryNames[venue.address.country] || venue.address.country}</td>
                      <td>
                        {venuePlatforms.length > 0 ? (
                          <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                            {venuePlatforms.map((p) => (
                              <span
                                key={p}
                                title={deliveryPlatformLabels[p]}
                                style={{
                                  fontSize: '0.65rem',
                                  padding: '0.15rem 0.35rem',
                                  borderRadius: '3px',
                                  background: deliveryPlatformColors[p],
                                  color: 'white',
                                  fontWeight: 600,
                                }}
                              >
                                {deliveryPlatformLabels[p].split(' ')[0]}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-light)', fontSize: '0.85rem' }}>-</span>
                        )}
                      </td>
                      <td>{venue.chain_id || '-'}</td>
                      <td>
                        <span
                          style={{
                            fontWeight: dishCountByVenue[venue.id] > 0 ? 600 : 400,
                            color: dishCountByVenue[venue.id] > 0 ? 'var(--primary)' : 'var(--text-light)',
                          }}
                        >
                          {dishCountByVenue[venue.id] || 0}
                        </span>
                      </td>
                      <td>
                        <span className={`badge badge-${venue.status}`}>
                          {venue.status}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={(e) => { e.stopPropagation(); openEditModal(venue); }}
                          style={{ marginRight: '0.5rem' }}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={(e) => { e.stopPropagation(); handleDelete(venue); }}
                          disabled={deleteMutation.isPending}
                        >
                          Archive
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingVenue ? 'Edit Venue' : 'Add Venue'}</h3>
              <button className="modal-close" onClick={closeModal}>
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {error && (
                  <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
                    {error}
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="name">Name *</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="type">Type *</label>
                    <select
                      id="type"
                      name="type"
                      value={formData.type}
                      onChange={handleChange}
                      required
                    >
                      <option value="restaurant">Foodservice</option>
                      <option value="retail">Retail</option>
                      <option value="delivery_kitchen">Delivery Kitchen</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="status">Status *</label>
                    <select
                      id="status"
                      name="status"
                      value={formData.status}
                      onChange={handleChange}
                      required
                    >
                      <option value="active">Active</option>
                      <option value="stale">Stale</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="chain_id">Chain/Brand ID (optional)</label>
                  <input
                    type="text"
                    id="chain_id"
                    name="chain_id"
                    value={formData.chain_id}
                    onChange={handleChange}
                    placeholder="e.g., hans-im-glueck, dean-david"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="street">Street *</label>
                  <input
                    type="text"
                    id="street"
                    name="street"
                    value={formData.street}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="city">City *</label>
                    <input
                      type="text"
                      id="city"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="postal_code">Postal Code *</label>
                    <input
                      type="text"
                      id="postal_code"
                      name="postal_code"
                      value={formData.postal_code}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="country">Country *</label>
                    <select
                      id="country"
                      name="country"
                      value={formData.country}
                      onChange={handleChange}
                      required
                    >
                      <option value="CH">Switzerland</option>
                      <option value="DE">Germany</option>
                      <option value="AT">Austria</option>
                      <option value="NL">Netherlands</option>
                      <option value="UK">United Kingdom</option>
                      <option value="FR">France</option>
                      <option value="IT">Italy</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="latitude">Latitude *</label>
                    <input
                      type="text"
                      id="latitude"
                      name="latitude"
                      value={formData.latitude}
                      onChange={handleChange}
                      required
                      placeholder="47.3769"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="longitude">Longitude *</label>
                    <input
                      type="text"
                      id="longitude"
                      name="longitude"
                      value={formData.longitude}
                      onChange={handleChange}
                      required
                      placeholder="8.5417"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="website">Website</label>
                  <input
                    type="url"
                    id="website"
                    name="website"
                    value={formData.website}
                    onChange={handleChange}
                    placeholder="https://example.com"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closeModal}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Saving...' : editingVenue ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Venue Dishes Panel */}
      {selectedVenue && (
        <div
          className="modal-overlay"
          onClick={() => setSelectedVenueId(null)}
          style={{ background: 'rgba(0,0,0,0.3)' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              right: 0,
              top: 0,
              bottom: 0,
              width: '500px',
              maxWidth: '90vw',
              background: 'var(--bg-primary)',
              boxShadow: '-4px 0 20px rgba(0,0,0,0.15)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Panel Header */}
            <div
              style={{
                padding: '1.25rem',
                borderBottom: '1px solid var(--border)',
                background: 'var(--bg-secondary)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ margin: 0, marginBottom: '0.5rem' }}>{selectedVenue.name}</h3>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-light)' }}>
                    {selectedVenue.address.street}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-light)' }}>
                    {selectedVenue.address.postal_code} {selectedVenue.address.city}, {countryNames[selectedVenue.address.country] || selectedVenue.address.country}
                  </div>
                  {selectedVenue.chain_id && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <span className="badge badge-info">{selectedVenue.chain_id}</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setSelectedVenueId(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '1.5rem',
                    cursor: 'pointer',
                    padding: '0.25rem',
                    color: 'var(--text-light)',
                  }}
                >
                  &times;
                </button>
              </div>
              <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span className={`badge badge-${selectedVenue.type}`}>
                  {typeLabels[selectedVenue.type]}
                </span>
                <span className={`badge badge-${selectedVenue.status}`}>
                  {selectedVenue.status}
                </span>
              </div>

              {/* Delivery Platforms */}
              {(() => {
                const platforms = deliveryPlatformsByVenue.platforms[selectedVenue.id] || [];
                const links = deliveryPlatformsByVenue.links[selectedVenue.id] || {};
                if (platforms.length === 0) return null;
                return (
                  <div style={{ marginTop: '1rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginBottom: '0.5rem' }}>
                      Order Online:
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {platforms.map((p) => (
                        <a
                          key={p}
                          href={links[p] || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            padding: '0.35rem 0.65rem',
                            borderRadius: '4px',
                            background: deliveryPlatformColors[p],
                            color: 'white',
                            fontWeight: 600,
                            fontSize: '0.8rem',
                            textDecoration: 'none',
                          }}
                        >
                          {deliveryPlatformLabels[p]}
                          <span style={{ fontSize: '0.7rem' }}>↗</span>
                        </a>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Dishes List */}
            <div style={{ flex: 1, overflow: 'auto', padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h4 style={{ margin: 0 }}>
                  Dishes ({selectedVenueDishes.length})
                </h4>
              </div>

              {selectedVenueDishes.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '2rem',
                    color: 'var(--text-light)',
                    background: 'var(--bg-secondary)',
                    borderRadius: '8px',
                  }}
                >
                  No dishes found for this venue.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {selectedVenueDishes.map((dish) => (
                    <div
                      key={dish.id}
                      style={{
                        padding: '1rem',
                        background: 'var(--bg-secondary)',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                            {dish.name}
                          </div>
                          {dish.description && (
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: '0.5rem' }}>
                              {dish.description}
                            </div>
                          )}
                          {dish.planted_products && dish.planted_products.length > 0 && (
                            <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                              {dish.planted_products.map((product, idx) => (
                                <span
                                  key={idx}
                                  style={{
                                    fontSize: '0.75rem',
                                    padding: '0.15rem 0.5rem',
                                    background: 'var(--primary)',
                                    color: 'white',
                                    borderRadius: '4px',
                                  }}
                                >
                                  {product}
                                </span>
                              ))}
                            </div>
                          )}
                          {dish.dietary_tags && dish.dietary_tags.length > 0 && (
                            <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
                              {dish.dietary_tags.map((tag, idx) => (
                                <span
                                  key={idx}
                                  style={{
                                    fontSize: '0.7rem',
                                    padding: '0.1rem 0.4rem',
                                    background: 'var(--bg-tertiary)',
                                    color: 'var(--text-light)',
                                    borderRadius: '3px',
                                  }}
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        {dish.price && (
                          <div
                            style={{
                              fontWeight: 600,
                              fontSize: '1rem',
                              marginLeft: '1rem',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {dish.price.currency} {dish.price.amount.toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Panel Footer */}
            <div
              style={{
                padding: '1rem',
                borderTop: '1px solid var(--border)',
                display: 'flex',
                gap: '0.5rem',
              }}
            >
              <button
                className="btn btn-secondary"
                onClick={() => {
                  openEditModal(selectedVenue);
                  setSelectedVenueId(null);
                }}
              >
                Edit Venue
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setSelectedVenueId(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default VenuesPage;
