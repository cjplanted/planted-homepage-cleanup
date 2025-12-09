import type { DataSource, VenueStatus, DeliveryPartner } from './venue.js';

export type AvailabilityType = 'permanent' | 'limited' | 'seasonal';

// Re-export for backwards compatibility
export type { DeliveryPartner } from './venue.js';

export interface LocalizedString {
  [locale: string]: string;
}

export interface Price {
  amount: number;
  currency: string; // ISO 4217
}

// Multi-country pricing for chain restaurants operating across borders
export interface CountryPrice {
  country: string; // ISO 3166-1 alpha-2 (e.g., 'CH', 'DE', 'AT')
  amount: number;
  currency: string; // ISO 4217 (e.g., 'CHF', 'EUR')
}

export interface DishAvailability {
  type: AvailabilityType;
  start_date?: Date;
  end_date?: Date;
  days_available?: string[]; // DayOfWeek[]
}

// Dish-specific delivery info (URL is inherited from venue.delivery_platforms)
export interface DeliveryPartnerInfo {
  partner: DeliveryPartner;
  url?: string; // @deprecated - Use venue.delivery_platforms instead. Kept for backwards compatibility.
  price?: number; // Dish-specific price on this platform (may differ from base price)
}

export interface Dish {
  id: string;
  venue_id: string;
  name: string;
  name_localized?: LocalizedString;
  description: string;
  description_localized?: LocalizedString;
  planted_products: string[]; // SKUs from products collection

  // Pricing
  price: Price; // Default/primary price
  prices_by_country?: CountryPrice[]; // For chains operating in multiple countries (e.g., Hans im Glück)

  image_url?: string;
  image_source?: string;
  dietary_tags: string[];
  cuisine_type?: string;
  availability: DishAvailability;

  // Delivery info (URLs now on venue.delivery_platforms, only prices stored here)
  delivery_partners?: DeliveryPartnerInfo[];

  source: DataSource;
  last_verified: Date;
  status: VenueStatus;
  created_at: Date;
  updated_at: Date;
}

export interface DishWithVenue extends Dish {
  venue_name: string;
  venue_type: string;
  distance_km?: number;
  delivery_available: boolean;
}

export type CreateDishInput = Omit<Dish, 'id' | 'created_at' | 'updated_at' | 'last_verified'>;
export type UpdateDishInput = Partial<Omit<Dish, 'id' | 'created_at'>>;
