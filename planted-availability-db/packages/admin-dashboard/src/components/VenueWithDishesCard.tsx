import ConfidenceBar from './ConfidenceBar';
import PlatformBadge from './PlatformBadge';
import DishRow from './DishRow';
import type { DiscoveredVenueForReview } from '../lib/api';

interface VenueWithDishesCardProps {
  venue: DiscoveredVenueForReview;
  selected: boolean;
  onSelect: (id: string, selected: boolean) => void;
  onVerify: (venue: DiscoveredVenueForReview) => void;
  onEdit: (venue: DiscoveredVenueForReview) => void;
  onReject: (venue: DiscoveredVenueForReview) => void;
  isLoading?: boolean;
}

function VenueWithDishesCard({
  venue,
  selected,
  onSelect,
  onVerify,
  onEdit,
  onReject,
  isLoading,
}: VenueWithDishesCardProps) {
  return (
    <div
      className="card"
      style={{
        marginBottom: '1rem',
        border: selected ? '2px solid var(--primary)' : '1px solid var(--border)',
        opacity: isLoading ? 0.7 : 1,
        pointerEvents: isLoading ? 'none' : 'auto',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '1rem',
          marginBottom: '1rem',
        }}
      >
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelect(venue.id, e.target.checked)}
          style={{ marginTop: '0.25rem' }}
        />

        {/* Venue Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{venue.name}</h3>
            {venue.is_chain && venue.chain_name && (
              <span
                style={{
                  padding: '0.15rem 0.4rem',
                  fontSize: '0.65rem',
                  background: 'var(--primary)',
                  color: '#fff',
                  borderRadius: '3px',
                  fontWeight: 600,
                }}
              >
                Chain: {venue.chain_name}
              </span>
            )}
          </div>

          <div style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: '0.5rem' }}>
            {venue.address.city}, {venue.address.country}
            {venue.address.street && ` - ${venue.address.street}`}
          </div>

          {/* Platform badges */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
            {venue.delivery_platforms.map((platform) => (
              <PlatformBadge
                key={platform.platform}
                platform={platform.platform}
                url={platform.url}
              />
            ))}
          </div>
        </div>

        {/* Confidence */}
        <div style={{ width: '120px', textAlign: 'right' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginBottom: '0.25rem' }}>
            Confidence
          </div>
          <ConfidenceBar score={venue.confidence_score} />
        </div>
      </div>

      {/* Products */}
      {venue.planted_products.length > 0 && (
        <div style={{ marginBottom: '0.75rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginRight: '0.5rem' }}>
            Products:
          </span>
          {venue.planted_products.map((product) => (
            <span
              key={product}
              style={{
                display: 'inline-block',
                padding: '0.15rem 0.4rem',
                fontSize: '0.7rem',
                background: 'var(--success)',
                color: '#fff',
                borderRadius: '3px',
                marginRight: '0.25rem',
                fontWeight: 500,
              }}
            >
              {product.replace('planted.', '')}
            </span>
          ))}
        </div>
      )}

      {/* Dishes */}
      {venue.dishes.length > 0 && (
        <div
          style={{
            borderTop: '1px solid var(--border)',
            paddingTop: '0.75rem',
            marginTop: '0.75rem',
          }}
        >
          <div
            style={{
              fontSize: '0.85rem',
              fontWeight: 600,
              marginBottom: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span>Dishes ({venue.dishes.length})</span>
          </div>
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {venue.dishes.map((dish, index) => (
              <DishRow key={index} dish={dish} index={index} />
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '0.5rem',
          marginTop: '1rem',
          paddingTop: '1rem',
          borderTop: '1px solid var(--border)',
        }}
      >
        <button
          className="btn btn-primary"
          onClick={() => onVerify(venue)}
          disabled={isLoading}
        >
          Verify All
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => onEdit(venue)}
          disabled={isLoading}
        >
          Edit & Verify
        </button>
        <button
          className="btn btn-danger"
          onClick={() => onReject(venue)}
          disabled={isLoading}
        >
          Reject
        </button>
      </div>
    </div>
  );
}

export default VenueWithDishesCard;
