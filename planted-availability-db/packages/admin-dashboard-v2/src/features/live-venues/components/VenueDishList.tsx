/**
 * VenueDishList Component
 *
 * Displays a list of dishes for a venue.
 */

import { ImageOff, Loader2 } from 'lucide-react';
import { Badge } from '@/shared/ui/Badge';
import { cn } from '@/lib/utils';
import type { VenueDish } from '../types';

interface VenueDishListProps {
  dishes: VenueDish[];
  isLoading?: boolean;
  error?: Error | null;
  className?: string;
}

/**
 * Product label mapping for display
 */
const PRODUCT_LABELS: Record<string, string> = {
  'planted.chicken': 'Chicken',
  'planted.pulled': 'Pulled',
  'planted.kebab': 'Kebab',
  'planted.schnitzel': 'Schnitzel',
  'planted.burger': 'Burger',
  'planted.steak': 'Steak',
  'planted.duck': 'Duck',
  'planted.nuggets': 'Nuggets',
  'planted.bratwurst': 'Bratwurst',
  'planted.filetwuerfel': 'Cubes',
  'planted.skewers': 'Skewers',
  'planted.other': 'Other',
};

/**
 * Get friendly label for product SKU
 */
function getProductLabel(sku: string): string {
  // Check direct match first
  if (PRODUCT_LABELS[sku]) {
    return PRODUCT_LABELS[sku];
  }
  // Try to match planted.* pattern
  const lowerSku = sku.toLowerCase();
  for (const [key, label] of Object.entries(PRODUCT_LABELS)) {
    if (lowerSku.includes(key.replace('planted.', ''))) {
      return label;
    }
  }
  // Fallback: clean up the SKU
  return sku.replace(/^planted\.?/i, '').replace(/-/g, ' ');
}

/**
 * Status colors for dishes
 */
const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  stale: 'bg-yellow-100 text-yellow-800',
  archived: 'bg-gray-100 text-gray-800',
};

/**
 * Single dish card
 */
function DishCard({ dish }: { dish: VenueDish }) {
  const formatPrice = (price: { amount: number; currency: string }) => {
    return new Intl.NumberFormat('en-CH', {
      style: 'currency',
      currency: price.currency,
    }).format(price.amount);
  };

  return (
    <div className="flex gap-3 p-3 border rounded-lg bg-card">
      {/* Image */}
      <div className="w-16 h-16 flex-shrink-0 rounded-md overflow-hidden bg-muted">
        {dish.imageUrl ? (
          <img
            src={dish.imageUrl}
            alt={dish.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.parentElement?.classList.add('flex', 'items-center', 'justify-center');
              const icon = document.createElement('div');
              icon.innerHTML = '<svg class="h-6 w-6 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';
              e.currentTarget.parentElement?.appendChild(icon.firstChild as Node);
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageOff className="h-6 w-6 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-medium text-sm line-clamp-1">{dish.name}</h4>
          <Badge className={cn('text-xs flex-shrink-0', STATUS_COLORS[dish.status] || STATUS_COLORS.active)}>
            {dish.status}
          </Badge>
        </div>

        {dish.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
            {dish.description}
          </p>
        )}

        <div className="flex items-center justify-between mt-2">
          <span className="text-sm font-semibold">
            {formatPrice(dish.price)}
          </span>
          <div className="flex gap-1">
            {dish.plantedProducts.map((product, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs">
                {getProductLabel(product)}
              </Badge>
            ))}
          </div>
        </div>

        {dish.dietaryTags.length > 0 && (
          <div className="flex gap-1 mt-1.5">
            {dish.dietaryTags.slice(0, 3).map((tag, idx) => (
              <Badge key={idx} variant="outline" className="text-xs py-0">
                {tag}
              </Badge>
            ))}
            {dish.dietaryTags.length > 3 && (
              <span className="text-xs text-muted-foreground">
                +{dish.dietaryTags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * VenueDishList Component
 */
export function VenueDishList({ dishes, isLoading, error, className }: VenueDishListProps) {
  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center py-8', className)}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading dishes...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('text-center py-6 text-muted-foreground', className)}>
        <p className="text-sm">Failed to load dishes</p>
      </div>
    );
  }

  if (dishes.length === 0) {
    return (
      <div className={cn('text-center py-6 text-muted-foreground', className)}>
        <p className="text-sm">No dishes found for this venue</p>
      </div>
    );
  }

  // Group by status
  const activeDishes = dishes.filter(d => d.status === 'active');
  const staleDishes = dishes.filter(d => d.status === 'stale');
  const archivedDishes = dishes.filter(d => d.status === 'archived');

  return (
    <div className={cn('space-y-3', className)}>
      {/* Active dishes */}
      {activeDishes.length > 0 && (
        <div className="space-y-2">
          {activeDishes.map((dish) => (
            <DishCard key={dish.id} dish={dish} />
          ))}
        </div>
      )}

      {/* Stale dishes */}
      {staleDishes.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium pt-2">Stale ({staleDishes.length})</p>
          {staleDishes.map((dish) => (
            <DishCard key={dish.id} dish={dish} />
          ))}
        </div>
      )}

      {/* Archived dishes */}
      {archivedDishes.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium pt-2">Archived ({archivedDishes.length})</p>
          {archivedDishes.map((dish) => (
            <DishCard key={dish.id} dish={dish} />
          ))}
        </div>
      )}
    </div>
  );
}
