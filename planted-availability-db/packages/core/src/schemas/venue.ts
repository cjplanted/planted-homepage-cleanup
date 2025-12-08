import { z } from 'zod';

export const venueTypeSchema = z.enum(['retail', 'restaurant', 'delivery_kitchen']);
export const venueStatusSchema = z.enum(['active', 'stale', 'archived']);
export const sourceTypeSchema = z.enum(['scraped', 'manual', 'partner_feed']);
export const dayOfWeekSchema = z.enum([
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
]);

export const geoPointSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

// Time format: HH:MM
const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
export const timeRangeSchema = z.object({
  open: z.string().regex(timeRegex, 'Time must be in HH:MM format'),
  close: z.string().regex(timeRegex, 'Time must be in HH:MM format'),
});

// ISO 3166-1 alpha-2 country code
const countryCodeRegex = /^[A-Z]{2}$/;
export const addressSchema = z.object({
  street: z.string().min(1).max(200),
  city: z.string().min(1).max(100),
  postal_code: z.string().min(1).max(20),
  country: z.string().regex(countryCodeRegex, 'Country must be ISO 3166-1 alpha-2 code'),
});

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
export const openingHoursSchema = z.object({
  regular: z.record(dayOfWeekSchema, z.array(timeRangeSchema).optional()).optional().default({}),
  exceptions: z.array(z.object({
    date: z.string().regex(dateRegex, 'Date must be in YYYY-MM-DD format'),
    hours: z.union([z.array(timeRangeSchema), z.literal('closed')]),
  })).optional(),
});

export const contactSchema = z.object({
  phone: z.string().max(30).optional(),
  email: z.string().email().optional(),
  website: z.string().url().optional(),
}).optional();

export const dataSourceSchema = z.object({
  type: sourceTypeSchema,
  url: z.string().url().optional(),
  scraper_id: z.string().optional(),
});

export const venueSchema = z.object({
  id: z.string(),
  type: venueTypeSchema,
  name: z.string().min(1).max(200),
  chain_id: z.string().optional(),
  location: geoPointSchema,
  address: addressSchema,
  opening_hours: openingHoursSchema,
  delivery_zones: z.union([z.array(z.string()), z.any()]).optional(), // GeoJSON geometry
  contact: contactSchema,
  source: dataSourceSchema,
  last_verified: z.coerce.date(),
  status: venueStatusSchema,
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

export const createVenueInputSchema = venueSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
  last_verified: true,
});

export const updateVenueInputSchema = createVenueInputSchema.partial();

export type VenueSchemaType = z.infer<typeof venueSchema>;
export type CreateVenueInputSchemaType = z.infer<typeof createVenueInputSchema>;
export type UpdateVenueInputSchemaType = z.infer<typeof updateVenueInputSchema>;
