import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Dish, Venue, VenueStatus, CreateDishInput } from '@pad/core';
import { dishesApi, venuesApi } from '../lib/api';

interface DishFormData {
  venue_id: string;
  name: string;
  description: string;
  price_amount: string;
  price_currency: string;
  cuisine_type: string;
  dietary_tags: string;
  planted_products: string;
  status: VenueStatus;
  image_url: string;
}

const emptyForm: DishFormData = {
  venue_id: '',
  name: '',
  description: '',
  price_amount: '',
  price_currency: 'CHF',
  cuisine_type: '',
  dietary_tags: '',
  planted_products: '',
  status: 'active',
  image_url: '',
};

function DishesPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDish, setEditingDish] = useState<Dish | null>(null);
  const [formData, setFormData] = useState<DishFormData>(emptyForm);
  const [error, setError] = useState<string | null>(null);

  // Fetch dishes
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dishes'],
    queryFn: () => dishesApi.getAll({ limit: 100 }),
  });

  // Fetch venues for the dropdown
  const { data: venuesData } = useQuery({
    queryKey: ['venues'],
    queryFn: () => venuesApi.getAll({ limit: 100 }),
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateDishInput) => dishesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dishes'] });
      closeModal();
    },
    onError: (err: Error) => setError(err.message),
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Dish> }) =>
      dishesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dishes'] });
      closeModal();
    },
    onError: (err: Error) => setError(err.message),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => dishesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dishes'] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const openCreateModal = () => {
    setEditingDish(null);
    setFormData(emptyForm);
    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (dish: Dish) => {
    setEditingDish(dish);
    setFormData({
      venue_id: dish.venue_id,
      name: dish.name,
      description: dish.description,
      price_amount: String(dish.price.amount),
      price_currency: dish.price.currency,
      cuisine_type: dish.cuisine_type || '',
      dietary_tags: dish.dietary_tags.join(', '),
      planted_products: dish.planted_products.join(', '),
      status: dish.status,
      image_url: dish.image_url || '',
    });
    setError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingDish(null);
    setFormData(emptyForm);
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const priceAmount = parseFloat(formData.price_amount);
    if (isNaN(priceAmount) || priceAmount < 0) {
      setError('Invalid price amount');
      return;
    }

    if (!formData.venue_id) {
      setError('Please select a venue');
      return;
    }

    const dishData: CreateDishInput = {
      venue_id: formData.venue_id,
      name: formData.name,
      description: formData.description,
      price: {
        amount: priceAmount,
        currency: formData.price_currency,
      },
      cuisine_type: formData.cuisine_type || undefined,
      dietary_tags: formData.dietary_tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      planted_products: formData.planted_products
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean),
      status: formData.status,
      image_url: formData.image_url || undefined,
      availability: { type: 'permanent' },
      source: { type: 'manual' },
    };

    if (editingDish) {
      updateMutation.mutate({ id: editingDish.id, data: dishData });
    } else {
      createMutation.mutate(dishData);
    }
  };

  const handleDelete = (dish: Dish) => {
    if (confirm(`Are you sure you want to archive "${dish.name}"?`)) {
      deleteMutation.mutate(dish.id);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const dishes = (data?.dishes || []) as Dish[];
  const venues = (venuesData?.venues || []) as Venue[];
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  // Helper to get venue name by ID
  const getVenueName = (venueId: string) => {
    const venue = venues.find((v) => v.id === venueId);
    return venue?.name || venueId;
  };

  return (
    <>
      <header className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Dishes</h2>
          <button className="btn btn-primary" onClick={openCreateModal}>
            Add Dish
          </button>
        </div>
      </header>

      <div className="page-content">
        {isError && (
          <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
            Failed to load dishes. Please try again.
          </div>
        )}

        <div className="card">
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <div className="loading-spinner" />
              <p>Loading dishes...</p>
            </div>
          ) : dishes.length === 0 ? (
            <p style={{ color: 'var(--text-light)', textAlign: 'center', padding: '2rem' }}>
              No dishes found. Click "Add Dish" to create one.
            </p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Venue</th>
                  <th>Price</th>
                  <th>Products</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {dishes.map((dish) => (
                  <tr key={dish.id}>
                    <td>
                      <div>
                        <strong>{dish.name}</strong>
                        {dish.cuisine_type && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
                            {dish.cuisine_type}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>{getVenueName(dish.venue_id)}</td>
                    <td>
                      {dish.price.currency} {dish.price.amount.toFixed(2)}
                    </td>
                    <td>
                      <span style={{ fontSize: '0.75rem' }}>
                        {dish.planted_products.slice(0, 2).join(', ')}
                        {dish.planted_products.length > 2 && '...'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-${dish.status}`}>{dish.status}</span>
                    </td>
                    <td>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => openEditModal(dish)}
                        style={{ marginRight: '0.5rem' }}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDelete(dish)}
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
              <h3>{editingDish ? 'Edit Dish' : 'Add Dish'}</h3>
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
                  <label htmlFor="venue_id">Venue *</label>
                  <select
                    id="venue_id"
                    name="venue_id"
                    value={formData.venue_id}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select a venue</option>
                    {venues.map((venue) => (
                      <option key={venue.id} value={venue.id}>
                        {venue.name} ({venue.address.city})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="name">Name *</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    placeholder="e.g., Planted Chicken Burger"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="description">Description *</label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    required
                    placeholder="Describe the dish..."
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="price_amount">Price *</label>
                    <input
                      type="number"
                      id="price_amount"
                      name="price_amount"
                      value={formData.price_amount}
                      onChange={handleChange}
                      required
                      min="0"
                      step="0.01"
                      placeholder="19.90"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="price_currency">Currency *</label>
                    <select
                      id="price_currency"
                      name="price_currency"
                      value={formData.price_currency}
                      onChange={handleChange}
                      required
                    >
                      <option value="CHF">CHF</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                      <option value="USD">USD</option>
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
                  <label htmlFor="planted_products">Planted Products *</label>
                  <input
                    type="text"
                    id="planted_products"
                    name="planted_products"
                    value={formData.planted_products}
                    onChange={handleChange}
                    required
                    placeholder="planted.chicken, planted.kebab (comma-separated)"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="cuisine_type">Cuisine Type</label>
                    <input
                      type="text"
                      id="cuisine_type"
                      name="cuisine_type"
                      value={formData.cuisine_type}
                      onChange={handleChange}
                      placeholder="e.g., Italian, Asian, Swiss"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="dietary_tags">Dietary Tags</label>
                    <input
                      type="text"
                      id="dietary_tags"
                      name="dietary_tags"
                      value={formData.dietary_tags}
                      onChange={handleChange}
                      placeholder="vegan, high-protein (comma-separated)"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="image_url">Image URL</label>
                  <input
                    type="url"
                    id="image_url"
                    name="image_url"
                    value={formData.image_url}
                    onChange={handleChange}
                    placeholder="https://example.com/dish.jpg"
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
                  {isSubmitting ? 'Saving...' : editingDish ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default DishesPage;
