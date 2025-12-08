import type { DataSource } from './venue.js';

export type PromoType = 'discount' | 'bundle' | 'special' | 'new_product';
export type DiscountType = 'percent' | 'fixed';

export interface Discount {
  type: DiscountType;
  value: number; // 20 for 20% or 2.00 for CHF 2 off
}

export interface Promotion {
  id: string;
  venue_id?: string;
  chain_id?: string;
  product_skus: string[];
  promo_type: PromoType;
  discount?: Discount;
  title: string;
  description?: string;
  image_url?: string;
  valid_from: Date;
  valid_until: Date;
  terms?: string;
  source: DataSource;
  active: boolean; // Computed: true if valid_from <= now <= valid_until
  created_at: Date;
}

export interface RetailAvailability {
  id: string;
  venue_id: string;
  product_sku: string;
  in_stock: boolean;
  price?: {
    regular: number;
    currency: string;
  };
  promotion?: {
    id: string;
    price: number;
    valid_until: Date;
  };
  shelf_location?: string;
  last_verified: Date;
  source: DataSource;
  created_at: Date;
  updated_at: Date;
}

export type CreatePromotionInput = Omit<Promotion, 'id' | 'created_at' | 'active'>;
export type UpdatePromotionInput = Partial<Omit<Promotion, 'id' | 'created_at' | 'active'>>;

export type CreateRetailAvailabilityInput = Omit<RetailAvailability, 'id' | 'created_at' | 'updated_at'>;
export type UpdateRetailAvailabilityInput = Partial<Omit<RetailAvailability, 'id' | 'created_at' | 'updated_at'>>;
