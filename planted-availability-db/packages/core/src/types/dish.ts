import type { DataSource, VenueStatus } from './venue.js';

export type AvailabilityType = 'permanent' | 'limited' | 'seasonal';
export type DeliveryPartner = 'uber_eats' | 'wolt' | 'lieferando' | 'deliveroo' | 'just_eat' | 'glovo';

export interface LocalizedString {
  [locale: string]: string;
}

export interface Price {
  amount: number;
  currency: string; // ISO 4217
}

export interface DishAvailability {
  type: AvailabilityType;
  start_date?: Date;
  end_date?: Date;
  days_available?: string[]; // DayOfWeek[]
}

export interface DeliveryPartnerInfo {
  partner: DeliveryPartner;
  url: string;
  price?: number;
}

export interface Dish {
  id: string;
  venue_id: string;
  name: string;
  name_localized?: LocalizedString;
  description: string;
  description_localized?: LocalizedString;
  planted_products: string[]; // SKUs from products collection
  price: Price;
  image_url?: string;
  image_source?: string;
  dietary_tags: string[];
  cuisine_type?: string;
  availability: DishAvailability;
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
