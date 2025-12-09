import ConfidenceBar from './ConfidenceBar';

interface Dish {
  name: string;
  price?: string;
  product: string;
  description?: string;
  confidence?: number;
}

interface DishRowProps {
  dish: Dish;
  index: number;
}

function DishRow({ dish, index }: DishRowProps) {
  const productShort = dish.product.replace('planted.', '');
  const confidence = dish.confidence ?? 80;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.5rem 0',
        borderBottom: '1px solid var(--border-light)',
      }}
    >
      <span
        style={{
          color: 'var(--text-light)',
          fontSize: '0.75rem',
          width: '1.5rem',
        }}
      >
        {index + 1}.
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 500,
            fontSize: '0.875rem',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {dish.name}
        </div>
        {dish.description && (
          <div
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-light)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {dish.description}
          </div>
        )}
      </div>

      {dish.price && (
        <span
          style={{
            fontWeight: 600,
            fontSize: '0.875rem',
            color: 'var(--primary)',
            whiteSpace: 'nowrap',
          }}
        >
          {dish.price}
        </span>
      )}

      <span
        style={{
          padding: '0.15rem 0.4rem',
          fontSize: '0.65rem',
          fontWeight: 600,
          background: 'var(--bg-light)',
          borderRadius: '3px',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}
      >
        {productShort}
      </span>

      <div style={{ width: '80px' }}>
        <ConfidenceBar score={confidence} size="sm" showLabel={false} />
      </div>
    </div>
  );
}

export default DishRow;
