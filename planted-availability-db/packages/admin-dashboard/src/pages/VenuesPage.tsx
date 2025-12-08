import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Venue, VenueType, VenueStatus, CreateVenueInput } from '@pad/core';
import { venuesApi } from '../lib/api';

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
};

function VenuesPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null);
  const [formData, setFormData] = useState<VenueFormData>(emptyForm);
  const [error, setError] = useState<string | null>(null);

  // Fetch venues
  const { data, isLoading, isError } = useQuery({
    queryKey: ['venues'],
    queryFn: () => venuesApi.getAll({ limit: 100 }),
  });

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

  const venues = (data?.venues || []) as Venue[];
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
        {isError && (
          <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
            Failed to load venues. Please try again.
          </div>
        )}

        <div className="card">
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <div className="loading-spinner" />
              <p>Loading venues...</p>
            </div>
          ) : venues.length === 0 ? (
            <p style={{ color: 'var(--text-light)', textAlign: 'center', padding: '2rem' }}>
              No venues found. Click "Add Venue" to create one.
            </p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>City</th>
                  <th>Country</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {venues.map((venue) => (
                  <tr key={venue.id}>
                    <td>{venue.name}</td>
                    <td>
                      <span className={`badge badge-${venue.type}`}>
                        {venue.type}
                      </span>
                    </td>
                    <td>{venue.address.city}</td>
                    <td>{venue.address.country}</td>
                    <td>
                      <span className={`badge badge-${venue.status}`}>
                        {venue.status}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => openEditModal(venue)}
                        style={{ marginRight: '0.5rem' }}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDelete(venue)}
                        disabled={deleteMutation.isPending}
                      >
                        Archive
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
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
                      <option value="restaurant">Restaurant</option>
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
                    <input
                      type="text"
                      id="country"
                      name="country"
                      value={formData.country}
                      onChange={handleChange}
                      required
                      maxLength={2}
                      placeholder="CH"
                    />
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
    </>
  );
}

export default VenuesPage;
