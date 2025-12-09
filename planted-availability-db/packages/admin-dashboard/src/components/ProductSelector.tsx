interface ProductSelectorProps {
  value: string;
  onChange: (value: string) => void;
  multiple?: boolean;
  selectedProducts?: string[];
  onMultiChange?: (products: string[]) => void;
}

const PLANTED_PRODUCTS = [
  { sku: 'planted.chicken', name: 'Chicken' },
  { sku: 'planted.chicken_tenders', name: 'Chicken Tenders' },
  { sku: 'planted.chicken_burger', name: 'Chicken Burger' },
  { sku: 'planted.kebab', name: 'Kebab' },
  { sku: 'planted.schnitzel', name: 'Schnitzel' },
  { sku: 'planted.pulled', name: 'Pulled' },
  { sku: 'planted.burger', name: 'Burger' },
  { sku: 'planted.steak', name: 'Steak' },
  { sku: 'planted.pastrami', name: 'Pastrami' },
  { sku: 'planted.duck', name: 'Duck' },
];

function ProductSelector({
  value,
  onChange,
  multiple = false,
  selectedProducts = [],
  onMultiChange,
}: ProductSelectorProps) {
  if (multiple && onMultiChange) {
    const toggleProduct = (sku: string) => {
      if (selectedProducts.includes(sku)) {
        onMultiChange(selectedProducts.filter((p) => p !== sku));
      } else {
        onMultiChange([...selectedProducts, sku]);
      }
    };

    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
        {PLANTED_PRODUCTS.map((product) => (
          <button
            key={product.sku}
            type="button"
            onClick={() => toggleProduct(product.sku)}
            style={{
              padding: '0.25rem 0.5rem',
              fontSize: '0.75rem',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              cursor: 'pointer',
              background: selectedProducts.includes(product.sku)
                ? 'var(--primary)'
                : 'var(--bg)',
              color: selectedProducts.includes(product.sku)
                ? '#fff'
                : 'var(--text)',
            }}
          >
            {product.name}
          </button>
        ))}
      </div>
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        padding: '0.5rem',
        borderRadius: '4px',
        border: '1px solid var(--border)',
        background: 'var(--bg)',
        color: 'var(--text)',
        fontSize: '0.875rem',
        width: '100%',
      }}
    >
      <option value="">Select product...</option>
      {PLANTED_PRODUCTS.map((product) => (
        <option key={product.sku} value={product.sku}>
          {product.name} ({product.sku})
        </option>
      ))}
    </select>
  );
}

export default ProductSelector;
