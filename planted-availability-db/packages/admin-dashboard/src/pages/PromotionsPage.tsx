import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Promotion, PromoType } from '@pad/core';
import { promotionsApi } from '../lib/api';

interface PromotionFormData {
  title: string;
  promo_type: PromoType;
  venue_id: string;
  chain_id: string;
  product_skus: string;
  discount_type: 'percent' | 'fixed' | '';
  discount_value: string;
  valid_from: string;
  valid_until: string;
  description: string;
  terms: string;
}

const emptyForm: PromotionFormData = {
  title: '',
  promo_type: 'discount',
  venue_id: '',
  chain_id: '',
  product_skus: '',
  discount_type: 'percent',
  discount_value: '',
  valid_from: '',
  valid_until: '',
  description: '',
  terms: '',
};

function formatDate(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function PromotionsPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<PromotionFormData>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [showExpired, setShowExpired] = useState(false);

  // Fetch promotions
  const { data, isLoading, isError } = useQuery({
    queryKey: ['promotions', showExpired],
    queryFn: () => promotionsApi.getAll({ active_only: !showExpired, limit: 100 }),
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: unknown) => promotionsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
      closeModal();
    },
    onError: (err: Error) => setError(err.message),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => promotionsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const openCreateModal = () => {
    setFormData(emptyForm);
    setError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setFormData(emptyForm);
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate dates
    const validFrom = new Date(formData.valid_from);
    const validUntil = new Date(formData.valid_until);

    if (isNaN(validFrom.getTime())) {
      setError('Invalid start date');
      return;
    }

    if (isNaN(validUntil.getTime())) {
      setError('Invalid end date');
      return;
    }

    if (validUntil <= validFrom) {
      setError('End date must be after start date');
      return;
    }

    // Validate discount value if discount type is set
    let discountValue: number | undefined;
    if (formData.discount_type && formData.discount_value) {
      discountValue = parseFloat(formData.discount_value);
      if (isNaN(discountValue) || discountValue < 0) {
        setError('Discount value must be a positive number');
        return;
      }
      if (formData.discount_type === 'percent' && discountValue > 100) {
        setError('Percentage discount cannot exceed 100%');
        return;
      }
    }

    const promotionData = {
      title: formData.title,
      promo_type: formData.promo_type,
      venue_id: formData.venue_id || undefined,
      chain_id: formData.chain_id || undefined,
      product_skus: formData.product_skus.split(',').map(s => s.trim()).filter(Boolean),
      discount: formData.discount_type && discountValue !== undefined ? {
        type: formData.discount_type,
        value: discountValue,
      } : undefined,
      valid_from: validFrom,
      valid_until: validUntil,
      description: formData.description || undefined,
      terms: formData.terms || undefined,
      source: { type: 'manual' as const },
    };

    createMutation.mutate(promotionData);
  };

  const handleDelete = (promo: Promotion) => {
    if (confirm(`Are you sure you want to delete promotion "${promo.title}"?`)) {
      deleteMutation.mutate(promo.id);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const promotions = (data?.promotions || []) as Promotion[];
  const isSubmitting = createMutation.isPending;

  return (
    <>
      <header className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Promotions</h2>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
              <input
                type="checkbox"
                checked={showExpired}
                onChange={(e) => setShowExpired(e.target.checked)}
              />
              Show expired
            </label>
            <button className="btn btn-primary" onClick={openCreateModal}>
              Add Promotion
            </button>
          </div>
        </div>
      </header>

      <div className="page-content">
        {isError && (
          <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
            Failed to load promotions. Please try again.
          </div>
        )}

        <div className="card">
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <div className="loading-spinner" />
              <p>Loading promotions...</p>
            </div>
          ) : promotions.length === 0 ? (
            <p style={{ color: 'var(--text-light)', textAlign: 'center', padding: '2rem' }}>
              No {showExpired ? '' : 'active '}promotions found. Click "Add Promotion" to create one.
            </p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Discount</th>
                  <th>Valid From</th>
                  <th>Valid Until</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {promotions.map((promo) => {
                  const now = new Date();
                  const validFrom = new Date(promo.valid_from);
                  const validUntil = new Date(promo.valid_until);
                  const isExpired = validUntil < now;
                  const isUpcoming = validFrom > now;

                  return (
                    <tr key={promo.id}>
                      <td>{promo.title}</td>
                      <td>
                        <span className={`badge badge-${promo.promo_type}`}>
                          {promo.promo_type}
                        </span>
                      </td>
                      <td>
                        {promo.discount ? (
                          promo.discount.type === 'percent'
                            ? `${promo.discount.value}%`
                            : `CHF ${promo.discount.value}`
                        ) : '-'}
                      </td>
                      <td>{formatDate(promo.valid_from)}</td>
                      <td>{formatDate(promo.valid_until)}</td>
                      <td>
                        <span className={`badge badge-${isExpired ? 'archived' : isUpcoming ? 'stale' : 'active'}`}>
                          {isExpired ? 'Expired' : isUpcoming ? 'Upcoming' : 'Active'}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDelete(promo)}
                          disabled={deleteMutation.isPending}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
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
              <h3>Add Promotion</h3>
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
                  <label htmlFor="title">Title *</label>
                  <input
                    type="text"
                    id="title"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    required
                    placeholder="e.g., 20% off Planted Chicken"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="promo_type">Promotion Type *</label>
                    <select
                      id="promo_type"
                      name="promo_type"
                      value={formData.promo_type}
                      onChange={handleChange}
                      required
                    >
                      <option value="discount">Discount</option>
                      <option value="bundle">Bundle</option>
                      <option value="special">Special</option>
                      <option value="new_product">New Product</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="discount_type">Discount Type</label>
                    <select
                      id="discount_type"
                      name="discount_type"
                      value={formData.discount_type}
                      onChange={handleChange}
                    >
                      <option value="">None</option>
                      <option value="percent">Percentage (%)</option>
                      <option value="fixed">Fixed Amount</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="discount_value">Discount Value</label>
                    <input
                      type="number"
                      id="discount_value"
                      name="discount_value"
                      value={formData.discount_value}
                      onChange={handleChange}
                      placeholder="e.g., 20"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="venue_id">Venue ID (optional)</label>
                    <input
                      type="text"
                      id="venue_id"
                      name="venue_id"
                      value={formData.venue_id}
                      onChange={handleChange}
                      placeholder="For venue-specific promo"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="chain_id">Chain ID (optional)</label>
                    <input
                      type="text"
                      id="chain_id"
                      name="chain_id"
                      value={formData.chain_id}
                      onChange={handleChange}
                      placeholder="For chain-wide promo"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="product_skus">Product SKUs (comma-separated)</label>
                  <input
                    type="text"
                    id="product_skus"
                    name="product_skus"
                    value={formData.product_skus}
                    onChange={handleChange}
                    placeholder="e.g., planted.chicken, planted.steak"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="valid_from">Valid From *</label>
                    <input
                      type="date"
                      id="valid_from"
                      name="valid_from"
                      value={formData.valid_from}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="valid_until">Valid Until *</label>
                    <input
                      type="date"
                      id="valid_until"
                      name="valid_until"
                      value={formData.valid_until}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="description">Description</label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows={2}
                    placeholder="Brief description of the promotion"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="terms">Terms & Conditions</label>
                  <textarea
                    id="terms"
                    name="terms"
                    value={formData.terms}
                    onChange={handleChange}
                    rows={2}
                    placeholder="Fine print / conditions"
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
                  {isSubmitting ? 'Creating...' : 'Create Promotion'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default PromotionsPage;
