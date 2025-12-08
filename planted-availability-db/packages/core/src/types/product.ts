import type { LocalizedString } from './dish.js';

export type ProductCategory =
  | 'chicken'
  | 'steak'
  | 'pulled'
  | 'kebab'
  | 'schnitzel'
  | 'bratwurst'
  | 'duck'
  | 'skewers'
  | 'filetwuerfel'
  | 'burger'
  | 'nuggets';

export interface Product {
  sku: string; // Primary key, e.g., "PLANTED-CHICKEN-NATURE-300G"
  name: LocalizedString;
  category: ProductCategory;
  variant: string; // 'nature', 'lemon-herbs', 'bbq', etc.
  weight_grams?: number;
  image_url: string;
  markets: string[]; // ISO country codes: ['CH', 'DE', 'AT', 'FR', 'IT', 'NL', 'UK', 'ES']
  retail_only: boolean;
  active: boolean;
}

export type CreateProductInput = Omit<Product, 'sku'> & { sku?: string };
export type UpdateProductInput = Partial<Omit<Product, 'sku'>>;
