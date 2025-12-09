import { useState } from 'react';
import ProductSelector from './ProductSelector';
import type { DiscoveredVenueForReview } from '../lib/api';

interface EditableDish {
  name: string;
  price?: string;
  product: string;
  description?: string;
}

interface VenueEditModalProps {
  venue: DiscoveredVenueForReview;
  onSave: (updatedVenue: Partial<DiscoveredVenueForReview>) => void;
  onReject: (reason: string) => void;
  onClose: () => void;
  isLoading?: boolean;
}

function VenueEditModal({ venue, onSave, onReject, onClose, isLoading }: VenueEditModalProps) {
  const [name, setName] = useState(venue.name);
  const [city, setCity] = useState(venue.address.city);
  const [country, setCountry] = useState(venue.address.country);
  const [street, setStreet] = useState(venue.address.street || '');
  const [postalCode, setPostalCode] = useState(venue.address.postal_code || '');
  const [plantedProducts, setPlantedProducts] = useState<string[]>(venue.planted_products);
  const [dishes, setDishes] = useState<EditableDish[]>(venue.dishes.map(d => ({
    name: d.name,
    price: d.price,
    product: d.product,
    description: d.description,
  })));
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  const handleDishChange = (index: number, field: keyof EditableDish, value: string) => {
    const updated = [...dishes];
    updated[index] = { ...updated[index], [field]: value };
    setDishes(updated);
  };

  const handleRemoveDish = (index: number) => {
    setDishes(dishes.filter((_, i) => i !== index));
  };

  const handleAddDish = () => {
    setDishes([...dishes, { name: '', product: 'planted.chicken', price: '', description: '' }]);
  };

  const handleSave = () => {
    onSave({
      name,
      address: {
        city,
        country,
        street: street || undefined,
        postal_code: postalCode || undefined,
      },
      planted_products: plantedProducts,
      dishes: dishes.filter(d => d.name.trim() !== ''),
    });
  };

  const handleReject = () => {
    if (rejectionReason.trim()) {
      onReject(rejectionReason);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: '90%',
          maxWidth: '800px',
          maxHeight: '90vh',
          overflow: 'auto',
          margin: '1rem',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Edit & Verify Venue</h2>

        {/* Venue Details Section */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Venue Details</h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem' }}>
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem' }}>
                Street
              </label>
              <input
                type="text"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem' }}>
                City
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem' }}>
                Postal Code
              </label>
              <input
                type="text"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem' }}>
                Country
              </label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                }}
              >
                <option value="CH">Switzerland (CH)</option>
                <option value="DE">Germany (DE)</option>
                <option value="AT">Austria (AT)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Products Section */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Planted Products</h3>
          <ProductSelector
            value=""
            onChange={() => {}}
            multiple
            selectedProducts={plantedProducts}
            onMultiChange={setPlantedProducts}
          />
        </div>

        {/* Dishes Section */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '1rem', margin: 0 }}>Dishes ({dishes.length})</h3>
            <button className="btn btn-sm btn-secondary" onClick={handleAddDish}>
              + Add Dish
            </button>
          </div>

          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {dishes.map((dish, index) => (
              <div
                key={index}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr auto',
                  gap: '0.5rem',
                  padding: '0.5rem',
                  background: 'var(--bg-light)',
                  borderRadius: '4px',
                  marginBottom: '0.5rem',
                  alignItems: 'center',
                }}
              >
                <input
                  type="text"
                  placeholder="Dish name"
                  value={dish.name}
                  onChange={(e) => handleDishChange(index, 'name', e.target.value)}
                  style={{
                    padding: '0.4rem',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    fontSize: '0.85rem',
                  }}
                />
                <input
                  type="text"
                  placeholder="Price"
                  value={dish.price || ''}
                  onChange={(e) => handleDishChange(index, 'price', e.target.value)}
                  style={{
                    padding: '0.4rem',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    fontSize: '0.85rem',
                  }}
                />
                <select
                  value={dish.product}
                  onChange={(e) => handleDishChange(index, 'product', e.target.value)}
                  style={{
                    padding: '0.4rem',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    fontSize: '0.85rem',
                  }}
                >
                  <option value="planted.chicken">Chicken</option>
                  <option value="planted.kebab">Kebab</option>
                  <option value="planted.schnitzel">Schnitzel</option>
                  <option value="planted.pulled">Pulled</option>
                  <option value="planted.burger">Burger</option>
                  <option value="planted.steak">Steak</option>
                  <option value="planted.duck">Duck</option>
                </select>
                <button
                  type="button"
                  onClick={() => handleRemoveDish(index)}
                  style={{
                    padding: '0.4rem 0.6rem',
                    background: 'var(--danger)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                  }}
                >
                  X
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Rejection Form */}
        {showRejectForm && (
          <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'var(--danger-bg)', borderRadius: '4px' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem', color: 'var(--danger)' }}>
              Rejection Reason
            </h3>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter reason for rejection..."
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid var(--danger)',
                borderRadius: '4px',
                minHeight: '80px',
                resize: 'vertical',
              }}
            />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button
                className="btn btn-danger"
                onClick={handleReject}
                disabled={!rejectionReason.trim() || isLoading}
              >
                Confirm Reject
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setShowRejectForm(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: '1rem',
            paddingTop: '1rem',
            borderTop: '1px solid var(--border)',
          }}
        >
          <div>
            {!showRejectForm && (
              <button
                className="btn btn-danger"
                onClick={() => setShowRejectForm(true)}
                disabled={isLoading}
              >
                Reject
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary" onClick={onClose} disabled={isLoading}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSave} disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save & Verify'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VenueEditModal;
