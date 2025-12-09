export type VenueType = 'retail' | 'restaurant' | 'delivery_kitchen';
export type VenueStatus = 'active' | 'stale' | 'archived';
export type SourceType = 'scraped' | 'manual' | 'partner_feed';
export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

// Simplified GeoJSON geometry type for delivery zones
export interface GeoJSONGeometry {
  type: 'Polygon' | 'MultiPolygon' | 'Point' | 'LineString';
  coordinates: number[] | number[][] | number[][][] | number[][][][];
}

export interface TimeRange {
  open: string;  // HH:MM format
  close: string; // HH:MM format
}

export interface Address {
  street: string;
  city: string;
  postal_code: string;
  country: string; // ISO 3166-1 alpha-2
}

export interface OpeningHours {
  regular: {
    [K in DayOfWeek]?: TimeRange[];
  };
  exceptions?: {
    date: string; // YYYY-MM-DD format
    hours: TimeRange[] | 'closed';
  }[];
}

export interface Contact {
  phone?: string;
  email?: string;
  website?: string;
}

export interface DataSource {
  type: SourceType;
  url?: string;
  scraper_id?: string;
}

// Delivery platform types (shared with dish.ts)
export type DeliveryPartner = 'uber_eats' | 'wolt' | 'lieferando' | 'deliveroo' | 'just_eat' | 'glovo';

// Venue-level delivery platform link (URL stored once per venue, not per dish)
export interface DeliveryPlatformLink {
  partner: DeliveryPartner;
  url: string;
  venue_id_on_platform?: string;
  active: boolean;
  last_verified?: Date;
}

export interface Venue {
  id: string;
  type: VenueType;
  name: string;
  chain_id?: string;
  location: GeoPoint;
  address: Address;
  opening_hours: OpeningHours;
  delivery_zones?: string[] | GeoJSONGeometry;
  contact?: Contact;

  // Delivery platform links (URLs stored at venue level, not duplicated per dish)
  delivery_platforms?: DeliveryPlatformLink[];

  source: DataSource;
  last_verified: Date;
  status: VenueStatus;
  created_at: Date;
  updated_at: Date;
}

export interface VenueWithDistance extends Venue {
  distance_km: number;
  is_open: boolean;
  next_open?: Date;
}

export type CreateVenueInput = Omit<Venue, 'id' | 'created_at' | 'updated_at' | 'last_verified'>;
export type UpdateVenueInput = Partial<Omit<Venue, 'id' | 'created_at'>>;
